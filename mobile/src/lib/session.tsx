import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import * as api from "../lib/api";
import * as storage from "../lib/storage";
import type { AuthUser } from "../lib/types";

type Status = "loading" | "needs-server" | "needs-auth" | "ready";

interface SessionValue {
  status: Status;
  user: AuthUser | null;
  serverUrl: string;
  /** Persist a server URL and probe it before moving on. */
  connect: (url: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** True when the backend runs with AUTH_ENABLED=false. */
  authDisabled: boolean;
}

const SessionContext = createContext<SessionValue | null>(null);

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside <SessionProvider>");
  return ctx;
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [serverUrl, setServerUrl] = useState("");
  const [authDisabled, setAuthDisabled] = useState(false);

  // Restore the saved server and any stored session token on cold start.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const saved = await storage.loadServerUrl();
      if (!saved) {
        if (!cancelled) setStatus("needs-server");
        return;
      }
      const savedToken = await storage.loadToken(saved);
      api.configure(saved, savedToken);
      if (cancelled) return;
      setServerUrl(saved);

      try {
        await api.checkHealth();
      } catch {
        if (!cancelled) setStatus("needs-server");
        return;
      }
      if (cancelled) return;

      if (!savedToken) {
        setStatus("needs-auth");
        return;
      }
      try {
        const current = await api.me();
        if (cancelled) return;
        if (current) {
          setUser(current);
          setStatus("ready");
        } else {
          // Token was rejected: drop it and ask for credentials.
          await storage.clearToken(saved);
          api.setToken(null);
          setStatus("needs-auth");
        }
      } catch {
        if (!cancelled) setStatus("needs-auth");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const connect = useCallback(async (url: string) => {
    const normalised = storage.toServerUrl(url);
    api.configure(normalised, null);
    const info = await api.checkHealth();
    if (info.status !== "ok") throw new Error("The server responded, but is not ready.");
    await storage.saveServerUrl(normalised);
    setServerUrl(normalised);
    setStatus("needs-auth");
  }, []);

  const adopt = useCallback(async (nextUser: AuthUser) => {
    const token = api.getToken();
    if (token) await storage.saveToken(serverUrl, token);
    setUser(nextUser);
    setStatus("ready");
  }, [serverUrl]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const nextUser = await api.loginWithToken(email.trim(), password);
      await adopt(nextUser);
    },
    [adopt],
  );

  const signUp = useCallback(
    async (email: string, password: string) => {
      const nextUser = await api.registerWithToken(email.trim(), password);
      await adopt(nextUser);
    },
    [adopt],
  );

  const signOut = useCallback(async () => {
    await api.logout();
    await storage.clearToken(serverUrl);
    api.setToken(null);
    setUser(null);
    setStatus("needs-auth");
  }, [serverUrl]);

  const value = useMemo<SessionValue>(
    () => ({ status, user, serverUrl, connect, signIn, signUp, signOut, authDisabled }),
    [status, user, serverUrl, connect, signIn, signUp, signOut, authDisabled],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

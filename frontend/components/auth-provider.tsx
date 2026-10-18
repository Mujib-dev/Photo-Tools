"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { login as apiLogin, logout as apiLogout, me, register as apiRegister } from "@/lib/auth";
import type { AuthUser } from "@/lib/types";

type AuthStatus = "loading" | "authed" | "guest";

interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (email: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = React.useState<AuthUser | null>(null);
  const [status, setStatus] = React.useState<AuthStatus>("loading");

  const refresh = React.useCallback(async () => {
    try {
      const u = await me();
      setUser(u);
      setStatus(u ? "authed" : "guest");
    } catch {
      setUser(null);
      setStatus("guest");
    }
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = React.useCallback(
    async (email: string, password: string) => {
      const u = await apiLogin(email, password);
      setUser(u);
      setStatus("authed");
      return u;
    },
    [],
  );

  const register = React.useCallback(
    async (email: string, password: string) => {
      const u = await apiRegister(email, password);
      setUser(u);
      setStatus("authed");
      return u;
    },
    [],
  );

  const logout = React.useCallback(async () => {
    try {
      await apiLogout();
    } catch {
      // session may already be gone — clear locally regardless
    }
    setUser(null);
    setStatus("guest");
    router.push("/");
    router.refresh();
  }, [router]);

  return (
    <AuthContext.Provider value={{ status, user, login, register, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an <AuthProvider>");
  return ctx;
}

"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import {
  login as apiLogin,
  loginWithGoogle as apiLoginWithGoogle,
  logout as apiLogout,
  me,
  register as apiRegister,
  setSessionExpiredHandler,
  updateAvatar as apiUpdateAvatar,
  updateProfile as apiUpdateProfile,
  type UpdateProfileInput,
} from "@/lib/auth";
import type { AuthUser } from "@/lib/types";

type AuthStatus = "loading" | "authed" | "guest";

interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  login: (email: string, password: string) => Promise<AuthUser>;
  loginWithGoogle: (credential: string) => Promise<AuthUser>;
  register: (
    email: string,
    password: string,
    fullName?: string,
    phone?: string,
    acceptedTerms?: boolean,
    referralCode?: string | null,
  ) => Promise<AuthUser>;
  updateProfile: (input: UpdateProfileInput) => Promise<AuthUser>;
  updateAvatar: (avatar: string | null) => Promise<AuthUser>;
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

  // Flip to guest state when a silent token refresh fails (session expired).
  React.useEffect(() => {
    setSessionExpiredHandler(() => {
      setUser(null);
      setStatus("guest");
    });
    return () => setSessionExpiredHandler(null);
  }, []);

  const login = React.useCallback(
    async (email: string, password: string) => {
      const u = await apiLogin(email, password);
      setUser(u);
      setStatus("authed");
      return u;
    },
    [],
  );

  const loginWithGoogle = React.useCallback(async (credential: string) => {
    const u = await apiLoginWithGoogle(credential);
    setUser(u);
    setStatus("authed");
    return u;
  }, []);

  const register = React.useCallback(
    async (
      email: string,
      password: string,
      fullName?: string,
      phone?: string,
      acceptedTerms?: boolean,
      referralCode?: string | null,
    ) => {
      const u = await apiRegister(email, password, fullName, phone, acceptedTerms, referralCode);
      setUser(u);
      setStatus("authed");
      return u;
    },
    [],
  );

  const updateProfile = React.useCallback(async (input: UpdateProfileInput) => {
    const u = await apiUpdateProfile(input);
    setUser(u);
    setStatus("authed");
    return u;
  }, []);

  const updateAvatar = React.useCallback(async (avatar: string | null) => {
    const u = await apiUpdateAvatar(avatar);
    setUser(u);
    setStatus("authed");
    return u;
  }, []);

  const logout = React.useCallback(async () => {
    // Clear local state and leave the current page immediately, so logging out
    // from any route (including /admin) always lands on the home page even if
    // the network request is slow.
    setUser(null);
    setStatus("guest");
    router.replace("/");
    try {
      await apiLogout();
    } catch {
      // session may already be gone — local state is already cleared
    }
    router.refresh();
  }, [router]);

  return (
    <AuthContext.Provider
      value={{
        status,
        user,
        login,
        loginWithGoogle,
        register,
        updateProfile,
        updateAvatar,
        logout,
        refresh,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an <AuthProvider>");
  return ctx;
}

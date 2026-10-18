import type { AuthUser } from "./types";

async function request(path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(path, init);
  if (!res.ok) {
    let message = "Something went wrong. Please try again.";
    try {
      const body = (await res.json()) as { error?: string };
      if (body?.error) message = body.error;
    } catch {
      // ignore non-JSON error bodies
    }
    throw new Error(message);
  }
  return res;
}

export async function register(email: string, password: string): Promise<AuthUser> {
  const res = await request("/api/backend/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const body = (await res.json()) as { user: AuthUser };
  return body.user;
}

export async function login(email: string, password: string): Promise<AuthUser> {
  const res = await request("/api/backend/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const body = (await res.json()) as { user: AuthUser };
  return body.user;
}

export async function logout(): Promise<void> {
  await request("/api/backend/auth/logout", { method: "POST" });
}

/** Returns the signed-in user or null when there is no live session. */
export async function me(): Promise<AuthUser | null> {
  const res = await fetch("/api/backend/auth/me", { cache: "no-store" });
  if (!res.ok) return null;
  const body = (await res.json()) as { user: AuthUser };
  return body.user;
}

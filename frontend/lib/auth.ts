import type { AuthUser } from "./types";

export interface UpdateProfileInput {
  currentPassword: string;
  email?: string;
  newPassword?: string;
}

/**
 * Auth session state for the browser.
 *
 * The backend issues two cookies: a short-lived httpOnly access JWT (sent
 * automatically on every request, including image and download URLs) and a
 * longer-lived httpOnly refresh JWT. This module keeps the access token fresh
 * by refreshing proactively before it expires and reactively when a request
 * comes back 401 — all single-flight so concurrent 401s rotate the refresh
 * token only once.
 */

const REFRESH_MARGIN_MS = 30_000;

let expiresAt: number | null = null;
let refreshInFlight: Promise<boolean> | null = null;
let refreshTimer: ReturnType<typeof setTimeout> | null = null;
let sessionExpiredHandler: (() => void) | null = null;

/** Registered by the auth provider: called when a silent refresh fails. */
export function setSessionExpiredHandler(handler: (() => void) | null): void {
  sessionExpiredHandler = handler;
}

function clearScheduledRefresh(): void {
  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }
}

function noteExpiry(at: number | null | undefined): void {
  expiresAt = typeof at === "number" ? at : null;
  clearScheduledRefresh();
  if (expiresAt == null) return;
  // Proactive timer keeps the access cookie fresh so direct URLs (page
  // previews, downloads) never hit an expired token between fetches.
  const delay = Math.max(expiresAt - Date.now() - REFRESH_MARGIN_MS, 5_000);
  refreshTimer = setTimeout(() => {
    void refreshSession().then((ok) => {
      if (!ok) {
        expiresAt = null;
        clearScheduledRefresh();
        sessionExpiredHandler?.();
      }
    });
  }, delay);
}

async function performRefresh(): Promise<boolean> {
  try {
    const res = await fetch("/api/backend/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (!res.ok) return false;
    const body = (await res.json()) as { expiresAt?: number };
    noteExpiry(body.expiresAt);
    return true;
  } catch {
    return false;
  }
}

/** Exchange the refresh cookie for a new access token (single-flight). */
export function refreshSession(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = performRefresh().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

export async function errorFrom(res: Response): Promise<Error> {
  let message = "";
  try {
    const text = await res.text();
    try {
      const body = JSON.parse(text) as { error?: string; message?: string; detail?: string };
      if (body?.error && typeof body.error === "string") {
        message = body.error;
      } else if (body?.message && typeof body.message === "string") {
        message = body.message;
      } else if (body?.detail && typeof body.detail === "string") {
        message = body.detail;
      }
    } catch {
      // Body is not JSON (e.g. plain text or HTML gateway error)
      const clean = text.replace(/<[^>]*>/g, "").trim();
      if (clean && clean.length > 0 && clean.length < 200) {
        message = clean;
      }
    }
  } catch {
    // ignore unreadable response bodies
  }

  if (!message) {
    if (res.status === 401) message = "Please sign in to continue.";
    else if (res.status === 403) message = "You do not have permission to perform this action.";
    else if (res.status === 404) message = "Resource not found.";
    else if (res.status === 409) message = "This email address is already registered. Please sign in instead.";
    else if (res.status === 413) message = "File too large.";
    else if (res.status === 429) message = "Too many requests. Please slow down and try again shortly.";
    else if (res.status >= 500) message = "The server encountered an error. Please try again.";
    else message = "Something went wrong. Please try again.";
  }

  const error = new Error(message) as Error & { status?: number };
  error.status = res.status;
  return error;
}

/**
 * True when a failure is worth retrying: a server-side error or a dropped
 * connection, as opposed to a rejected request (4xx).
 *
 * A 429 is deliberately excluded: the rate limit window is a minute long, so
 * retrying within a couple of seconds can only fail again — and each retry
 * spends another request from the same budget.
 */
export function isTransientError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const status = (err as Error & { status?: number }).status;
  if (typeof status === "number") return status >= 500;
  // Network-level failure: the request never reached the server.
  return err.name === "TypeError" || /failed to fetch|network|load failed/i.test(err.message);
}

/**
 * Fetch wrapper used by the auth and tool APIs. Keeps the access token fresh
 * proactively and retries once after a silent refresh on 401.
 */
export async function request(path: string, init?: RequestInit): Promise<Response> {
  if (expiresAt != null && Date.now() >= expiresAt - REFRESH_MARGIN_MS) {
    await refreshSession();
  }
  let res = await fetch(path, init);
  if (res.status === 401) {
    const refreshed = await refreshSession();
    if (refreshed) {
      res = await fetch(path, init);
    } else {
      sessionExpiredHandler?.();
    }
  }
  return res;
}

export async function register(
  email: string,
  password: string,
  fullName?: string,
  phone?: string,
  acceptedTerms?: boolean,
  referralCode?: string | null,
): Promise<AuthUser> {
  const res = await request("/api/backend/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, fullName, phone, acceptedTerms, referralCode }),
  });
  if (!res.ok) throw await errorFrom(res);
  const body = (await res.json()) as { user: AuthUser; expiresAt?: number };
  noteExpiry(body.expiresAt);
  return body.user;
}

export async function login(email: string, password: string): Promise<AuthUser> {
  const res = await request("/api/backend/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw await errorFrom(res);
  const body = (await res.json()) as { user: AuthUser; expiresAt?: number };
  noteExpiry(body.expiresAt);
  return body.user;
}

/** Update the signed-in user's email and/or password. */
export async function updateProfile(input: UpdateProfileInput): Promise<AuthUser> {
  const res = await request("/api/backend/auth/me", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw await errorFrom(res);
  const body = (await res.json()) as { user: AuthUser; expiresAt?: number };
  noteExpiry(body.expiresAt);
  return body.user;
}

/** Set or clear the signed-in user's profile photo. */
export async function updateAvatar(avatar: string | null): Promise<AuthUser> {
  const res = await request("/api/backend/auth/me/avatar", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ avatar }),
  });
  if (!res.ok) throw await errorFrom(res);
  const body = (await res.json()) as { user: AuthUser };
  return body.user;
}

export type RecoveryChannel = "email" | "sms" | "whatsapp";

/** Request a password reset by email link, SMS code or WhatsApp code. */
export async function recoverPassword(
  identifier: string,
  channel: RecoveryChannel,
): Promise<{ channel: RecoveryChannel; destination: string | null }> {
  const res = await request("/api/backend/auth/recover", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier, channel }),
  });
  if (!res.ok) throw await errorFrom(res);
  return (await res.json()) as { channel: RecoveryChannel; destination: string | null };
}

/** Exchange a code received by SMS/WhatsApp for a short-lived reset token. */
export async function verifyRecoveryCode(code: string): Promise<string> {
  const res = await request("/api/backend/auth/recover/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  if (!res.ok) throw await errorFrom(res);
  const body = (await res.json()) as { resetToken: string };
  return body.resetToken;
}

/** Complete a password reset with the emailed token (or one from verify). */
export async function resetPassword(token: string, password: string): Promise<void> {
  const res = await request("/api/backend/auth/reset-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, password }),
  });
  if (!res.ok) throw await errorFrom(res);
}

/** Email a reminder of the login email to accounts registered with a phone. */
export async function remindLoginEmail(phone: string): Promise<void> {
  const res = await request("/api/backend/auth/recover/email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone }),
  });
  if (!res.ok) throw await errorFrom(res);
}

/** Exchange a Google ID token (GIS credential) for a PicTools session. */
export async function loginWithGoogle(credential: string): Promise<AuthUser> {
  const res = await request("/api/backend/auth/google", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ credential }),
  });
  if (!res.ok) throw await errorFrom(res);
  const body = (await res.json()) as { user: AuthUser; expiresAt?: number };
  noteExpiry(body.expiresAt);
  return body.user;
}

export async function logout(): Promise<void> {
  clearScheduledRefresh();
  expiresAt = null;
  try {
    // No access token needed: the server revokes the refresh cookie itself.
    await fetch("/api/backend/auth/logout", { method: "POST" });
  } catch {
    // Best effort — the local state is cleared by the caller regardless.
  }
}

/** Returns the signed-in user or null when there is no live session. */
export async function me(): Promise<AuthUser | null> {
  try {
    let res = await fetch("/api/backend/auth/me", { cache: "no-store" });
    if (res.status === 401) {
      const refreshed = await refreshSession();
      if (refreshed) res = await fetch("/api/backend/auth/me", { cache: "no-store" });
    }
    if (!res.ok) return null;
    const body = (await res.json()) as { user: AuthUser; expiresAt?: number | null };
    noteExpiry(body.expiresAt);
    return body.user;
  } catch {
    return null;
  }
}

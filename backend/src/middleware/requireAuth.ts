import type { NextFunction, Request, Response } from "express";

import { config } from "../config.js";
import { hashSessionToken } from "../auth/session.js";
import { looksLikeApiKey } from "../auth/apiKeys.js";
import { verifyAccessToken } from "../auth/jwt.js";
import { isAdminRole, toPublicUser, type AuthStore, type PublicUser } from "../auth/AuthStore.js";
import { AppError, Errors } from "../utils/errors.js";

declare module "express-serve-static-core" {
  interface Request {
    authUser?: PublicUser;
  }
}

/** Parse the `cookie` header into a map. */
export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    const name = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (name) out[name] = decodeURIComponent(value);
  }
  return out;
}

/**
 * The short-lived access token: `X-Access-Token` header (native clients) or
 * the httpOnly access cookie (browsers, sent automatically including for
 * image/download URLs).
 */
export function getAccessToken(req: Request): string | null {
  const header = req.headers[config.accessTokenHeaderName];
  const raw = Array.isArray(header) ? header[0] : header;
  const fromHeader = raw?.trim();
  if (fromHeader) return fromHeader;
  const fromCookie = parseCookies(req.headers.cookie)[config.accessCookieName];
  return fromCookie || null;
}

/** Legacy opaque session token: session cookie or X-Session-Token header. */
export function getSessionToken(req: Request): string | null {
  const value = parseCookies(req.headers.cookie)[config.sessionCookieName];
  if (value) return value;
  // Older native clients have no cookie jar and cannot read the `Set-Cookie`
  // response header, so they present the session token directly. A custom
  // header is used rather than `Authorization` to avoid colliding with the
  // bearer API-key middleware.
  const header = req.headers[config.sessionHeaderName];
  const raw = Array.isArray(header) ? header[0] : header;
  const token = raw?.trim();
  return token ? token : null;
}

export interface AuthResolution {
  user: PublicUser;
  /** Access-token expiry (ms since epoch), or null for legacy sessions. */
  expiresAt: number | null;
  /** The mechanism through which the caller authenticated. */
  method: "access_token" | "api_key" | "session";
}

/**
 * Personal API key: the token is presented as `Authorization: Bearer ptk_…`.
 * The value returned is the raw token (never the shared `API_KEYS` secret).
 */
export function getApiKeyToken(req: Request): string | null {
  const header = req.headers.authorization;
  const raw = Array.isArray(header) ? header[0] : header;
  if (!raw) return null;
  const [scheme, token] = raw.split(" ");
  if (scheme !== "Bearer" || !token) return null;
  const trimmed = token.trim();
  return looksLikeApiKey(trimmed) ? trimmed : null;
}

/**
 * Resolve the signed-in user from a verified access JWT first, then from a
 * personal API key, and finally from a legacy opaque session so tokens issued
 * before the JWT rollout keep working until they expire.
 */
export async function resolveAuth(req: Request, authStore: AuthStore): Promise<AuthResolution | null> {
  const access = getAccessToken(req);
  if (access) {
    const claims = verifyAccessToken(access);
    if (claims) {
      const user = await authStore.getUserById(claims.sub);
      if (user) return { user: toPublicUser(user), expiresAt: claims.exp * 1000, method: "access_token" };
    }
    // An expired/invalid access token falls through: a legacy session may
    // still be present for users who signed in before the JWT rollout.
  }
  const apiKey = getApiKeyToken(req);
  if (apiKey) {
    const key = await authStore.getApiKeyByHash(hashSessionToken(apiKey));
    if (key) {
      const user = await authStore.getUserById(key.userId);
      if (user) {
        // Best-effort usage stamp; never blocks or fails the request.
        void authStore.touchApiKey(key.id, Date.now()).catch(() => undefined);
        return { user: toPublicUser(user), expiresAt: null, method: "api_key" };
      }
    }
  }
  const session = getSessionToken(req);
  if (session) {
    const user = await authStore.getUserBySession(hashSessionToken(session));
    if (user) return { user: toPublicUser(user), expiresAt: null, method: "session" };
  }
  return null;
}

/**
 * Require a live signed-in user. When auth is disabled this is a no-op,
 * so the service still runs open with AUTH_ENABLED=false.
 */
export function requireAuth(authStore: AuthStore) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!config.authEnabled) {
        next();
        return;
      }
      const resolved = await resolveAuth(req, authStore);
      if (!resolved) {
        next(Errors.unauthorized());
        return;
      }
      if (resolved.user.status === "banned" || resolved.user.status === "suspended") {
        next(
          new AppError(
            403,
            `Your account has been ${resolved.user.status}${resolved.user.banReason ? `: ${resolved.user.banReason}` : "."}`,
          ),
        );
        return;
      }
      req.authUser = resolved.user;
      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Best-effort authentication: attaches `req.authUser` if the caller presents a
 * valid access token, API key, or session, but lets guest callers pass through
 * so public/standard utilities (like resize, convert, compress) can execute.
 */
export function attachAuth(authStore: AuthStore) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!config.authEnabled) {
        next();
        return;
      }
      const resolved = await resolveAuth(req, authStore);
      if (resolved && resolved.user.status !== "banned" && resolved.user.status !== "suspended") {
        req.authUser = resolved.user;
      }
      next();
    } catch {
      next();
    }
  };
}

/**
 * Require an administrator. Resolves the live user (so a role change takes
 * effect immediately, without waiting for the access token to expire) and
 * rejects everyone else with 403.
 *
 * Enforces security invariant: Personal API keys are strictly rejected on
 * admin endpoints (mitigating key leak / privilege escalation attacks).
 */
export function requireAdmin(authStore: AuthStore) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!config.authEnabled) {
        next(new AppError(403, "Administrator access is unavailable while authentication is disabled."));
        return;
      }
      const resolved = await resolveAuth(req, authStore);
      if (!resolved) {
        next(Errors.unauthorized());
        return;
      }
      if (resolved.method === "api_key") {
        next(
          new AppError(
            403,
            "API keys cannot be used to access administrative endpoints. Use an interactive administrator session.",
          ),
        );
        return;
      }
      if (resolved.user.status === "banned" || resolved.user.status === "suspended") {
        next(new AppError(403, `This administrator account has been ${resolved.user.status}. Access denied.`));
        return;
      }
      if (!isAdminRole(resolved.user.role)) {
        next(new AppError(403, "Administrator access required."));
        return;
      }
      req.authUser = resolved.user;
      next();
    } catch (err) {
      next(err);
    }
  };
}

import type { NextFunction, Request, Response } from "express";

import { config } from "../config.js";
import { hashSessionToken } from "../auth/session.js";
import { verifyAccessToken } from "../auth/jwt.js";
import { toPublicUser, type AuthStore, type PublicUser } from "../auth/AuthStore.js";
import { Errors } from "../utils/errors.js";

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
}

/**
 * Resolve the signed-in user from a verified access JWT first, falling back
 * to a legacy opaque session so tokens issued before the JWT rollout keep
 * working until they expire.
 */
export async function resolveAuth(req: Request, authStore: AuthStore): Promise<AuthResolution | null> {
  const access = getAccessToken(req);
  if (access) {
    const claims = verifyAccessToken(access);
    if (claims) {
      const user = await authStore.getUserById(claims.sub);
      if (user) return { user: toPublicUser(user), expiresAt: claims.exp * 1000 };
    }
    // An expired/invalid access token falls through: a legacy session may
    // still be present for users who signed in before the JWT rollout.
  }
  const session = getSessionToken(req);
  if (session) {
    const user = await authStore.getUserBySession(hashSessionToken(session));
    if (user) return { user: toPublicUser(user), expiresAt: null };
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
      req.authUser = resolved.user;
      next();
    } catch (err) {
      next(err);
    }
  };
}

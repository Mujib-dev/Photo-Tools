import type { NextFunction, Request, Response } from "express";

import { config } from "../config.js";
import { hashSessionToken } from "../auth/session.js";
import type { AuthStore, PublicUser } from "../auth/AuthStore.js";
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

export function getSessionToken(req: Request): string | null {
  const value = parseCookies(req.headers.cookie)[config.sessionCookieName];
  if (value) return value;
  // Native clients (the Expo app) have no cookie jar and cannot read the
  // `Set-Cookie` response header, so they present the session token directly.
  // A custom header is used rather than `Authorization` to avoid colliding
  // with the bearer API-key middleware.
  const header = req.headers[config.sessionHeaderName];
  const raw = Array.isArray(header) ? header[0] : header;
  const token = raw?.trim();
  return token ? token : null;
}

/**
 * Require a live signed-in session. When auth is disabled this is a no-op,
 * so the service still runs open with AUTH_ENABLED=false.
 */
export function requireAuth(authStore: AuthStore) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!config.authEnabled) {
        next();
        return;
      }
      const token = getSessionToken(req);
      if (!token) {
        next(Errors.unauthorized());
        return;
      }
      const user = await authStore.getUserBySession(hashSessionToken(token));
      if (!user) {
        next(Errors.unauthorized());
        return;
      }
      req.authUser = { id: user.id, email: user.email };
      next();
    } catch (err) {
      next(err);
    }
  };
}

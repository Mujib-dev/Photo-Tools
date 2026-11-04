import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";

import { config } from "../config.js";
import { looksLikeApiKey } from "../auth/apiKeys.js";
import { Errors } from "../utils/errors.js";

/**
 * Optional shared-secret authentication. Enabled when API_KEYS is set
 * (comma-separated). Compares tokens in constant time.
 *
 * A personal API key (`ptk_…`) is let through here: it is a per-user credential
 * that is validated later by the auth layer (and is not one of the shared
 * secrets, so a random `ptk_…` value still fails to authenticate).
 */
export function apiKeyAuth(req: Request, _res: Response, next: NextFunction): void {
  if (config.apiKeys.length === 0) {
    next();
    return;
  }
  const header = req.headers.authorization ?? "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) {
    next(Errors.unauthorized());
    return;
  }
  if (looksLikeApiKey(token.trim())) {
    next();
    return;
  }
  const ok = config.apiKeys.some((key) => {
    const a = Buffer.from(key);
    const b = Buffer.from(token);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  });
  if (!ok) next(Errors.unauthorized());
  else next();
}

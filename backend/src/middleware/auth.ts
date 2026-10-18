import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";

import { config } from "../config.js";
import { Errors } from "../utils/errors.js";

/**
 * Optional shared-secret authentication. Enabled when API_KEYS is set
 * (comma-separated). Compares tokens in constant time.
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
  const ok = config.apiKeys.some((key) => {
    const a = Buffer.from(key);
    const b = Buffer.from(token);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  });
  if (!ok) next(Errors.unauthorized());
  else next();
}

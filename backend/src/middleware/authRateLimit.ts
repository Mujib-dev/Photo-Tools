import type { NextFunction, Request, Response } from "express";

import { config } from "../config.js";
import { AppError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

function bump(key: string, now: number): number {
  let bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + config.authRateLimitWindowMs };
    buckets.set(key, bucket);
  }
  bucket.count += 1;
  return bucket.count;
}

function emailOf(req: Request): string | null {
  const body = req.body as { email?: unknown } | undefined;
  if (!body || typeof body !== "object" || typeof body.email !== "string") return null;
  const email = body.email.trim().toLowerCase();
  return email || null;
}

/**
 * Throttle for login/register endpoints. Counts every attempt over a sliding
 * window, keyed per IP+email (strict) and per IP (looser, so shared networks
 * are not locked out by one account). Returns 429 with a Retry-After header
 * once a limit is passed.
 */
export function authRateLimit(req: Request, res: Response, next: NextFunction): void {
  const now = Date.now();
  const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";
  const email = emailOf(req);

  const ipCount = bump(`ip:${ip}`, now);
  const emailCount = email ? bump(`email:${ip}|${email}`, now) : 0;
  const ipMax = config.authRateLimitMax * 10;

  if (ipCount > ipMax || (email !== null && emailCount > config.authRateLimitMax)) {
    const retryAfter = Math.max(1, Math.ceil(config.authRateLimitWindowMs / 1000));
    res.setHeader("Retry-After", String(retryAfter));
    logger.warn("Auth rate limit exceeded", { ip, email });
    next(
      new AppError(
        429,
        `Too many sign-in attempts. Please wait ${Math.ceil(retryAfter / 60)} minute(s) and try again.`,
      ),
    );
    return;
  }
  next();
}

/** Periodically prune stale buckets so the map does not grow forever. */
export function startAuthRateLimitPruner(): () => void {
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(key);
    }
  }, config.authRateLimitWindowMs);
  timer.unref();
  return () => clearInterval(timer);
}

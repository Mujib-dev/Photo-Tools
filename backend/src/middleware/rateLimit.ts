import type { NextFunction, Request, Response } from "express";

import { config } from "../config.js";
import { Errors } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

function clientKey(req: Request): string {
  return req.ip ?? req.socket.remoteAddress ?? "unknown";
}

/** Sliding-window in-memory rate limiter (per IP). */
export function rateLimit(req: Request, res: Response, next: NextFunction): void {
  const key = clientKey(req);
  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + config.rateLimitWindowMs };
    buckets.set(key, bucket);
  }
  bucket.count += 1;

  res.setHeader("X-RateLimit-Limit", String(config.rateLimitMax));
  res.setHeader("X-RateLimit-Remaining", String(Math.max(0, config.rateLimitMax - bucket.count)));

  if (bucket.count > config.rateLimitMax) {
    logger.warn("Rate limit exceeded", { key });
    next(Errors.rateLimited());
    return;
  }
  next();
}

/** Periodically prune stale buckets so the map does not grow forever. */
export function startRateLimitPruner(): () => void {
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(key);
    }
  }, config.rateLimitWindowMs);
  timer.unref();
  return () => clearInterval(timer);
}

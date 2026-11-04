import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

import { config } from "../config.js";
import { parseCookies } from "./requireAuth.js";
import { AppError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

declare module "express-serve-static-core" {
  interface Request {
    id?: string;
  }
}

// ---------------------------------------------------------------------------
// Pure helpers (exported for tests)
// ---------------------------------------------------------------------------

const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);

/** Recursively detect keys that are used to pollute object prototypes. */
export function hasForbiddenKey(value: unknown, depth = 0): boolean {
  if (depth > 16 || value === null || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some((item) => hasForbiddenKey(item, depth + 1));
  for (const key of Object.keys(value as Record<string, unknown>)) {
    if (FORBIDDEN_KEYS.has(key)) return true;
    if (hasForbiddenKey((value as Record<string, unknown>)[key], depth + 1)) return true;
  }
  return false;
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** Unsafe (state-changing) HTTP methods, which CSRF protection guards. */
export function isUnsafeMethod(method: string): boolean {
  return !SAFE_METHODS.has(method.toUpperCase());
}

/** Does the request body's content type get parsed by this server? */
export function isSupportedContentType(contentType: string | undefined): boolean {
  const ct = (contentType ?? "").toLowerCase().trim();
  if (!ct) return false;
  return (
    ct.startsWith("application/json") ||
    ct.startsWith("multipart/form-data") ||
    ct.startsWith("application/octet-stream")
  );
}

/** Normalise an Origin/Referer header to a `scheme://host` origin. */
export function originOf(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return `${url.protocol}//${url.host}`;
  } catch {
    return null;
  }
}

/** True when a browser-presented Origin/Referer matches an allowed origin. */
export function isAllowedOrigin(raw: string | null | undefined, allowed: readonly string[]): boolean {
  const origin = originOf(raw);
  if (!origin) return false;
  return allowed.map((a) => originOf(a) ?? a).includes(origin);
}

/** First value of a possibly comma-separated proxy header. */
function firstHeader(value: string | string[] | undefined): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw?.split(",")[0]?.trim() || null;
}

/**
 * The origin this request was addressed to, honouring proxy headers. Used so a
 * same-origin request works when the app is opened over a LAN address (e.g.
 * http://192.168.1.20:3000) instead of localhost, without having to list every
 * possible host in FRONTEND_ORIGINS.
 */
export function requestOrigin(req: Request): string | null {
  const host = firstHeader(req.headers["x-forwarded-host"]) ?? firstHeader(req.headers.host);
  if (!host) return null;
  const proto = firstHeader(req.headers["x-forwarded-proto"]) ?? req.protocol;
  return originOf(`${proto}://${host}`);
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

/** Attach a request id (echoing a sane inbound one) for tracing + audit logs. */
export function requestId(req: Request, res: Response, next: NextFunction): void {
  const inbound = req.headers["x-request-id"];
  const raw = Array.isArray(inbound) ? inbound[0] : inbound;
  const id = raw?.trim().slice(0, 128) || randomUUID();
  req.id = id;
  res.setHeader("X-Request-Id", id);
  next();
}

/** Log every finished request. Never logs bodies, so credentials stay out. */
export function requestAuditLogger(req: Request, res: Response, next: NextFunction): void {
  if (!config.requestLogging) {
    next();
    return;
  }
  const started = Date.now();
  res.on("finish", () => {
    const status = res.statusCode;
    const meta = {
      requestId: req.id,
      method: req.method,
      path: req.originalUrl.split("?")[0],
      status,
      ms: Date.now() - started,
      ip: req.ip,
    };
    if (status >= 500) logger.error("Request failed", meta);
    else if (status >= 400 && status !== 404 && status !== 401) logger.warn("Request rejected", meta);
    else logger.debug("Request", meta);
  });
  next();
}

/** Reject plaintext requests when TLS is required. */
export function requireHttps(req: Request, _res: Response, next: NextFunction): void {
  if (!config.requireHttps || req.secure) {
    next();
    return;
  }
  next(new AppError(403, "HTTPS is required."));
}

/** Reject absurdly long URLs before they reach routing/parsing. */
export function limitUrlLength(req: Request, _res: Response, next: NextFunction): void {
  if (req.originalUrl.length > config.maxUrlLength) {
    next(new AppError(414, "The request URL is too long."));
    return;
  }
  next();
}

/** Drop prototype-polluting keys in the body, query string and route params. */
export function blockPrototypePollution(req: Request, _res: Response, next: NextFunction): void {
  if (hasForbiddenKey(req.body) || hasForbiddenKey(req.query) || hasForbiddenKey(req.params)) {
    logger.warn("Rejected prototype-polluting request", { ip: req.ip, path: req.originalUrl });
    next(new AppError(400, "The request contained an invalid field."));
    return;
  }
  next();
}

/** Require a parseable content type for requests that carry a body. */
export function enforceContentType(req: Request, _res: Response, next: NextFunction): void {
  if (!isUnsafeMethod(req.method)) {
    next();
    return;
  }
  const length = req.headers["content-length"];
  const hasBody = (length !== undefined && length !== "0") || req.headers["transfer-encoding"] !== undefined;
  if (!hasBody) {
    next();
    return;
  }
  if (isSupportedContentType(req.headers["content-type"])) {
    next();
    return;
  }
  next(new AppError(415, "Unsupported request content type."));
}

/**
 * CSRF defence for cookie-authenticated requests. Token-based clients (header
 * or body credentials) carry no ambient authority and are exempt; browser
 * requests bearing a session cookie must present a matching Origin/Referer.
 */
export function enforceSameOrigin(req: Request, _res: Response, next: NextFunction): void {
  if (!config.csrfProtectionEnabled || !isUnsafeMethod(req.method)) {
    next();
    return;
  }

  const cookies = parseCookies(req.headers.cookie);
  const ambient = [config.accessCookieName, config.refreshCookieName, config.sessionCookieName].some(
    (name) => cookies[name],
  );
  if (!ambient) {
    next();
    return;
  }

  const originHeader = req.headers.origin;
  const refererHeader = req.headers.referer;
  const candidate =
    (typeof originHeader === "string" && originHeader) ||
    (typeof refererHeader === "string" && refererHeader) ||
    null;

  // Non-browser clients (native apps) send explicit token headers without an Origin;
  // if an ambient browser cookie is present without Origin/Referer, require an explicit
  // anti-CSRF or client header, or block the request.
  if (!candidate) {
    if (
      req.headers["x-requested-with"] ||
      req.headers[config.accessTokenHeaderName] ||
      req.headers[config.sessionHeaderName]
    ) {
      next();
      return;
    }
    logger.warn("Blocked state-changing cookie request with missing Origin/Referer headers", {
      ip: req.ip,
      path: req.originalUrl.split("?")[0],
    });
    next(new AppError(403, "Origin or Referer header required for cookie-authenticated requests."));
    return;
  }

  if (isAllowedOrigin(candidate, config.allowedOrigins)) {
    next();
    return;
  }

  // Same-origin browser request: the Origin matches the host the request was
  // addressed to (e.g. a LAN IP), even if that host is not in the allowlist.
  const ownOrigin = requestOrigin(req);
  if (ownOrigin && originOf(candidate) === ownOrigin && originOf(candidate) !== null) {
    next();
    return;
  }

  logger.warn("Blocked cross-origin state-changing request", {
    ip: req.ip,
    path: req.originalUrl.split("?")[0],
    origin: candidate,
  });
  next(new AppError(403, "Cross-origin request blocked."));
}

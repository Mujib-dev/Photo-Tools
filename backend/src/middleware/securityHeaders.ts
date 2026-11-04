import type { NextFunction, Request, Response } from "express";

import { config } from "../config.js";

/**
 * Hardened response headers (a dependency-free equivalent of helmet) applied to
 * every response. HSTS is only emitted over a secure connection so local HTTP
 * development is not pinned to HTTPS.
 */
export function securityHeaders(req: Request, res: Response, next: NextFunction): void {
  if (!config.securityHeadersEnabled) {
    next();
    return;
  }

  res.removeHeader("X-Powered-By");

  // MIME sniffing, clickjacking, referrer and legacy XSS-filter controls.
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "0");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-DNS-Prefetch-Control", "off");
  res.setHeader("X-Download-Options", "noopen");
  res.setHeader("X-Permitted-Cross-Domain-Policies", "none");

  // Cross-origin isolation + a lock-down policy suited to a JSON/image API.
  res.setHeader("Origin-Agent-Cluster", "?1");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Resource-Policy", "same-site");
  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  );

  if (config.contentSecurityPolicy) {
    res.setHeader("Content-Security-Policy", config.contentSecurityPolicy);
  }

  if (config.nodeEnv === "production" || req.secure) {
    const parts = [`max-age=${config.hstsMaxAgeSeconds}`];
    if (config.hstsIncludeSubDomains) parts.push("includeSubDomains");
    if (config.hstsPreload) parts.push("preload");
    res.setHeader("Strict-Transport-Security", parts.join("; "));
  }

  next();
}

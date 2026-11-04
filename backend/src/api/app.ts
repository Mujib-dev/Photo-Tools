import express, { type NextFunction, type Request, type Response } from "express";
import multer from "multer";

import { config } from "../config.js";
import { logger } from "../utils/logger.js";
import { AppError, Errors } from "../utils/errors.js";
import { apiKeyAuth } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rateLimit.js";
import { attachAuth, requireAdmin, requireAuth } from "../middleware/requireAuth.js";
import { securityHeaders } from "../middleware/securityHeaders.js";
import {
  blockPrototypePollution,
  enforceContentType,
  enforceSameOrigin,
  limitUrlLength,
  requestAuditLogger,
  requestId,
  requireHttps,
} from "../middleware/security.js";
import { resizeRoutes } from "./resize.routes.js";
import { convertRoutes } from "./convert.routes.js";
import { enhanceRoutes } from "./enhance.routes.js";
import { scanRoutes } from "./scan.routes.js";
import { pdfRoutes } from "./pdf.routes.js";
import { removeBgRoutes } from "./removebg.routes.js";
import { compressRoutes } from "./compress.routes.js";
import { watermarkRoutes } from "./watermark.routes.js";
import { videoRoutes } from "./video.routes.js";
import { audioRoutes } from "./audio.routes.js";
import { ocrRoutes } from "./ocr.routes.js";
import { urlDownloadRoutes } from "./urldownload.routes.js";
import { sttRoutes, ttsRoutes } from "./speech.routes.js";
import contactRoutes from "./contact.routes.js";
import { jobsRoutes } from "./jobs.routes.js";
import { authRoutes } from "./auth.routes.js";
import { apiKeyRoutes } from "./apiKey.routes.js";
import { presetRoutes } from "./preset.routes.js";
import { billingRoutes, publicBillingRoutes } from "./billing.routes.js";
import { stripeWebhookHandler } from "./billingWebhook.js";
import { creditsRoutes } from "./credits.routes.js";
import { usageRoutes } from "./usage.routes.js";
import { promoRoutes } from "./promo.routes.js";
import { batchRoutes } from "./batch.routes.js";
import { adminRoutes } from "./admin.routes.js";
import { webhookRoutes } from "./webhook.routes.js";
import { ticketRoutes } from "./ticket.routes.js";
import { affiliateRoutes } from "./affiliate.routes.js";
import { teamRoutes } from "./team.routes.js";
import { getAnnouncement } from "../services/announcementStore.js";
import type { JobManager } from "../jobs/JobManager.js";
import type { AuthStore } from "../auth/AuthStore.js";
import type { ExeScannerService } from "../services/exe/PhotoScannerService.js";
import type { ExeProcessRunner } from "../services/exe/ExeProcessRunner.js";
import type { SpeechService } from "../services/speech/SpeechService.js";

export function buildApp(
  jobs: JobManager,
  authStore?: AuthStore,
  scanner?: ExeScannerService,
  pdfRunner?: ExeProcessRunner,
  speech?: SpeechService,
): express.Express {
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", config.trustProxy);
  app.set("query parser", config.queryParser);

  // Tracing + audit logging + hardened response headers on every response,
  // including early rejections.
  app.use(requestId);
  app.use(requestAuditLogger);
  app.use(securityHeaders);

  // CORS: only allow configured origins when a browser sends an Origin header.
  app.use((req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin;
    if (origin) {
      if (config.allowedOrigins.includes(origin)) {
        res.setHeader("Access-Control-Allow-Origin", origin);
        res.setHeader("Vary", "Origin");
        res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,PUT,DELETE,OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", `Content-Type, Authorization, ${config.sessionHeaderName}, ${config.accessTokenHeaderName}, X-Request-Id, X-Admin-Sudo, X-Requested-With`);
        res.setHeader("Access-Control-Expose-Headers", "X-Request-Id, Retry-After, X-RateLimit-Limit, X-RateLimit-Remaining");
        res.setHeader("Access-Control-Allow-Credentials", "true");
        res.setHeader("Access-Control-Max-Age", "600");
      }
      if (req.method === "OPTIONS") {
        res.sendStatus(204);
        return;
      }
    }
    next();
  });

  // Transport + request-shape hardening.
  app.use(requireHttps);
  app.use(limitUrlLength);
  app.use(enforceContentType);

  // Stripe webhook — registered BEFORE the JSON parser because signature
  // verification needs the raw bytes. It authenticates with a Stripe
  // signature, not cookies/CSRF, so it needs no session middleware here.
  if (authStore) {
    app.post(
      "/api/billing/webhook",
      express.raw({ type: "application/json" }),
      stripeWebhookHandler(authStore),
    );
  }

  app.use(express.json({ limit: config.jsonBodyLimit }));
  app.use(blockPrototypePollution);

  // CSRF guard for cookie-authenticated state-changing requests.
  app.use(enforceSameOrigin);

  // API key auth (no-op when API_KEYS is unset)
  app.use("/api", apiKeyAuth);

  // User account endpoints (register / login / refresh / logout / me).
  // Auth gets the general per-IP limiter first, then the stricter
  // per-IP+email attempt cap on credential endpoints inside authRoutes.
  if (authStore) {
    app.use("/api/auth", rateLimit);
    app.use("/api/auth", authRoutes(authStore));
  }

  // Personal API keys (create / list / revoke). The routes resolve the caller
  // themselves, so they also work when called with an API key.
  if (authStore) {
    app.use("/api/keys", rateLimit, apiKeyRoutes(authStore));
  }

  // Saved tool-settings presets (list / save / delete) for signed-in users.
  if (authStore) {
    app.use("/api/presets", rateLimit, requireAuth(authStore), presetRoutes(authStore));
  }

  // Public billing metadata (plan catalogue + availability). Mounted before the
  // authenticated routes so the pricing and payment pages render prices even
  // for signed-out visitors.
  if (authStore) {
    app.use("/api/billing", rateLimit, publicBillingRoutes());
  }

  // Paid plan upgrades via Stripe Checkout (disabled until keys are set).
  if (authStore) {
    app.use("/api/billing", rateLimit, requireAuth(authStore), billingRoutes(authStore));
  }

  // Metering state for the signed-in account (balance, plan, invites, usage).
  if (authStore) {
    app.use("/api/credits", rateLimit, requireAuth(authStore), creditsRoutes(authStore, jobs));
  }

  // Usage dashboard: the signed-in account's own credit consumption, broken
  // down by tool and day.
  if (authStore) {
    app.use("/api/usage", rateLimit, requireAuth(authStore), usageRoutes(authStore, jobs));
  }

  // Promo code redemption for the signed-in account.
  if (authStore) {
    app.use("/api/promo", rateLimit, requireAuth(authStore), promoRoutes(authStore));
  }

  // Developer Outbound Webhooks (events: job.completed, job.failed, credits.low)
  if (authStore) {
    app.use("/api/webhooks", rateLimit, requireAuth(authStore), webhookRoutes());
  }

  // Customer support ticket desk & bug reports
  if (authStore) {
    app.use("/api/support/tickets", rateLimit, requireAuth(authStore), ticketRoutes());
  }

  // Affiliate & viral referral program
  if (authStore) {
    app.use("/api/affiliate", rateLimit, affiliateRoutes());
  }

  // Team Workspaces & Shared Credit Pools
  if (authStore) {
    app.use("/api/teams", rateLimit, requireAuth(authStore), teamRoutes());
  }

  // Public site announcement banner (active broadcasts)
  app.get("/api/announcement", (_req: Request, res: Response) => {
    res.json({ announcement: getAnnouncement() });
  });

  // Admin console: rate-limited, then restricted to administrator accounts.
  if (authStore) {
    app.use("/api/admin", rateLimit, requireAdmin(authStore), adminRoutes(authStore, jobs));
  }

  // Processing endpoints: Hybrid access model.
  // Heavy AI & batch pipelines require an account; standard utilities (resize, convert, compress, watermark, pdf)
  // allow instant guest processing while attaching user accounts if present.
  if (authStore && config.authEnabled) {
    app.use(
      ["/api/enhance", "/api/scan", "/api/remove-bg", "/api/removebg", "/api/ocr", "/api/tts", "/api/stt", "/api/batch"],
      requireAuth(authStore),
    );
    app.use(
      ["/api/jobs", "/api/download", "/api/download-all", "/api/resize", "/api/convert", "/api/compress", "/api/watermark", "/api/pdf", "/api/video", "/api/audio", "/api/url-download"],
      attachAuth(authStore),
    );
  }

  // Rate limiting for upload/processing endpoints
  app.use(["/api/batch", "/api/resize", "/api/convert", "/api/enhance", "/api/scan", "/api/pdf", "/api/remove-bg", "/api/removebg", "/api/compress", "/api/watermark", "/api/video", "/api/audio", "/api/ocr", "/api/url-download", "/api/tts", "/api/stt"], rateLimit);

  app.use("/api", jobsRoutes(jobs));
app.use("/api/batch", batchRoutes(jobs));
app.use("/api/resize", resizeRoutes(jobs));
app.use("/api/convert", convertRoutes(jobs));
app.use("/api/enhance", enhanceRoutes(jobs));
if (scanner) app.use("/api/scan", scanRoutes(jobs, scanner));
app.use("/api/pdf", pdfRoutes(jobs, pdfRunner));
app.use(["/api/remove-bg", "/api/removebg"], removeBgRoutes(jobs));
app.use("/api/compress", compressRoutes(jobs));
app.use("/api/watermark", watermarkRoutes(jobs));
app.use("/api/video", videoRoutes(jobs));
app.use("/api/audio", audioRoutes(jobs));
app.use("/api/ocr", ocrRoutes(jobs));
if (config.urlDownloadEnabled) app.use("/api/url-download", urlDownloadRoutes(jobs));
if (speech) {
  app.use("/api/tts", ttsRoutes(speech, authStore ?? undefined));
  app.use("/api/stt", sttRoutes(speech, authStore ?? undefined));
}
  app.use("/api/contact", rateLimit, contactRoutes);

  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: "Not found." });
  });

  // Central error handler — never leaks internals to clients.
  app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof AppError) {
      res.status(err.status).json({ error: err.safe });
      return;
    }
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        const max = req.originalUrl.startsWith("/api/video")
          ? config.videoMaxFileSizeBytes
          : config.maxFileSizeBytes;
        res.status(413).json({ error: Errors.fileTooLarge(max / 1024 / 1024).safe });
        return;
      }
      res.status(400).json({ error: "The upload failed." });
      return;
    }
    if (err instanceof SyntaxError && "body" in (err as { body?: unknown })) {
      res.status(400).json({ error: "Invalid JSON body." });
      return;
    }
    logger.error("Unhandled request error", { error: err instanceof Error ? err.message : String(err) });
    res.status(500).json({ error: "Unable to process the image." });
  });

  return app;
}

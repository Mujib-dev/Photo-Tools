import express, { type NextFunction, type Request, type Response } from "express";
import multer from "multer";

import { config } from "../config.js";
import { logger } from "../utils/logger.js";
import { AppError, Errors } from "../utils/errors.js";
import { apiKeyAuth } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rateLimit.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { resizeRoutes } from "./resize.routes.js";
import { convertRoutes } from "./convert.routes.js";
import { enhanceRoutes } from "./enhance.routes.js";
import { scanRoutes } from "./scan.routes.js";
import { pdfRoutes } from "./pdf.routes.js";
import { removeBgRoutes } from "./removebg.routes.js";
import { compressRoutes } from "./compress.routes.js";
import { watermarkRoutes } from "./watermark.routes.js";
import { videoRoutes } from "./video.routes.js";
import contactRoutes from "./contact.routes.js";
import { jobsRoutes } from "./jobs.routes.js";
import { authRoutes } from "./auth.routes.js";
import type { JobManager } from "../jobs/JobManager.js";
import type { AuthStore } from "../auth/AuthStore.js";
import type { ExeScannerService } from "../services/exe/PhotoScannerService.js";
import type { ExeProcessRunner } from "../services/exe/ExeProcessRunner.js";

export function buildApp(
  jobs: JobManager,
  authStore?: AuthStore,
  scanner?: ExeScannerService,
  pdfRunner?: ExeProcessRunner,
): express.Express {
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", config.nodeEnv === "production" ? 1 : false);
  app.use(express.json({ limit: "1mb" }));

  // CORS: only allow configured origins when a browser sends an Origin header.
  app.use((req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin;
    if (origin) {
      if (config.allowedOrigins.includes(origin)) {
        res.setHeader("Access-Control-Allow-Origin", origin);
        res.setHeader("Vary", "Origin");
        res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", `Content-Type, Authorization, ${config.sessionHeaderName}`);
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

  // Security headers
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "no-referrer");
    next();
  });

  // API key auth (no-op when API_KEYS is unset)
  app.use("/api", apiKeyAuth);

  // User account endpoints (register / login / logout / me).
  if (authStore) app.use("/api/auth", authRoutes(authStore));

  // Processing endpoints require a signed-in session when accounts are enabled.
  if (authStore && config.authEnabled) {
    app.use(
      ["/api/jobs", "/api/download", "/api/download-all", "/api/resize", "/api/convert", "/api/enhance", "/api/scan", "/api/pdf", "/api/remove-bg", "/api/compress", "/api/watermark", "/api/video"],
      requireAuth(authStore),
    );
  }

  // Rate limiting for upload/processing endpoints
  app.use(["/api/resize", "/api/convert", "/api/enhance", "/api/scan", "/api/pdf", "/api/remove-bg", "/api/compress", "/api/watermark", "/api/video"], rateLimit);

  app.use("/api", jobsRoutes(jobs));
app.use("/api/resize", resizeRoutes(jobs));
app.use("/api/convert", convertRoutes(jobs));
app.use("/api/enhance", enhanceRoutes(jobs));
if (scanner) app.use("/api/scan", scanRoutes(jobs, scanner));
app.use("/api/pdf", pdfRoutes(jobs, pdfRunner));
app.use("/api/remove-bg", removeBgRoutes(jobs));
app.use("/api/compress", compressRoutes(jobs));
app.use("/api/watermark", watermarkRoutes(jobs));
app.use("/api/video", videoRoutes(jobs));
app.use("/api/contact", contactRoutes);

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

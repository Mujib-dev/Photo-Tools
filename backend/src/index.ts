import { mkdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";

import { config, validateExeAvailability } from "./config.js";
import { auditSecurityConfig } from "./security/validateEnv.js";
import { logger } from "./utils/logger.js";
import { ExeProcessRunner } from "./services/exe/ExeProcessRunner.js";
import { ExeResizeService } from "./services/exe/PhotoResizerService.js";
import { ExeConvertService } from "./services/exe/PhotoConverterService.js";
import { ExeEnhancerService } from "./services/exe/PhotoEnhancerService.js";
import { ExeScannerService } from "./services/exe/PhotoScannerService.js";
import { ExePdfService } from "./services/exe/PhotoPdfService.js";
import { ExeRemoveBgService } from "./services/exe/PhotoRemoveBgService.js";
import { ExeCompressService } from "./services/exe/PhotoCompressService.js";
import { ExeWatermarkService } from "./services/exe/PhotoWatermarkService.js";
import { ExeVideoService } from "./services/exe/PhotoVideoService.js";
import { ExeAudioService } from "./services/exe/PhotoAudioService.js";
import { ExeOcrService } from "./services/exe/PhotoOcrService.js";
import { UrlDownloadService } from "./services/url/UrlDownloadService.js";
import { SpeechService } from "./services/speech/SpeechService.js";
import { JobManager } from "./jobs/JobManager.js";
import { SqliteJobStore } from "./jobs/store/SqliteJobStore.js";
import { PostgresJobStore } from "./jobs/store/PostgresJobStore.js";
import { MemoryJobStore } from "./jobs/store/MemoryJobStore.js";
import { InProcessQueue } from "./jobs/queue/InProcessQueue.js";
import { BullQueue } from "./jobs/queue/BullQueue.js";
import { startCleanupSweeper } from "./storage/TempFileManager.js";
import { startRateLimitPruner } from "./middleware/rateLimit.js";
import { startAuthRateLimitPruner } from "./middleware/authRateLimit.js";
import { buildApp } from "./api/app.js";
import { chargeCredits, refundCredits } from "./services/credits.js";
import { runWeeklyDigests } from "./services/digest.js";
import { sweepSubscriptions } from "./services/subscription.js";
import { SqliteAuthStore } from "./auth/SqliteAuthStore.js";
import { MemoryAuthStore } from "./auth/MemoryAuthStore.js";
import { hashPassword } from "./auth/password.js";
import type { AuthStore } from "./auth/AuthStore.js";

/**
 * A stray rejected promise must not take the whole API down: the browser
 * sees every in-flight request fail with "the processing service is
 * temporarily unavailable" until the supervisor restarts the process. A
 * rejection is isolated to one operation, so it is logged and swallowed.
 *
 * An uncaught exception is different — the process state is no longer
 * trustworthy (a half-written store, a corrupt job record), so the server
 * exits and lets the supervisor start a clean one.
 */
process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled promise rejection", {
    error: reason instanceof Error ? reason.message : String(reason),
  });
});

process.on("uncaughtException", (err) => {
  logger.error("Uncaught exception — restarting the server", { error: err.message });
  process.exit(1);
});

async function main(): Promise<void> {
  validateExeAvailability();
  auditSecurityConfig();
  mkdirSync(config.tempDirectory, { recursive: true });

  // Restricted executable registry — the only paths the runner may spawn.
  const runner = new ExeProcessRunner({
    resize: config.resizerExe,
    convert: config.converterExe,
    enhance: config.enhancerExe,
    scan: config.scannerExe,
    pdf: config.pdfExe,
    removebg: config.removeBgExe,
    compress: config.compressExe,
    watermark: config.watermarkExe,
    video: config.ffmpegExe,
    "video-probe": config.ffprobeExe,
  });

  const services = {
    resize: new ExeResizeService(runner),
    convert: new ExeConvertService(runner),
    enhance: new ExeEnhancerService(runner),
    scan: new ExeScannerService(runner),
    pdf: new ExePdfService(runner),
    removebg: new ExeRemoveBgService(runner),
    compress: new ExeCompressService(runner),
    watermark: new ExeWatermarkService(runner),
    video: new ExeVideoService(runner),
    audio: new ExeAudioService(runner),
    ocr: new ExeOcrService(),
    fetch: new UrlDownloadService(runner),
  };

  // Job store: PostgreSQL (production) → SQLite (local) → memory (fallback).
  let store;
  if (config.databaseUrl) {
    store = new PostgresJobStore(config.databaseUrl);
    await store.init();
  } else {
    const sqlitePath = process.env.JOB_DB_PATH ?? path.join(config.tempDirectory, "job-store.sqlite");
    try {
      store = new SqliteJobStore(sqlitePath);
      await store.init();
    } catch (err) {
      logger.warn(`SQLite store unavailable (${err instanceof Error ? err.message : err}); using memory store.`);
      store = new MemoryJobStore();
      await store.init();
    }
  }
  // Queue: BullMQ when Redis is configured, otherwise the in-process queue.
  let queue;
  if (config.redisUrl) {
    queue = new BullQueue(config.redisUrl);
  } else {
    queue = new InProcessQueue();
  }

  // Auth store: SQLite (local) → memory (fallback). Not created when auth is
  // off. Created before the job manager so jobs can be billed to accounts.
  let authStore: AuthStore | null = null;
  if (config.authEnabled) {
    if (config.authStoreKind === "memory") {
      authStore = new MemoryAuthStore();
      await authStore.init();
    } else {
      try {
        authStore = new SqliteAuthStore(config.authDbPath);
        await authStore.init();
      } catch (err) {
        logger.warn(
          `SQLite auth store unavailable (${err instanceof Error ? err.message : err}); using memory store.`,
        );
        authStore = new MemoryAuthStore();
        await authStore.init();
      }
    }
  }

  // Credits: charge when a job is queued, refund when it fails.
  const billingStore = authStore;
  const jobs = new JobManager(
    store,
    queue,
    services,
    billingStore
      ? {
          charge: async (userId, operation) => {
            await chargeCredits(billingStore, userId, operation);
          },
          refund: async (userId, operation) => {
            await refundCredits(billingStore, userId, operation);
          },
        }
      : undefined,
  );
  await jobs.init();

  // Local text-to-speech / speech-to-text via the Windows speech stack.
  const speech = new SpeechService();

  const app = buildApp(jobs, authStore ?? undefined, services.scan, runner, speech);

  // Seed a default demo account so the app is usable immediately after setup.
  if (authStore) {
    try {
      const desiredRole = config.defaultUserIsAdmin ? "superadmin" : "user";
      const existing = await authStore.getUserByEmail(config.defaultUserEmail);
      if (!existing) {
        await authStore.createUser(
          config.defaultUserEmail,
          hashPassword(config.defaultUserPassword),
          desiredRole,
        );
        logger.info("Seeded default account", { email: config.defaultUserEmail, role: desiredRole });
      } else if (config.defaultUserIsAdmin && existing.role !== "superadmin") {
        await authStore.setUserRole(existing.id, "superadmin");
        logger.info("Elevated default account to super administrator", {
          email: config.defaultUserEmail,
        });
      }

      // There is exactly one super administrator: the configured default account.
      if (config.defaultUserIsAdmin) {
        const users = await authStore.listUsers();
        for (const user of users) {
          if (user.email !== config.defaultUserEmail && user.role === "superadmin") {
            await authStore.setUserRole(user.id, "admin");
            logger.info("Demoted extra super administrator", { email: user.email });
          }
        }
      }

      // Seed default promotional launch codes if none exist
      const existingPromos = await authStore.listPromoCodes();
      if (existingPromos.length === 0) {
        await authStore.createPromoCode({
          id: randomUUID(),
          code: "LYNKZONE",
          description: "Official LynkZone Launch Gift — 500 Free AI Credits",
          kind: "credits",
          credits: 500,
          plan: null,
          planDays: 0,
          percentOff: 0,
          active: true,
          expiresAt: null,
          maxRedemptions: null,
          maxPerUser: 1,
          redeemedCount: 0,
          stripeCouponId: null,
          createdAt: Date.now(),
        });
        await authStore.createPromoCode({
          id: randomUUID(),
          code: "LAUNCH500",
          description: "Community Launch Promo — 500 Free AI Credits",
          kind: "credits",
          credits: 500,
          plan: null,
          planDays: 0,
          percentOff: 0,
          active: true,
          expiresAt: null,
          maxRedemptions: null,
          maxPerUser: 1,
          redeemedCount: 0,
          stripeCouponId: null,
          createdAt: Date.now(),
        });
        await authStore.createPromoCode({
          id: randomUUID(),
          code: "PRO30",
          description: "30-Day Free Pro Plan Membership",
          kind: "plan",
          credits: 0,
          plan: "pro",
          planDays: 30,
          percentOff: 0,
          active: true,
          expiresAt: null,
          maxRedemptions: null,
          maxPerUser: 1,
          redeemedCount: 0,
          stripeCouponId: null,
          createdAt: Date.now(),
        });
        logger.info("Seeded default promotional codes (LYNKZONE, LAUNCH500, PRO30)");
      }
    } catch (err) {
      logger.warn(
        `Could not seed demo account (${err instanceof Error ? err.message : err}).`,
      );
    }
  }

  const stopCleanup = startCleanupSweeper();
  const stopPruner = startRateLimitPruner();
  const stopAuthPruner = startAuthRateLimitPruner();
  const recordSweeper = setInterval(() => {
    jobs.sweepExpired().catch(() => undefined);
  }, config.cleanupIntervalMs);
  recordSweeper.unref();

  const sessionSweeper = authStore
    ? setInterval(() => {
        authStore?.deleteExpiredSessions(Date.now()).catch(() => undefined);
        authStore?.deleteExpiredRefreshTokens(Date.now()).catch(() => undefined);
      }, config.cleanupIntervalMs)
    : null;
  if (sessionSweeper) sessionSweeper.unref();

  // Weekly usage/credit digests: checked twice a day; each account is emailed
  // at most once per seven days (and only when it was active).
  const digestTimer = authStore
    ? setInterval(() => {
        void runWeeklyDigests(authStore, jobs)
          .then((result) => {
            if (result.sent > 0) logger.info("Weekly usage digests sent", { ...result });
          })
          .catch((err) =>
            logger.warn(`Weekly digest run failed (${err instanceof Error ? err.message : err})`),
          );
      }, 12 * 60 * 60 * 1000)
    : null;
  if (digestTimer) digestTimer.unref();

  // Subscription reconciliation: catches lapsed/canceled paid plans even when
  // the owner never signs in (webhooks are the primary path; this is the net).
  // No-op until Stripe is configured. First pass shortly after boot to pick up
  // anything missed while the server was down, then every six hours.
  const runSubscriptionSweep = (): void => {
    if (!authStore || !config.stripeSecretKey) return;
    void sweepSubscriptions(authStore)
      .then((result) => {
        if (result.downgraded > 0 || result.checked > 0) {
          logger.info("Subscription sweep", { ...result });
        }
      })
      .catch((err) =>
        logger.warn(`Subscription sweep failed (${err instanceof Error ? err.message : err})`),
      );
  };
  const subscriptionWarmup = setTimeout(runSubscriptionSweep, 60_000);
  subscriptionWarmup.unref();
  const subscriptionSweeper = setInterval(runSubscriptionSweep, 6 * 60 * 60 * 1000);
  subscriptionSweeper.unref();

  const server = app.listen(config.port, () => {
    logger.info("Photo Tools backend listening", {
      port: config.port,
      resizer: config.resizerExe,
      converter: config.converterExe,
      enhancer: config.enhancerExe,
      scanner: config.scannerExe,
      ffmpeg: config.ffmpegExe ?? "not found (video disabled)",
      speech: process.platform === "win32" ? "windows SAPI" : "unsupported platform",
      queue: queue.kind,
      store: store.kind,
      maxFileSizeMb: config.maxFileSizeBytes / 1024 / 1024,
      processTimeoutSec: config.processTimeoutMs / 1000,
      maxConcurrentJobs: config.maxConcurrentJobs,
      apiKey: config.apiKeys.length > 0 ? "enabled" : "disabled",
      auth: config.authEnabled ? `enabled (${authStore?.kind ?? "none"})` : "disabled",
    });
  });

  server.on("error", (err: NodeJS.ErrnoException) => {
    logger.error("HTTP server error", { error: err.message });
    process.exitCode = 1;
  });

  let shuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(`Received ${signal}, shutting down...`);
    stopCleanup();
    stopPruner();
    stopAuthPruner();
    clearInterval(recordSweeper);
    if (sessionSweeper) clearInterval(sessionSweeper);
    if (digestTimer) clearInterval(digestTimer);
    clearTimeout(subscriptionWarmup);
    clearInterval(subscriptionSweeper);
    server.close();
    await jobs.close().catch(() => undefined);
    await authStore?.close().catch(() => undefined);
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));

  // The dev supervisor asks for a clean restart over IPC. Windows cannot
  // deliver SIGTERM to a child process, so a signal would kill the server
  // without closing the stores and the in-flight jobs.
  process.on("message", (message: unknown) => {
    const type = (message as { type?: unknown } | null)?.type;
    if (type === "shutdown") void shutdown("SUPERVISOR");
  });
}

main().catch((err) => {
  logger.error("Backend failed to start", { error: err instanceof Error ? err.message : String(err) });
  process.exit(1);
});

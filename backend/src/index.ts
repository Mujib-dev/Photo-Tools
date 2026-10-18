import { mkdirSync } from "node:fs";
import path from "node:path";

import { config, validateExeAvailability } from "./config.js";
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
import { JobManager } from "./jobs/JobManager.js";
import { SqliteJobStore } from "./jobs/store/SqliteJobStore.js";
import { PostgresJobStore } from "./jobs/store/PostgresJobStore.js";
import { MemoryJobStore } from "./jobs/store/MemoryJobStore.js";
import { InProcessQueue } from "./jobs/queue/InProcessQueue.js";
import { BullQueue } from "./jobs/queue/BullQueue.js";
import { startCleanupSweeper } from "./storage/TempFileManager.js";
import { startRateLimitPruner } from "./middleware/rateLimit.js";
import { buildApp } from "./api/app.js";
import { SqliteAuthStore } from "./auth/SqliteAuthStore.js";
import { MemoryAuthStore } from "./auth/MemoryAuthStore.js";
import { hashPassword } from "./auth/password.js";
import type { AuthStore } from "./auth/AuthStore.js";

async function main(): Promise<void> {
  validateExeAvailability();
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

  const jobs = new JobManager(store, queue, services);
  await jobs.init();

  // Auth store: SQLite (local) → memory (fallback). Not created when auth is off.
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

  const app = buildApp(jobs, authStore ?? undefined, services.scan, runner);

  // Seed a default demo account so the app is usable immediately after setup.
  if (authStore) {
    try {
      const existing = await authStore.getUserByEmail(config.defaultUserEmail);
      if (!existing) {
        await authStore.createUser(config.defaultUserEmail, hashPassword(config.defaultUserPassword));
        logger.info("Seeded default demo account", { email: config.defaultUserEmail });
      }
    } catch (err) {
      logger.warn(
        `Could not seed demo account (${err instanceof Error ? err.message : err}).`,
      );
    }
  }

  const stopCleanup = startCleanupSweeper();
  const stopPruner = startRateLimitPruner();
  const recordSweeper = setInterval(() => {
    jobs.sweepExpired().catch(() => undefined);
  }, config.cleanupIntervalMs);
  recordSweeper.unref();

  const sessionSweeper = authStore
    ? setInterval(() => {
        authStore?.deleteExpiredSessions(Date.now()).catch(() => undefined);
      }, config.cleanupIntervalMs)
    : null;
  if (sessionSweeper) sessionSweeper.unref();

  const server = app.listen(config.port, () => {
    logger.info("Photo Tools backend listening", {
      port: config.port,
      resizer: config.resizerExe,
      converter: config.converterExe,
      enhancer: config.enhancerExe,
      scanner: config.scannerExe,
      ffmpeg: config.ffmpegExe ?? "not found (video disabled)",
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
    clearInterval(recordSweeper);
    if (sessionSweeper) clearInterval(sessionSweeper);
    server.close();
    await jobs.close().catch(() => undefined);
    await authStore?.close().catch(() => undefined);
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((err) => {
  logger.error("Backend failed to start", { error: err instanceof Error ? err.message : String(err) });
  process.exit(1);
});

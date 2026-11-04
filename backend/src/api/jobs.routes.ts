import { Router, type Request } from "express";
import { createReadStream, existsSync, statSync } from "node:fs";
import path from "node:path";
import archiver from "archiver";

import { config } from "../config.js";
import { isAdminRole } from "../auth/AuthStore.js";
import { AppError, Errors } from "../utils/errors.js";
import { logger } from "../utils/logger.js";
import type { JobManager } from "../jobs/JobManager.js";
import type { JobRecord } from "../jobs/JobTypes.js";
import { sanitizeBaseName } from "../validation/validators.js";

function friendlyDownloadName(record: JobRecord): string {
  const base = sanitizeBaseName(record.inputFilename);
  const ext = record.outputFormat ?? "";
  if (record.operation === "pdf") return record.outputFilename ?? `${base}.pdf`;
  if (record.operation === "convert") return `${base}.${ext || "ico"}`;
  if (record.operation === "enhance") return `${base}-enhanced.${ext || "jpg"}`;
  if (record.operation === "scan") return `${base}-scan.${ext || "pdf"}`;
  if (record.operation === "removebg") return `${base}-nobg.${ext || "png"}`;
  if (record.operation === "compress") return `${base}-compressed.${ext || "jpg"}`;
  if (record.operation === "watermark") return `${base}-watermarked.${ext || "jpg"}`;
  if (record.operation === "ocr") return `${base}-ocr.${ext || "docx"}`;
  if (record.operation === "audio") return `${base}-audio.${ext || "mp3"}`;
  if (record.operation === "fetch") return record.outputFilename ?? `${base}-download.${ext || "mp4"}`;
  if (record.operation === "video") {
    if (ext === "gif") return `${base}.gif`;
    if (ext === "zip") return `${base}-frames.zip`;
    if (["mp3", "m4a", "wav", "aac", "flac", "ogg"].includes(ext)) return `${base}-audio.${ext}`;
    if (ext === "jpg" || ext === "jpeg" || ext === "png") return `${base}-thumbnail.${ext}`;
    return `${base}-compressed.${ext || "mp4"}`;
  }
  return `${base}-resized.${ext || "jpg"}`;
}

function assertJobAccess(record: JobRecord, req: Request): void {
  if (record.userId) {
    const user = req.authUser;
    if (!user) throw Errors.unauthorized();
    if (!isAdminRole(user.role) && record.userId !== user.id) {
      throw Errors.forbidden("You do not have permission to access this job.");
    }
  }
}

/**
 * Live SSE streams hold a socket for the lifetime of a job. Cap how many one
 * client can keep open so a single tab (or script) cannot exhaust the server's
 * connection budget. This is a concurrency cap rather than a request-rate cap
 * so a 50-file batch (one stream per job) still works.
 */
const MAX_STREAMS_PER_IP = 64;
const activeStreams = new Map<string, number>();

function acquireStream(ip: string): boolean {
  const current = activeStreams.get(ip) ?? 0;
  if (current >= MAX_STREAMS_PER_IP) return false;
  activeStreams.set(ip, current + 1);
  return true;
}

function releaseStream(ip: string): void {
  const current = (activeStreams.get(ip) ?? 1) - 1;
  if (current <= 0) activeStreams.delete(ip);
  else activeStreams.set(ip, current);
}

const SSE_HEARTBEAT_MS = 15_000;

const MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  bmp: "image/bmp",
  tiff: "image/tiff",
  ico: "image/x-icon",
  webp: "image/webp",
  gif: "image/gif",
  pdf: "application/pdf",
  zip: "application/zip",
  mp4: "video/mp4",
  m4v: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
  mkv: "video/x-matroska",
  avi: "video/x-msvideo",
  mpg: "video/mpeg",
  mpeg: "video/mpeg",
  flv: "video/x-flv",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  wav: "audio/wav",
  aac: "audio/aac",
  flac: "audio/flac",
  ogg: "audio/ogg",
};

function mimeFor(ext: string): string {
  return MIME[ext.toLowerCase()] ?? "application/octet-stream";
}

/**
 * Sanitize an output file name for `?file=` downloads while preserving its
 * extension: strips directory separators and reserved characters.
 */
function safeOutputName(raw: string): string {
  const base = String(raw).split(/[\\/]/).pop() ?? "";
  return (
    base
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")
      .replace(/\.{2,}/g, "_")
      .trim()
      .slice(0, 120) || "page"
  );
}

function toPublicRecord(record: JobRecord): Record<string, unknown> {
  return {
    id: record.id,
    operation: record.operation,
    state: record.state,
    stage: record.stage,
    error: record.error,
    inputFilename: record.inputFilename,
    inputSize: record.inputSize,
    inputFormat: record.inputFormat,
    outputFilename: record.outputFilename,
    outputSize: record.outputSize,
    outputFormat: record.outputFormat,
    downloadName: record.state === "completed" ? friendlyDownloadName(record) : null,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    processedAt: record.processedAt,
  };
}

export function jobsRoutes(jobs: JobManager): Router {
  const router = Router();

  router.get("/health", (_req, res) => {
    res.json({ status: "ok", queue: "configured", maxConcurrentJobs: config.maxConcurrentJobs });
  });

  // The signed-in account's recent jobs, newest first. Powers the "My Files"
  // page, which is the only way to retrieve an output after leaving a tool.
  router.get("/jobs", async (req, res, next) => {
    try {
      const user = req.authUser;
      if (!user) throw Errors.unauthorized();
      const requested = Number(req.query.limit);
      const limit = Number.isFinite(requested)
        ? Math.min(Math.max(Math.trunc(requested), 1), 500)
        : 100;
      const records = await jobs.listJobsForUser(user.id, limit);
      res.json({ jobs: records.map(toPublicRecord) });
    } catch (err) {
      next(err);
    }
  });

  router.get("/jobs/:id", async (req, res, next) => {
    try {
      const record = await jobs.get(req.params.id);
      assertJobAccess(record, req);
      res.json(toPublicRecord(record));
    } catch (err) {
      next(err);
    }
  });

  // Permanently remove a job the signed-in account owns, along with its files.
  router.delete("/jobs/:id", async (req, res, next) => {
    try {
      const record = await jobs.get(req.params.id);
      assertJobAccess(record, req);
      await jobs.deleteJobs([record.id]);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  router.get("/jobs/:id/events", async (req, res, next) => {
    let release: (() => void) | null = null;
    try {
      const jobId = req.params.id;
      const initial = await jobs.get(jobId);
      assertJobAccess(initial, req);

      const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";
      if (!acquireStream(ip)) {
        res.setHeader("Retry-After", "10");
        next(new AppError(429, "Too many live job streams. Close some tabs and try again."));
        return;
      }

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");
      res.flushHeaders?.();

      // Keep proxies from closing an idle stream before the job finishes.
      const heartbeat = setInterval(() => {
        try {
          res.write(": ping\n\n");
        } catch {
          // socket already gone; the close handler cleans up
        }
      }, SSE_HEARTBEAT_MS);
      heartbeat.unref?.();

      let released = false;
      release = () => {
        if (released) return;
        released = true;
        clearInterval(heartbeat);
        releaseStream(ip);
      };
      req.on("close", release);

      res.write(`data: ${JSON.stringify(toPublicRecord(initial))}\n\n`);

      if (initial.state === "completed" || initial.state === "failed") {
        res.end();
        release();
        return;
      }

      const onUpdate = (updated: JobRecord) => {
        try {
          res.write(`data: ${JSON.stringify(toPublicRecord(updated))}\n\n`);
          if (updated.state === "completed" || updated.state === "failed") {
            jobs.off(`job:${jobId}`, onUpdate);
            res.end();
            release?.();
          }
        } catch {
          jobs.off(`job:${jobId}`, onUpdate);
          release?.();
        }
      };

      jobs.on(`job:${jobId}`, onUpdate);

      req.on("close", () => {
        jobs.off(`job:${jobId}`, onUpdate);
      });
    } catch (err) {
      release?.();
      next(err);
    }
  });

  router.get("/download/:id", async (req, res, next) => {
    try {
      const record = await jobs.get(req.params.id);
      assertJobAccess(record, req);
      if (record.state !== "completed" || !record.outputFilename) throw Errors.notReady();

      const requested = req.query.file;
      let outputPath: string;
      let name: string;
      if (requested !== undefined) {
        // Per-output downloads (e.g. multi-page scans: individual pages or the
        // ZIP). The file name must be a plain basename from the job's output dir.
        if (record.operation !== "scan") throw Errors.invalidSettings();
        const base = safeOutputName(String(requested));
        const dir = path.join(config.tempDirectory, `job-${record.id}`, "output");
        outputPath = path.join(dir, base);
        const resolvedDir = path.resolve(dir).toLowerCase();
        const resolvedOutput = path.resolve(outputPath).toLowerCase();
        if (path.dirname(resolvedOutput) !== resolvedDir) throw Errors.invalidSettings();
        if (!existsSync(outputPath)) throw Errors.downloadGone();
        name = base;
      } else {
        ({ outputPath } = await jobs.resolveDownload(record.id));
        if (!existsSync(outputPath)) throw Errors.downloadGone();
        name = friendlyDownloadName(record);
      }

      const size = statSync(outputPath).size;
      const ext = path.extname(outputPath).replace(".", "").toLowerCase();

      res.setHeader("Content-Type", mimeFor(ext));
      res.setHeader("Content-Length", String(size));
      let safeAscii = name.replace(/[^\x20-\x7E]/g, "_").replace(/["\r\n]/g, "").trim() || `media.${ext}`;
      if (ext && !safeAscii.toLowerCase().endsWith(`.${ext.toLowerCase()}`)) {
        safeAscii = `${safeAscii}.${ext}`;
      }
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${safeAscii}"; filename*=UTF-8''${encodeURIComponent(name)}`,
      );
      res.setHeader("Cache-Control", "no-store");

      const stream = createReadStream(outputPath);
      stream.pipe(res);
    } catch (err) {
      next(err);
    }
  });

  router.get("/download-all", async (req, res, next) => {
    try {
      const raw = req.query.ids;
      const ids = String(raw ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (ids.length === 0 || ids.length > 100) throw Errors.invalidSettings();

      const records = await jobs.getMany(ids);
      if (records.length === 0) throw Errors.jobNotFound();
      for (const record of records) {
        assertJobAccess(record, req);
      }
      if (records.some((r) => r.state !== "completed" || !r.outputFilename)) {
        throw Errors.notReady();
      }

      const archive = archiver("zip", { zlib: { level: 8 } });
      const usedNames = new Set<string>();

      for (const record of records) {
        const { outputPath } = await jobs.resolveDownload(record.id);
        if (!existsSync(outputPath)) throw Errors.downloadGone();
        let name = friendlyDownloadName(record);
        const base = path.parse(name).name;
        const ext = path.parse(name).ext;
        let counter = 2;
        while (usedNames.has(name)) {
          name = `${base}-${counter}${ext}`;
          counter += 1;
        }
        usedNames.add(name);
        archive.file(outputPath, { name });
      }

      archive.on("error", (err) => {
        logger.error("Zip creation failed", { error: err.message });
        res.destroy();
      });

      res.setHeader("Content-Type", "application/zip");
      res.setHeader("Content-Disposition", 'attachment; filename="photo-tools-images.zip"');
      res.setHeader("Cache-Control", "no-store");
      archive.pipe(res);
      void archive.finalize();
    } catch (err) {
      next(err);
    }
  });

  return router;
}

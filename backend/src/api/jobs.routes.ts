import { Router } from "express";
import { createReadStream, existsSync, statSync } from "node:fs";
import path from "node:path";
import archiver from "archiver";

import { config } from "../config.js";
import { Errors } from "../utils/errors.js";
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
  if (record.operation === "video") {
    if (ext === "gif") return `${base}.gif`;
    if (ext === "zip") return `${base}-frames.zip`;
    if (["mp3", "m4a", "wav", "aac", "flac", "ogg"].includes(ext)) return `${base}-audio.${ext}`;
    if (ext === "jpg" || ext === "jpeg" || ext === "png") return `${base}-thumbnail.${ext}`;
    return `${base}-compressed.${ext || "mp4"}`;
  }
  return `${base}-resized.${ext || "jpg"}`;
}

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

  router.get("/jobs/:id", async (req, res, next) => {
    try {
      const record = await jobs.get(req.params.id);
      res.json(toPublicRecord(record));
    } catch (err) {
      next(err);
    }
  });

  router.get("/jobs/:id/events", async (req, res, next) => {
    try {
      const jobId = req.params.id;
      const initial = await jobs.get(jobId);

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");
      res.flushHeaders?.();

      res.write(`data: ${JSON.stringify(toPublicRecord(initial))}\n\n`);

      if (initial.state === "completed" || initial.state === "failed") {
        res.end();
        return;
      }

      const onUpdate = (updated: JobRecord) => {
        try {
          res.write(`data: ${JSON.stringify(toPublicRecord(updated))}\n\n`);
          if (updated.state === "completed" || updated.state === "failed") {
            jobs.off(`job:${jobId}`, onUpdate);
            res.end();
          }
        } catch {
          jobs.off(`job:${jobId}`, onUpdate);
        }
      };

      jobs.on(`job:${jobId}`, onUpdate);

      req.on("close", () => {
        jobs.off(`job:${jobId}`, onUpdate);
      });
    } catch (err) {
      next(err);
    }
  });

  router.get("/download/:id", async (req, res, next) => {
    try {
      const record = await jobs.get(req.params.id);
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
        if (path.dirname(outputPath) !== path.resolve(dir)) throw Errors.invalidSettings();
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
      res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(name)}`);
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

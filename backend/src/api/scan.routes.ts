import { Router } from "express";
import multer from "multer";

import { config } from "../config.js";
import { Errors } from "../utils/errors.js";
import type { JobManager } from "../jobs/JobManager.js";
import { createJobDirectories, deleteJobDirectory, saveInputFile } from "../storage/TempFileManager.js";
import type { ExeScannerService } from "../services/exe/PhotoScannerService.js";
import {
  SCAN_MAX_PAGES,
  SCAN_ROTATIONS,
  detectImageFormat,
  formatExtension,
  parseScanSettings,
} from "../validation/validators.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxFileSizeBytes, files: SCAN_MAX_PAGES, fields: 10 },
});

function parseJsonField(raw: unknown, fallback: unknown): unknown {
  if (raw === undefined) return fallback;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      throw Errors.invalidSettings("Settings must be valid JSON.");
    }
  }
  return raw;
}

function parseRotate(raw: unknown): number {
  if (raw === undefined || raw === "") return 0;
  const n = Number(raw);
  if (!SCAN_ROTATIONS.includes(n as (typeof SCAN_ROTATIONS)[number])) {
    throw Errors.invalidSettings("rotate must be 0, 90, 180 or 270.");
  }
  return n;
}

export function scanRoutes(jobs: JobManager, scanner: ExeScannerService): Router {
  const router = Router();

  router.post("/", upload.array("files"), async (req, res, next) => {
    try {
      const files = req.files as Express.Multer.File[] | undefined;
      if (!files || files.length === 0) throw Errors.noFile();
      if (files.length > SCAN_MAX_PAGES) {
        throw Errors.invalidSettings(`At most ${SCAN_MAX_PAGES} pages may be scanned at once.`);
      }
      if (files.some((f) => !f.buffer || f.size === 0)) throw Errors.noFile();

      const settings = parseScanSettings(parseJsonField(req.body.settings, null));
      if (settings.pages.length !== files.length) {
        throw Errors.invalidSettings("The number of pages must match the number of uploaded files.");
      }

      const formats = files.map((f) => detectImageFormat(f.buffer, f.originalname));
      const { jobId, dirs } = await createJobDirectories();

      const inputPaths: string[] = [];
      for (let i = 0; i < files.length; i += 1) {
        const inputPath = await saveInputFile(dirs, files[i].buffer, formatExtension(formats[i]));
        inputPaths.push(inputPath);
      }

      const pages = settings.pages.map((p, i) => ({ ...p, inputPath: inputPaths[i] }));
      const fullSettings = { mode: settings.mode, format: settings.format, pages };

      const record = await jobs.createJob({

        userId: req.authUser?.id ?? null,
        id: jobId,
        operation: "scan",
        inputFilename: files.length === 1 ? files[0].originalname : `${files.length} pages`,
        inputSize: files.reduce((sum, f) => sum + f.size, 0),
        inputFormat: formats[0],
        outputBaseName: "scan",
        settings: fullSettings,
        dirs: { ...dirs, inputPath: inputPaths[0] },
      });

      res.status(202).json({
        jobId: record.id,
        status: record.state,
        operation: record.operation,
      });
    } catch (err) {
      next(err);
    }
  });

  // Synchronous single-image document edge detection.
  router.post("/detect", upload.single("file"), async (req, res, next) => {
    let jobId: string | null = null;
    try {
      if (!req.file || !req.file.buffer || req.file.size === 0) throw Errors.noFile();
      const format = detectImageFormat(req.file.buffer, req.file.originalname);
      const rotate = parseRotate(req.body?.rotate ?? req.query.rotate);

      const created = await createJobDirectories();
      jobId = created.jobId;
      const inputPath = await saveInputFile(created.dirs, req.file.buffer, formatExtension(format));

      const detection = await scanner.detect(inputPath, rotate, created.dirs.jobDir);
      res.json(detection);
    } catch (err) {
      next(err);
    } finally {
      if (jobId) void deleteJobDirectory(jobId).catch(() => undefined);
    }
  });

  return router;
}

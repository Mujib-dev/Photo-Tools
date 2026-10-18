import { Router } from "express";
import multer from "multer";

import { config } from "../config.js";
import { Errors } from "../utils/errors.js";
import type { JobManager } from "../jobs/JobManager.js";
import { createJobDirectories, saveInputFile } from "../storage/TempFileManager.js";
import {
  detectImageFormat,
  formatExtension,
  parseCompressSettings,
  sanitizeBaseName,
} from "../validation/validators.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxFileSizeBytes, files: 1, fields: 10 },
});

export function compressRoutes(jobs: JobManager): Router {
  const router = Router();

  router.post("/", upload.single("file"), async (req, res, next) => {
    try {
      if (!req.file || !req.file.buffer || req.file.size === 0) throw Errors.noFile();

      const settingsRaw = req.body.settings ?? "{}";
      let settings;
      try {
        settings = parseCompressSettings(
          typeof settingsRaw === "string" ? JSON.parse(settingsRaw) : settingsRaw,
        );
      } catch (err) {
        if (err instanceof Error && (err as { safe?: string }).safe) throw err;
        throw Errors.invalidSettings("Settings must be valid JSON.");
      }

      const format = detectImageFormat(req.file.buffer, req.file.originalname);
      const { jobId, dirs } = await createJobDirectories();
      const inputPath = await saveInputFile(dirs, req.file.buffer, formatExtension(format));
      const baseName = sanitizeBaseName(req.file.originalname);

      const record = await jobs.createJob({
        id: jobId,
        operation: "compress",
        inputFilename: req.file.originalname,
        inputSize: req.file.size,
        inputFormat: format,
        outputBaseName: `${baseName}-compressed`,
        settings,
        dirs: { ...dirs, inputPath },
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

  return router;
}

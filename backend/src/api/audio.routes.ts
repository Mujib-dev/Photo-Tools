import { Router } from "express";
import multer from "multer";
import path from "node:path";

import { config } from "../config.js";
import { Errors } from "../utils/errors.js";
import type { JobManager } from "../jobs/JobManager.js";
import { createJobDirectories, saveInputFile } from "../storage/TempFileManager.js";
import {
  parseAudioSettings,
  sanitizeBaseName,
} from "../validation/validators.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.videoMaxFileSizeBytes, files: 1, fields: 10 },
});

const ALLOWED_AUDIO_EXT = new Set([".mp3", ".wav", ".m4a", ".aac", ".flac", ".ogg", ".opus", ".wma", ".webm", ".mp4", ".mkv", ".mov", ".avi"]);

export function audioRoutes(jobs: JobManager): Router {
  const router = Router();

  router.post("/", upload.single("file"), async (req, res, next) => {
    try {
      if (!req.file || !req.file.buffer || req.file.size === 0) throw Errors.noFile();

      const settingsRaw = req.body.settings ?? "{}";
      let settings;
      try {
        settings = parseAudioSettings(
          typeof settingsRaw === "string" ? JSON.parse(settingsRaw) : settingsRaw,
        );
      } catch (err) {
        if (err instanceof Error && (err as { safe?: string }).safe) throw err;
        throw Errors.invalidSettings("Settings must be valid JSON.");
      }

      const rawExt = path.extname(req.file.originalname).toLowerCase();
      const originalExt = ALLOWED_AUDIO_EXT.has(rawExt) ? rawExt : ".mp3";
      const { jobId, dirs } = await createJobDirectories();
      const inputPath = await saveInputFile(dirs, req.file.buffer, originalExt);
      const baseName = sanitizeBaseName(req.file.originalname);

      const record = await jobs.createJob({

        userId: req.authUser?.id ?? null,
        id: jobId,
        operation: "audio",
        inputFilename: req.file.originalname,
        inputSize: req.file.size,
        inputFormat: originalExt.replace(/^\./, ""),
        outputBaseName: `${baseName}-converted`,
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

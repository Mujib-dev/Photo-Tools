import { Router } from "express";
import multer from "multer";

import { config } from "../config.js";
import { Errors } from "../utils/errors.js";
import type { JobManager } from "../jobs/JobManager.js";
import { createJobDirectories, saveInputFile } from "../storage/TempFileManager.js";
import {
  detectImageFormat,
  formatExtension,
  parseWatermarkSettings,
  sanitizeBaseName,
} from "../validation/validators.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxFileSizeBytes, files: 2, fields: 10 },
});

export function watermarkRoutes(jobs: JobManager): Router {
  const router = Router();

  router.post(
    "/",
    upload.fields([
      { name: "file", maxCount: 1 },
      { name: "watermark", maxCount: 1 },
    ]),
    async (req, res, next) => {
      try {
        const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
        const mainFile = files?.file?.[0] ?? req.file;
        const watermarkFile = files?.watermark?.[0];

        if (!mainFile || !mainFile.buffer || mainFile.size === 0) throw Errors.noFile();

        const settingsRaw = req.body.settings ?? "{}";
        let settings;
        try {
          settings = parseWatermarkSettings(
            typeof settingsRaw === "string" ? JSON.parse(settingsRaw) : settingsRaw,
            Boolean(watermarkFile),
          );
        } catch (err) {
          if (err instanceof Error && (err as { safe?: string }).safe) throw err;
          throw Errors.invalidSettings("Settings must be valid JSON.");
        }

        const format = detectImageFormat(mainFile.buffer, mainFile.originalname);
        const { jobId, dirs } = await createJobDirectories();
        const inputPath = await saveInputFile(dirs, mainFile.buffer, formatExtension(format));
        const baseName = sanitizeBaseName(mainFile.originalname);

        if (watermarkFile && watermarkFile.buffer && watermarkFile.size > 0) {
          const watermarkFormat = detectImageFormat(watermarkFile.buffer, watermarkFile.originalname);
          const watermarkPath = await saveInputFile(
            dirs,
            watermarkFile.buffer,
            `logo${formatExtension(watermarkFormat)}`,
          );
          settings.imageWatermarkPath = watermarkPath;
          settings.watermarkType = "image";
        }

        const record = await jobs.createJob({

          userId: req.authUser?.id ?? null,
          id: jobId,
          operation: "watermark",
          inputFilename: mainFile.originalname,
          inputSize: mainFile.size,
          inputFormat: format,
          outputBaseName: `${baseName}-watermarked`,
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

import fsp from "node:fs/promises";
import { Router } from "express";
import multer from "multer";
import path from "node:path";
import crypto from "node:crypto";

import { config } from "../config.js";
import { Errors } from "../utils/errors.js";
import type { JobManager } from "../jobs/JobManager.js";
import { createJobDirectories, saveInputFile } from "../storage/TempFileManager.js";
import { ExeOcrService } from "../services/exe/PhotoOcrService.js";
import { parseOcrSettings, sanitizeBaseName } from "../validation/validators.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxFileSizeBytes, files: 1, fields: 10 },
});

const ALLOWED_OCR_EXT = new Set([".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tiff", ".pdf"]);

export function ocrRoutes(jobs: JobManager): Router {
  const router = Router();

  router.get("/languages", async (_req, res, next) => {
    try {
      const languages = await ExeOcrService.getLanguages();
      res.json(languages);
    } catch (err) {
      next(err);
    }
  });

  router.post("/analyze", upload.single("file"), async (req, res, next) => {
    let tempFile: string | null = null;
    try {
      if (!req.file || !req.file.buffer || req.file.size === 0) throw Errors.noFile();

      const rawExt = path.extname(req.file.originalname).toLowerCase();
      const originalExt = ALLOWED_OCR_EXT.has(rawExt) ? rawExt : ".png";
      const tempName = `ocr-analyze-${crypto.randomUUID()}${originalExt}`;
      tempFile = path.join(config.tempDirectory, tempName);
      await fsp.writeFile(tempFile, req.file.buffer);

      const language = typeof req.body.language === "string" ? req.body.language.trim() : undefined;
      const result = await ExeOcrService.analyze(tempFile, language);

      res.json(result);
    } catch (err) {
      next(err);
    } finally {
      if (tempFile) {
        await fsp.rm(tempFile, { force: true }).catch(() => undefined);
      }
    }
  });

  router.post("/", upload.single("file"), async (req, res, next) => {
    try {
      if (!req.file || !req.file.buffer || req.file.size === 0) throw Errors.noFile();

      const settingsRaw = req.body.settings ?? "{}";
      let settings;
      try {
        settings = parseOcrSettings(
          typeof settingsRaw === "string" ? JSON.parse(settingsRaw) : settingsRaw,
        );
      } catch (err) {
        if (err instanceof Error && (err as { safe?: string }).safe) throw err;
        throw Errors.invalidSettings("Settings must be valid JSON.");
      }

      const rawExt = path.extname(req.file.originalname).toLowerCase();
      const originalExt = ALLOWED_OCR_EXT.has(rawExt) ? rawExt : ".png";
      const { jobId, dirs } = await createJobDirectories();
      const inputPath = await saveInputFile(dirs, req.file.buffer, originalExt);
      const baseName = sanitizeBaseName(req.file.originalname);

      const record = await jobs.createJob({

        userId: req.authUser?.id ?? null,
        id: jobId,
        operation: "ocr",
        inputFilename: req.file.originalname,
        inputSize: req.file.size,
        inputFormat: originalExt.replace(/^\./, ""),
        outputBaseName: `${baseName}-ocr`,
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

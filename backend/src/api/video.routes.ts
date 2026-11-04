import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { Router } from "express";
import multer from "multer";

import { config } from "../config.js";
import { Errors } from "../utils/errors.js";
import type { JobManager } from "../jobs/JobManager.js";
import { createJobDirectories } from "../storage/TempFileManager.js";
import {
  detectVideoFormat,
  parseVideoSettings,
  sanitizeBaseName,
  videoFormatExtension,
} from "../validation/validators.js";

// Videos can be large, so uploads stream straight to disk instead of being
// buffered in memory like the image tools.
const uploadDir = path.join(config.tempDirectory, "video-uploads");

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      fs.mkdir(uploadDir, { recursive: true }, (err) => cb(err, uploadDir));
    },
    filename: (_req, _file, cb) => cb(null, `${crypto.randomUUID()}.upload`),
  }),
  limits: { fileSize: config.videoMaxFileSizeBytes, files: 1, fields: 10 },
});

const HEADER_BYTES = 32;

async function readHeader(filePath: string): Promise<Buffer> {
  const handle = await fsp.open(filePath, "r");
  try {
    const buf = Buffer.alloc(HEADER_BYTES);
    const { bytesRead } = await handle.read(buf, 0, HEADER_BYTES, 0);
    return buf.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
}

export function videoRoutes(jobs: JobManager): Router {
  const router = Router();

  router.post("/", upload.single("file"), async (req, res, next) => {
    const tempPath = req.file?.path ?? null;
    let moved = false;
    try {
      if (!req.file || req.file.size === 0) throw Errors.noVideoFile();

      const header = await readHeader(tempPath as string);
      const format = detectVideoFormat(header, req.file.originalname);

      const settingsRaw = req.body.settings ?? "{}";
      let settings;
      try {
        settings = parseVideoSettings(
          typeof settingsRaw === "string" ? JSON.parse(settingsRaw) : settingsRaw,
        );
      } catch (err) {
        if (err instanceof Error && (err as { safe?: string }).safe) throw err;
        throw Errors.invalidSettings("Settings must be valid JSON.");
      }

      const { jobId, dirs } = await createJobDirectories();
      const inputPath = path.join(
        dirs.inputDir,
        `${crypto.randomUUID()}.${videoFormatExtension(format)}`,
      );
      await fsp.rename(tempPath as string, inputPath);
      moved = true;

      const baseName = sanitizeBaseName(req.file.originalname, "video");
      const suffix =
        settings.output === "audio" ? "audio" : settings.output === "frames" ? "frames" : "compressed";

      const record = await jobs.createJob({

        userId: req.authUser?.id ?? null,
        id: jobId,
        operation: "video",
        inputFilename: req.file.originalname,
        inputSize: req.file.size,
        inputFormat: format,
        outputBaseName: `${baseName}-${suffix}`,
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
    } finally {
      if (tempPath && !moved) {
        await fsp.rm(tempPath, { force: true }).catch(() => undefined);
      }
    }
  });

  return router;
}

import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { Router } from "express";
import multer from "multer";

import { config } from "../config.js";
import { Errors } from "../utils/errors.js";
import { logger } from "../utils/logger.js";
import { chargeCredits, refundCredits } from "../services/credits.js";
import type { AuthStore } from "../auth/AuthStore.js";
import type { SpeechService, SpeechOutputFormat } from "../services/speech/SpeechService.js";
import { createJobDirectories, deleteJobDirectory } from "../storage/TempFileManager.js";

export const MAX_TTS_CHARACTERS = 5000;

const AUDIO_EXTENSIONS = new Set([
  ".wav",
  ".mp3",
  ".m4a",
  ".aac",
  ".ogg",
  ".oga",
  ".opus",
  ".flac",
  ".webm",
  ".mp4",
  ".m4v",
  ".mov",
  ".mkv",
  ".avi",
  ".wmv",
  ".mpg",
  ".mpeg",
  ".3gp",
]);

const uploadDir = path.join(config.tempDirectory, "speech-uploads");

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      fs.mkdir(uploadDir, { recursive: true }, (err) => cb(err, uploadDir));
    },
    filename: (_req, _file, cb) => cb(null, `${crypto.randomUUID()}.upload`),
  }),
  limits: { fileSize: config.maxFileSizeBytes, files: 1, fields: 4 },
});

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

export function ttsRoutes(speech: SpeechService, authStore?: AuthStore): Router {
  const router = Router();

  router.get("/voices", async (_req, res, next) => {
    try {
      res.json({ voices: await speech.listVoices() });
    } catch (err) {
      next(err);
    }
  });

  router.post("/", async (req, res, next) => {
    let jobId: string | null = null;
    const userId = req.authUser?.id ?? null;
    let charged = false;
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const text = typeof body.text === "string" ? body.text : "";
      if (!text.trim()) throw Errors.speechTextRequired();
      if (text.length > MAX_TTS_CHARACTERS) throw Errors.speechTextTooLong(MAX_TTS_CHARACTERS);

      // Speech is synchronous (no job record), so it is charged directly.
      if (userId && authStore) {
        await chargeCredits(authStore, userId, "tts");
        charged = true;
      }

      const voice = typeof body.voice === "string" ? body.voice.slice(0, 200) : "";
      const rate = clampInt(body.rate, -10, 10, 0);
      const volume = clampInt(body.volume, 0, 100, 100);
      const format: SpeechOutputFormat = body.format === "mp3" ? "mp3" : "wav";

      const created = await createJobDirectories();
      jobId = created.jobId;

      const result = await speech.synthesize(
        { text, voice, rate, volume, format },
        created.dirs.outputDir,
      );

      const filename = `speech-${Date.now()}.${result.format}`;
      res.setHeader("Content-Type", result.format === "mp3" ? "audio/mpeg" : "audio/wav");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("Cache-Control", "no-store");
      res.sendFile(result.outputPath, (err) => {
        if (jobId) {
          void deleteJobDirectory(jobId).catch(() => undefined);
          jobId = null;
        }
        if (err && !res.headersSent) next(err);
      });
    } catch (err) {
      if (jobId) await deleteJobDirectory(jobId).catch(() => undefined);
      // Synthesis failed: the charge is returned.
      if (charged && userId && authStore) await refundCredits(authStore, userId, "tts");
      next(err);
    }
  });

  return router;
}

export function sttRoutes(speech: SpeechService, authStore?: AuthStore): Router {
  const router = Router();

  router.post("/", upload.single("file"), async (req, res, next) => {
    const tempPath = req.file?.path ?? null;
    let jobId: string | null = null;
    let moved = false;
    const userId = req.authUser?.id ?? null;
    let charged = false;

    try {
      if (!req.file || req.file.size === 0) throw Errors.speechNoFile();

      const ext = path.extname(req.file.originalname).toLowerCase();
      if (!AUDIO_EXTENSIONS.has(ext)) throw Errors.speechUnsupportedFormat();

      // Speech is synchronous (no job record), so it is charged directly.
      if (userId && authStore) {
        await chargeCredits(authStore, userId, "stt");
        charged = true;
      }

      const created = await createJobDirectories();
      jobId = created.jobId;

      const inputPath = path.join(created.dirs.inputDir, `audio${ext}`);
      await fsp.rename(tempPath as string, inputPath);
      moved = true;
      const language =
        typeof req.body?.language === "string" && req.body.language.trim()
          ? req.body.language.trim().slice(0, 32)
          : "en-US";

      const transcript = await speech.transcribe(inputPath, created.dirs.jobDir, language);
      res.json({
        ...transcript,
        filename: req.file.originalname,
        durationKnown: false,
      });
    } catch (err) {
      if (charged && userId && authStore) await refundCredits(authStore, userId, "stt");
      next(err);
    } finally {
      if (tempPath && !moved) {
        await fsp.rm(tempPath, { force: true }).catch(() => undefined);
      }
      if (jobId) {
        await deleteJobDirectory(jobId).catch((err) => {
          logger.warn("Could not remove speech job directory", { error: String(err) });
        });
      }
    }
  });

  return router;
}

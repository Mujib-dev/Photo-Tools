import crypto from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";

import { Router } from "express";
import multer from "multer";

import { config } from "../config.js";
import { Errors } from "../utils/errors.js";
import type { JobManager } from "../jobs/JobManager.js";
import {
  createJobDirectories,
  moveInputFile,
  saveInputFile,
} from "../storage/TempFileManager.js";
import {
  detectImageFormat,
  detectVideoFormat,
  formatExtension,
  parseResizeSettings,
  parseConvertSettings,
  parseEnhanceSettings,
  parseRemoveBgSettings,
  parseCompressSettings,
  parseWatermarkSettings,
  sanitizeBaseName,
} from "../validation/validators.js";
import type { JobOperation } from "../jobs/JobTypes.js";
import type { ProcessingSettings } from "../services/ProcessingService.js";

// Uploads are staged on disk rather than in memory: a 50-file batch could
// otherwise hold up to `50 × MAX_FILE_SIZE_MB` of RAM at once.
const batchUploadDir = path.join(config.tempDirectory, "batch-uploads");
fs.mkdirSync(batchUploadDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, batchUploadDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).replace(/[^a-z0-9.]/gi, "").slice(0, 8);
      cb(null, `${crypto.randomUUID()}${ext}`);
    },
  }),
  limits: { fileSize: config.maxFileSizeBytes, files: 50, fields: 10 },
});

/** Read just the leading bytes of a staged upload for magic-byte detection. */
async function readHeader(filePath: string, bytes = 64 * 1024): Promise<Buffer> {
  const handle = await fsp.open(filePath, "r");
  try {
    const buffer = Buffer.alloc(bytes);
    const { bytesRead } = await handle.read(buffer, 0, bytes, 0);
    return buffer.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
}

const VALID_OPERATIONS = new Set<JobOperation>([
  "resize",
  "convert",
  "enhance",
  "removebg",
  "compress",
  "watermark",
  "video",
  "audio",
  "ocr",
]);

/**
 * Sanitize a file stem (the part before the extension) so it is a legal file
 * name on every platform. Unlike `sanitizeBaseName` this keeps any extension
 * the caller appended.
 */
function sanitizeStem(raw: string, fallback: string): string {
  const base = raw.split(/[\\/]/).pop() ?? "";
  const cleaned = base
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")
    .replace(/\.{2,}/g, "_")
    .replace(/[. ]+$/, "")
    .trim()
    .slice(0, 100);
  return cleaned || fallback;
}

/**
 * Expand a rename template into a file's base name.
 *
 * Supported tokens:
 * - `{name}`   the original file name without its extension
 * - `{index}`  the 1-based position in the batch
 * - `{ext}`    the original extension, without the dot
 *
 * Anything else is left as-is, and the result is sanitized so it is a legal
 * file name on every platform.
 */
export function applyRenameTemplate(
  template: string,
  originalName: string,
  index: number,
): string {
  const originalBase = sanitizeBaseName(originalName);
  const ext = originalName.includes(".") ? (originalName.split(".").pop() ?? "") : "";
  const expanded = template
    .replace(/\{name\}/gi, originalBase)
    .replace(/\{index\}/gi, String(index))
    .replace(/\{ext\}/gi, ext);

  // Keep a trailing extension the template produced, e.g. "{index}.{ext}".
  const match = /^(.*)\.([a-zA-Z0-9]{1,5})$/.exec(expanded);
  const stem = match ? match[1] : expanded;
  const outExt = match ? match[2].toLowerCase() : "";
  const safeStem = sanitizeStem(stem, originalBase);
  return outExt ? `${safeStem}.${outExt}` : safeStem;
}

function getParser(operation: JobOperation) {
  switch (operation) {
    case "resize":
      return parseResizeSettings;
    case "convert":
      return parseConvertSettings;
    case "enhance":
      return parseEnhanceSettings;
    case "removebg":
      return parseRemoveBgSettings;
    case "compress":
      return parseCompressSettings;
    case "watermark":
      return parseWatermarkSettings;
    default:
      return (s: unknown) => s ?? {};
  }
}

function getSuffix(operation: JobOperation) {
  switch (operation) {
    case "resize":
      return "-resized";
    case "convert":
      return "-converted";
    case "compress":
      return "-compressed";
    case "watermark":
      return "-watermarked";
    case "removebg":
      return "-nobg";
    case "enhance":
      return "-enhanced";
    default:
      return "";
  }
}

export function batchRoutes(jobs: JobManager): Router {
  const router = Router();

  router.post("/:operation", upload.array("files", 50), async (req, res, next) => {
    const files = (req.files as Express.Multer.File[]) || [];
    try {
      const op = req.params.operation as JobOperation;
      if (!VALID_OPERATIONS.has(op)) throw Errors.invalidSettings("Invalid batch operation.");
      if (files.length === 0) throw Errors.noFile();

      const settingsRaw = req.body.settings ?? "{}";
      let settings: unknown;
      try {
        const parsed = typeof settingsRaw === "string" ? JSON.parse(settingsRaw) : settingsRaw;
        settings = getParser(op)(parsed);
      } catch (err) {
        if (err instanceof Error && (err as { safe?: string }).safe) throw err;
        throw Errors.invalidSettings("Settings must be valid JSON.");
      }

      const renameTemplate = typeof req.body.renameTemplate === "string" ? req.body.renameTemplate : null;

      // One bad file must not sink the whole batch: each file is queued on
      // its own and reported back with its error.
      const results = await Promise.all(
        files.map(async (file, index) => {
          try {
            if (!file.path && !file.buffer) throw Errors.noFile();
            if (file.size === 0) throw Errors.noFile();

            let format: string;
            if (op === "video") {
              const header = file.path ? await readHeader(file.path) : file.buffer;
              format = detectVideoFormat(header, file.originalname);
            } else if (op === "audio") {
              // Audio uses its own handling; default to mp3-like format string
              format = "mp3";
            } else {
              const header = file.path ? await readHeader(file.path) : file.buffer;
              format = detectImageFormat(header, file.originalname);
            }

            const { jobId, dirs } = await createJobDirectories();
            const inputPath = file.path
              ? await moveInputFile(dirs, file.path, formatExtension(format as any))
              : await saveInputFile(dirs, file.buffer!, formatExtension(format as any));
            const baseName = sanitizeBaseName(file.originalname);
            const outputBaseName = renameTemplate
              ? applyRenameTemplate(renameTemplate, file.originalname, index + 1)
              : `${baseName}${getSuffix(op)}`;

            const record = await jobs.createJob({
              userId: req.authUser?.id ?? null,
              id: jobId,
              operation: op,
              inputFilename: file.originalname,
              inputSize: file.size,
              inputFormat: format,
              outputBaseName,
              settings: settings as ProcessingSettings,
              dirs: { ...dirs, inputPath },
            });

            return {
              index,
              filename: file.originalname,
              jobId: record.id,
              status: record.state,
              error: null,
            };
          } catch (err) {
            const message =
              err instanceof Error
                ? ((err as { safe?: string }).safe ?? err.message)
                : "Could not queue this file.";
            return {
              index,
              filename: file.originalname,
              jobId: null,
              status: "failed",
              error: message,
            };
          }
        }),
      );

      res.status(202).json({ jobIds: results.map((r) => r.jobId).filter(Boolean), jobs: results });
    } catch (err) {
      next(err);
    } finally {
      // Anything not moved into a job directory is a failed/aborted upload.
      await Promise.all(
        files
          .map((file) => file.path)
          .filter((p): p is string => Boolean(p))
          .map((p) => fsp.rm(p, { force: true }).catch(() => undefined)),
      );
    }
  });

  return router;
}

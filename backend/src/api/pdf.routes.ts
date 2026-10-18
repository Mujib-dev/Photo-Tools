import { Router } from "express";
import multer from "multer";
import path from "node:path";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";

import { config } from "../config.js";
import { Errors } from "../utils/errors.js";
import type { JobManager } from "../jobs/JobManager.js";
import type { ExeProcessRunner } from "../services/exe/ExeProcessRunner.js";
import {
  createJobDirectories,
  deleteJobDirectory,
  resolveJobDirectories,
  saveInputFile,
} from "../storage/TempFileManager.js";
import { PDF_MAX_FILES, parsePdfSettings } from "../validation/validators.js";

/** Preview render resolution; 96 dpi keeps thumbnails small but readable. */
const PREVIEW_DPI = 96;

const upload = multer({
  storage: multer.memoryStorage(),
  // "edit" sends one PDF plus its overlay images, so allow more than the
  // PDF-only limit on the count of files.
  limits: { fileSize: config.maxFileSizeBytes, files: PDF_MAX_FILES + 10, fields: 10 },
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

/** Quick PDF magic check — avoids trusting the client-supplied MIME type. */
function looksLikePdf(buffer: Buffer): boolean {
  return buffer.subarray(0, 5).toString("latin1") === "%PDF-";
}

const OUTPUT_BASE: Record<string, string> = {
  convert: "converted",
  merge: "merged",
  split: "split",
  tojpg: "pages",
  edit: "edited",
};

const IMAGE_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/bmp": "bmp",
  "image/tiff": "tiff",
};

/** Extension for an uploaded overlay image, or null when it is not an image. */
function imageExtension(file: Express.Multer.File): string | null {
  const byMime = IMAGE_MIME[file.mimetype.toLowerCase()];
  if (byMime) return byMime;
  const byName = path.extname(file.originalname).replace(".", "").toLowerCase();
  return Object.values(IMAGE_MIME).includes(byName) ? byName : null;
}

export function pdfRoutes(jobs: JobManager, runner?: ExeProcessRunner): Router {
  const router = Router();

  const previewUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: config.maxFileSizeBytes, files: 1 },
  });

  /**
   * Render page previews so the editor can show the document before any edit is
   * applied. Rendered pages live in a normal job directory, so the existing
   * retention sweeper cleans them up like any other job.
   */
  router.post("/preview", previewUpload.single("file"), async (req, res, next) => {
    let jobId: string | null = null;
    try {
      const file = req.file;
      if (!file || !file.buffer || file.size === 0 || !looksLikePdf(file.buffer)) {
        throw Errors.invalidSettings("Please upload a valid PDF to preview.");
      }

      const created = await createJobDirectories();
      jobId = created.jobId;
      const pdfPath = await saveInputFile(created.dirs, file.buffer, ".pdf");
      const previewDir = path.join(created.dirs.outputDir, "preview");

      if (!runner) {
        await deleteJobDirectory(jobId);
        jobId = null;
        throw Errors.invalidSettings("PDF previews are unavailable in this build.");
      }

      const result = await runner.run("pdf", {
        args: ["--preview", pdfPath, "--out", previewDir, "--dpi", String(PREVIEW_DPI)],
        timeoutMs: 120_000,
      });
      if (result.timedOut || result.exitCode !== 0) {
        throw Errors.processingFailed();
      }

      const manifestPath = path.join(previewDir, "preview.json");
      if (!existsSync(manifestPath)) throw Errors.processingFailed();
      const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as {
        dpi: number;
        pages: {
          index: number;
          width: number;
          height: number;
          /** Existing text, so the editor can offer click-to-edit. */
          lines?: unknown[];
          lineCount?: number;
        }[];
      };

      res.json({
        token: jobId,
        dpi: manifest.dpi,
        pages: manifest.pages,
        url: (page: number) => `/api/pdf/preview/${jobId}/${page}.jpg`,
      });
    } catch (err) {
      if (jobId) await deleteJobDirectory(jobId).catch(() => undefined);
      next(err);
    }
  });

  /** Serve one rendered preview page. */
  router.get("/preview/:token/:file", async (req, res, next) => {
    try {
      const { token, file } = req.params as { token: string; file: string };
      if (!/^[0-9a-f-]{36}$/i.test(token) || !/^page-\d{1,5}\.jpg$/.test(file)) {
        throw Errors.invalidSettings("Invalid preview reference.");
      }
      const dirs = resolveJobDirectories(token);
      const imagePath = path.join(dirs.outputDir, "preview", file);
      if (!existsSync(imagePath)) throw Errors.downloadGone();
      res.setHeader("Content-Type", "image/jpeg");
      res.setHeader("Cache-Control", "private, max-age=600");
      res.send(await readFile(imagePath));
    } catch (err) {
      next(err);
    }
  });

  router.post("/", upload.array("files"), async (req, res, next) => {
    try {
      const files = req.files as Express.Multer.File[] | undefined;
      if (!files || files.length === 0) throw Errors.noFile();
      const settings = parsePdfSettings(parseJsonField(req.body.settings, null));

      // For "edit" the first file is the document and the rest are overlay
      // images; every other op takes PDFs only.
      const [document, ...rest] = files;
      if (!document.buffer || document.size === 0 || !looksLikePdf(document.buffer)) {
        throw Errors.invalidSettings("Please upload valid PDF files.");
      }

      if (settings.op === "edit") {
        // Overlay images are resolved by the service via the asset name.
      } else {
        if (rest.some((f) => !f.buffer || f.size === 0 || !looksLikePdf(f.buffer))) {
          throw Errors.invalidSettings("Please upload valid PDF files.");
        }
        if (settings.op === "merge" && files.length < 2) {
          throw Errors.invalidSettings("Merging requires at least two PDF files.");
        }
        if (settings.op !== "merge" && files.length > 1) {
          throw Errors.invalidSettings(`"${settings.op}" processes one PDF at a time.`);
        }
      }

      const { jobId, dirs } = await createJobDirectories();
      const inputFiles: string[] = [];
      let totalSize = 0;

      // Save the document, then any overlay images. Asset names in the plan are
      // rewritten to the on-disk names so the service can resolve them safely.
      const assetMap = new Map<string, string>();
      for (const [index, file] of files.entries()) {
        const isDocument = index === 0;
        const ext = isDocument ? ".pdf" : imageExtension(file);
        if (!isDocument && !ext) {
          await deleteJobDirectory(jobId);
          throw Errors.invalidSettings("Overlay files must be PDF-page images.");
        }
        const inputPath = await saveInputFile(dirs, file.buffer, ext ?? ".pdf");
        const savedName = path.basename(inputPath);
        if (!isDocument) assetMap.set(file.originalname, savedName);
        inputFiles.push(savedName);
        totalSize += file.size;
      }

      const plan =
        settings.op === "edit"
          ? {
              ...settings.plan,
              annotations: settings.plan.annotations.map((ann) =>
                ann.kind === "image" ? { ...ann, asset: assetMap.get(ann.asset) ?? "" } : ann,
              ),
            }
          : settings.plan;

      const record = await jobs.createJob({
        id: jobId,
        operation: "pdf",
        inputFilename: files.length === 1 ? files[0].originalname : `${files.length} documents`,
        inputSize: totalSize,
        inputFormat: "pdf",
        outputBaseName: OUTPUT_BASE[settings.op],
        settings: { ...settings, plan, inputsDir: dirs.inputDir, inputFiles },
        dirs: { ...dirs, inputPath: inputFiles.length > 0 ? `${dirs.inputDir}/${inputFiles[0]}` : "" },
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

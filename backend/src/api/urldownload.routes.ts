import fsp from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { Router } from "express";

import { config } from "../config.js";
import { Errors } from "../utils/errors.js";
import type { JobManager } from "../jobs/JobManager.js";
import { createJobDirectories } from "../storage/TempFileManager.js";
import { analyzeSource, describeQualities } from "../services/url/adapters.js";
import { parseUrlDownloadSettings, sanitizeBaseName } from "../validation/validators.js";

/**
 * URL downloader endpoints. `POST /analyze` inspects a link and returns its
 * quality options; `POST /` queues a fetch/convert job. Both are gated behind
 * authentication + rate limiting by the app wiring, and both refuse anything
 * that is not a direct media file or an HLS playlist.
 */
export function urlDownloadRoutes(jobs: JobManager): Router {
  const router = Router();

  router.post("/analyze", async (req, res, next) => {
    try {
      if (!config.urlDownloadEnabled) throw Errors.urlDownloadDisabled();
      const body = (req.body ?? {}) as { url?: unknown };
      const info = await analyzeSource(typeof body.url === "string" ? body.url : "");
      res.json({
        url: info.finalUrl,
        title: info.title,
        kind: info.kind,
        uploader: info.uploader ?? null,
        thumbnail: info.thumbnail ?? null,
        contentType: info.contentType,
        contentLength: info.contentLength,
        durationSec: info.durationSec ?? null,
        width: info.width ?? null,
        height: info.height ?? null,
        qualities: describeQualities(info),
        formats: ["mp4", "webm", "mp3", "m4a"],
      });
    } catch (err) {
      next(err);
    }
  });

  router.post("/", async (req, res, next) => {
    try {
      if (!config.urlDownloadEnabled) throw Errors.urlDownloadDisabled();
      const settings = parseUrlDownloadSettings(req.body ?? {});

      const { jobId, dirs } = await createJobDirectories();
      const inputPath = path.join(dirs.inputDir, `${crypto.randomUUID()}.url`);
      const contents = Buffer.from(settings.url, "utf8");
      await fsp.writeFile(inputPath, contents);

      const title = settings.title || "Online Media";
      const inputFormat = settings.kind === "hls" ? "hls" : settings.kind === "stream" ? "stream" : "media";

      const record = await jobs.createJob({
        userId: req.authUser?.id ?? null,
        id: jobId,
        operation: "fetch",
        inputFilename: title,
        inputSize: contents.length,
        inputFormat,
        outputBaseName: sanitizeBaseName(title, "download"),
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

import { existsSync } from "node:fs";
import path from "node:path";

import { ExeProcessRunner } from "./ExeProcessRunner.js";
import type { ProcessingRequest, ProcessingResult, ProcessingService } from "../ProcessingService.js";
import type { WatermarkSettings } from "../../validation/validators.js";
import { logger } from "../../utils/logger.js";
import { Errors } from "../../utils/errors.js";

/**
 * Drives PhotoWatermark.exe: tiles or places a text watermark over the image
 * with configurable opacity, size and colour.
 */
export class ExeWatermarkService implements ProcessingService {
  readonly operation = "watermark" as const;

  constructor(private readonly runner: ExeProcessRunner) {}

  async process(request: ProcessingRequest): Promise<ProcessingResult> {
    const settings = request.settings as WatermarkSettings;
    const ext = settings.format === "jpeg" ? "jpg" : settings.format;
    const outputPath = path.join(request.outputDir, `${request.outputBaseName}.${ext}`);

    const args = [
      "--input",
      request.inputPath,
      "--output",
      outputPath,
      "--position",
      settings.position,
      "--opacity",
      String(settings.opacity),
      "--size",
      String(settings.size),
      "--color",
      settings.color,
      "--format",
      ext,
    ];

    if (settings.imageWatermarkPath) {
      args.push("--image-watermark", settings.imageWatermarkPath);
    }
    if (settings.text) {
      args.push("--text", settings.text);
    }

    const result = await this.runner.run("watermark", { args });

    if (result.timedOut) {
      logger.error("PhotoWatermark timed out", { input: request.inputPath });
      throw Errors.timeout();
    }
    if (result.exitCode !== 0) {
      logger.error("PhotoWatermark failed", {
        exitCode: result.exitCode,
        stderr: result.stderr.slice(-2000),
      });
      throw Errors.exeError();
    }
    if (!existsSync(outputPath)) {
      logger.error("PhotoWatermark reported success but no output file was produced", { outputPath });
      throw Errors.processingFailed();
    }

    return { outputPath };
  }
}

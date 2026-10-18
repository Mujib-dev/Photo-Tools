import { existsSync } from "node:fs";
import path from "node:path";

import { ExeProcessRunner } from "./ExeProcessRunner.js";
import type { ProcessingRequest, ProcessingResult, ProcessingService } from "../ProcessingService.js";
import type { EnhanceSettings } from "../../validation/validators.js";
import { logger } from "../../utils/logger.js";
import { Errors } from "../../utils/errors.js";

/**
 * Drives PhotoEnhancer.exe (Pillow-based classic enhancement: denoise, upscale,
 * saturation, brightness, contrast, sharpness). Auto mode applies a balanced
 * recipe; manual mode uses the exact slider values.
 */
export class ExeEnhancerService implements ProcessingService {
  readonly operation = "enhance" as const;

  constructor(private readonly runner: ExeProcessRunner) {}

  async process(request: ProcessingRequest): Promise<ProcessingResult> {
    const settings = request.settings as EnhanceSettings;
    const ext = settings.format === "jpeg" ? "jpg" : settings.format;
    const outputPath = path.join(request.outputDir, `${request.outputBaseName}.${ext}`);

    const args = [
      "--input",
      request.inputPath,
      "--output",
      outputPath,
      "--auto",
      settings.auto ? "1" : "0",
    ];

    if (settings.region) {
      const { x, y, width, height } = settings.region;
      args.push("--region", `${x},${y},${width},${height}`);
    }

    if (settings.aiUpscale) args.push("--ai-upscale", String(settings.aiUpscale));

    if (!settings.auto) {
      if (settings.sharpness !== undefined) args.push("--sharpness", String(settings.sharpness));
      if (settings.contrast !== undefined) args.push("--contrast", String(settings.contrast));
      if (settings.saturation !== undefined) args.push("--saturation", String(settings.saturation));
      if (settings.brightness !== undefined) args.push("--brightness", String(settings.brightness));
      if (settings.denoise !== undefined) args.push("--denoise", String(settings.denoise));
      if (settings.scale !== undefined) args.push("--scale", String(settings.scale));
    }

    const result = await this.runner.run("enhance", {
      args,
      timeoutMs: settings.aiUpscale ? 900_000 : undefined,
    });

    if (result.timedOut) {
      logger.error("PhotoEnhancer timed out", { input: request.inputPath });
      throw Errors.timeout();
    }
    if (result.exitCode !== 0) {
      logger.error("PhotoEnhancer failed", {
        exitCode: result.exitCode,
        stderr: result.stderr.slice(-2000),
        args,
      });
      throw Errors.exeError();
    }
    if (!existsSync(outputPath)) {
      logger.error("PhotoEnhancer reported success but no output file was produced", { outputPath });
      throw Errors.processingFailed();
    }

    return { outputPath };
  }
}

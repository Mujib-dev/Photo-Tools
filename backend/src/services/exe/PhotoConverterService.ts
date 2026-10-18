import { existsSync } from "node:fs";
import path from "node:path";

import { ExeProcessRunner } from "./ExeProcessRunner.js";
import type { ProcessingRequest, ProcessingResult, ProcessingService } from "../ProcessingService.js";
import type { ConvertSettings } from "../../validation/validators.js";
import { logger } from "../../utils/logger.js";
import { Errors } from "../../utils/errors.js";

/**
 * Drives PhotoConverter.exe (the existing "Modern ICO Converter" engine, rebuilt
 * with a CLI). The CLI performs the exact same conversion pipeline as the
 * desktop app: RGBA -> center square crop -> LANCZOS resize -> multi-size .ico.
 * It also supports plain format conversion (png, jpg, bmp, tiff, webp, gif)
 * which preserves the original dimensions.
 */
export class ExeConvertService implements ProcessingService {
  readonly operation = "convert" as const;

  constructor(private readonly runner: ExeProcessRunner) {}

  async process(request: ProcessingRequest): Promise<ProcessingResult> {
    const settings = request.settings as ConvertSettings;
    const ext = settings.format === "jpeg" ? "jpg" : settings.format;
    const outputPath = path.join(request.outputDir, `${request.outputBaseName}.${ext}`);

    const args = ["--input", request.inputPath, "--output", outputPath];

    if (settings.format === "ico") {
      args.push("--sizes", settings.sizes.join(","));
    } else {
      args.push("--format", settings.format);
    }

    const result = await this.runner.run("convert", { args });

    if (result.timedOut) {
      logger.error("PhotoConverter timed out", { input: request.inputPath });
      throw Errors.timeout();
    }
    if (result.exitCode !== 0) {
      logger.error("PhotoConverter failed", {
        exitCode: result.exitCode,
        stderr: result.stderr.slice(-2000),
        args,
      });
      throw Errors.exeError();
    }
    if (!existsSync(outputPath)) {
      logger.error("PhotoConverter reported success but no output file was produced", { outputPath });
      throw Errors.processingFailed();
    }

    return { outputPath };
  }
}

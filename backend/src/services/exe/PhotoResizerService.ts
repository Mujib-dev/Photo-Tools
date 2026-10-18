import { existsSync } from "node:fs";
import path from "node:path";

import { ExeProcessRunner } from "./ExeProcessRunner.js";
import type { ProcessingRequest, ProcessingResult, ProcessingService } from "../ProcessingService.js";
import type { ResizeSettings } from "../../validation/validators.js";
import { outputExtension } from "../../validation/validators.js";
import { logger } from "../../utils/logger.js";
import { Errors } from "../../utils/errors.js";

/**
 * Drives PhotoResizer.exe (the existing desktop engine, rebuilt with a CLI).
 * The CLI performs the exact same Pillow resize pipeline as the desktop app:
 *   open -> convert("RGB") -> resize(LANCZOS) -> save with DPI metadata.
 */
export class ExeResizeService implements ProcessingService {
  readonly operation = "resize" as const;

  constructor(private readonly runner: ExeProcessRunner) {}

  async process(request: ProcessingRequest): Promise<ProcessingResult> {
    const settings = request.settings as ResizeSettings;
    const ext = outputExtension(settings.format);
    const outputPath = path.join(request.outputDir, `${request.outputBaseName}.${ext}`);

    const args = [
      "--input",
      request.inputPath,
      "--output",
      outputPath,
      "--width",
      String(settings.width),
      "--height",
      String(settings.height),
      "--mode",
      settings.mode,
      "--dpi",
      String(settings.dpi),
    ];

    const result = await this.runner.run("resize", { args });

    if (result.timedOut) {
      logger.error("PhotoResizer timed out", { input: request.inputPath });
      throw Errors.timeout();
    }
    if (result.exitCode !== 0) {
      logger.error("PhotoResizer failed", {
        exitCode: result.exitCode,
        stderr: result.stderr.slice(-2000),
        args,
      });
      throw Errors.exeError();
    }
    if (!existsSync(outputPath)) {
      logger.error("PhotoResizer reported success but no output file was produced", { outputPath });
      throw Errors.processingFailed();
    }

    return { outputPath };
  }
}

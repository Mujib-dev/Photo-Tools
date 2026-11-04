import { existsSync } from "node:fs";
import path from "node:path";

import { ExeProcessRunner } from "./ExeProcessRunner.js";
import type { ProcessingRequest, ProcessingResult, ProcessingService } from "../ProcessingService.js";
import type { RemoveBgSettings } from "../../validation/validators.js";
import { logger } from "../../utils/logger.js";
import { Errors } from "../../utils/errors.js";

/**
 * Drives PhotoRemoveBg.exe (rembg/U2Net): AI subject cut-out with a
 * transparent, white or black background. The model downloads once on first
 * use, so the timeout is generous.
 */
export class ExeRemoveBgService implements ProcessingService {
  readonly operation = "removebg" as const;

  constructor(private readonly runner: ExeProcessRunner) {}

  async process(request: ProcessingRequest): Promise<ProcessingResult> {
    const settings = request.settings as RemoveBgSettings;
    const outputPath = path.join(request.outputDir, `${request.outputBaseName}.${settings.format}`);

    // The U2Net inference runs on CPU and the first run downloads the model.
    const args = [
      "--input",
      request.inputPath,
      "--output",
      outputPath,
      "--background",
      settings.background,
      "--format",
      settings.format,
    ];
    if (settings.background === "custom" && settings.customColor) {
      args.push("--custom-color", settings.customColor);
    }
    if (settings.model) {
      args.push("--model", settings.model);
    }
    const result = await this.runner.run("removebg", {
      args,
      timeoutMs: 600_000,
    });

    if (result.timedOut) {
      logger.error("PhotoRemoveBg timed out", { input: request.inputPath });
      throw Errors.timeout();
    }
    if (result.exitCode !== 0) {
      logger.error("PhotoRemoveBg failed", {
        exitCode: result.exitCode,
        stderr: result.stderr.slice(-2000),
      });
      throw Errors.exeError();
    }
    if (!existsSync(outputPath)) {
      logger.error("PhotoRemoveBg reported success but no output file was produced", { outputPath });
      throw Errors.processingFailed();
    }

    return { outputPath };
  }
}

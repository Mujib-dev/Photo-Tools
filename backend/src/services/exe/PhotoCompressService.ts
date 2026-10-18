import { existsSync } from "node:fs";
import path from "node:path";

import { ExeProcessRunner } from "./ExeProcessRunner.js";
import type { ProcessingRequest, ProcessingResult, ProcessingService } from "../ProcessingService.js";
import type { CompressSettings } from "../../validation/validators.js";
import { logger } from "../../utils/logger.js";
import { Errors } from "../../utils/errors.js";

/**
 * Drives PhotoCompress.exe: binary-search JPEG/WebP quality until the output
 * is at or under the requested size. `format=keep` re-encodes in the input's
 * lossy format (JPG stays JPG; PNG/GIF/BMP/TIFF fall back to JPG).
 */
export class ExeCompressService implements ProcessingService {
  readonly operation = "compress" as const;

  constructor(private readonly runner: ExeProcessRunner) {}

  async process(request: ProcessingRequest): Promise<ProcessingResult> {
    const settings = request.settings as CompressSettings;
    const ext = settings.format === "keep" ? "auto" : settings.format;
    const outputPath = path.join(request.outputDir, `${request.outputBaseName}.out`);

    const result = await this.runner.run("compress", {
      args: [
        "--input",
        request.inputPath,
        "--output",
        outputPath,
        "--target-kb",
        String(settings.targetKb),
        "--format",
        ext,
      ],
      timeoutMs: 300_000,
    });

    if (result.timedOut) {
      logger.error("PhotoCompress timed out", { input: request.inputPath });
      throw Errors.timeout();
    }
    if (result.exitCode !== 0) {
      logger.error("PhotoCompress failed", {
        exitCode: result.exitCode,
        stderr: result.stderr.slice(-2000),
      });
      throw Errors.exeError();
    }

    // The engine appends the real extension (jpg/webp) after choosing format.
    const candidates = [`${outputPath}.jpg`, `${outputPath}.webp`];
    const produced = candidates.find((c) => existsSync(c));
    if (!produced) {
      logger.error("PhotoCompress reported success but no output file was produced", {
        outputDir: request.outputDir,
      });
      throw Errors.processingFailed();
    }

    return { outputPath: produced };
  }
}

import { existsSync } from "node:fs";
import path from "node:path";
import { writeFileSync } from "node:fs";

import { ExeProcessRunner } from "./ExeProcessRunner.js";
import type { ProcessingRequest, ProcessingResult, ProcessingService } from "../ProcessingService.js";
import type { PdfSettings } from "../../validation/validators.js";
import { logger } from "../../utils/logger.js";
import { Errors } from "../../utils/errors.js";

const PRIMARY_OUTPUT: Record<PdfSettings["op"], (base: string) => string> = {
  convert: (base) => `${base}.docx`,
  merge: (base) => `${base}.pdf`,
  split: (base) => `${base}.zip`,
  tojpg: (base) => `${base}.zip`,
  edit: (base) => `${base}.pdf`,
  compress: (base) => `${base}.pdf`,
  img2pdf: (base) => `${base}.pdf`,
  protect: (base) => `${base}-protected.pdf`,
  unlock: (base) => `${base}-unlocked.pdf`,
};

/**
 * Drives PhotoPdf.exe (offline PDF toolkit): PDF→Word, merge, split,
 * PDF→JPG and the page/overlay editor. Every op writes exactly one primary
 * artifact into outputDir.
 */
export class ExePdfService implements ProcessingService {
  readonly operation = "pdf" as const;

  constructor(private readonly runner: ExeProcessRunner) {}

  async process(request: ProcessingRequest): Promise<ProcessingResult> {
    const settings = request.settings as PdfSettings;
    const outputPath = path.join(request.outputDir, PRIMARY_OUTPUT[settings.op](request.outputBaseName));

    const jobsFile = path.join(request.outputDir, "pdf-jobs.json");
    const jobs = {
      op: settings.op,
      outputDir: request.outputDir,
      outputBase: request.outputBaseName,
      inputs: settings.inputFiles.map((name) => path.join(settings.inputsDir, name)),
      // The engine runs outside the web process, so overlay assets have to be
      // handed over as absolute paths.
      plan:
        settings.op === "edit"
          ? {
              ...settings.plan,
              annotations: settings.plan.annotations.map((ann) =>
                ann.kind === "image" ? { ...ann, asset: path.join(settings.inputsDir, ann.asset) } : ann,
              ),
            }
          : undefined,
    };
    writeFileSync(jobsFile, JSON.stringify(jobs), "utf8");

    const result = await this.runner.run("pdf", {
      args: ["--jobs", jobsFile],
      timeoutMs: 600_000,
    });

    if (result.timedOut) {
      logger.error("PhotoPdf timed out", { op: settings.op });
      throw Errors.timeout();
    }
    if (result.exitCode !== 0) {
      logger.error("PhotoPdf failed", {
        exitCode: result.exitCode,
        stderr: result.stderr.slice(-2000),
        args: ["--jobs", jobsFile],
      });
      throw Errors.processingFailed();
    }
    if (!existsSync(outputPath)) {
      logger.error("PhotoPdf reported success but no output file was produced", { outputPath });
      throw Errors.processingFailed();
    }

    return { outputPath };
  }
}

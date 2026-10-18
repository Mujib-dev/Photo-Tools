import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { ExeProcessRunner } from "./ExeProcessRunner.js";
import type { ProcessingRequest, ProcessingResult, ProcessingService } from "../ProcessingService.js";
import type { ScanSettings } from "../../validation/validators.js";
import { config } from "../../config.js";
import { logger } from "../../utils/logger.js";
import { Errors } from "../../utils/errors.js";

const SCAN_PDF = "scan.pdf";

export interface ScanDetection {
  corners: [number, number][] | null;
}

/**
 * Drives PhotoScanner.exe (OpenCV + Pillow): document edge detection, corner
 * transformation, perspective correction, scan enhancement and multi-page
 * PDF/ZIP export.
 */
export class ExeScannerService implements ProcessingService {
  readonly operation = "scan" as const;

  constructor(private readonly runner: ExeProcessRunner) {}

  async process(request: ProcessingRequest): Promise<ProcessingResult> {
    const settings = request.settings as ScanSettings;
    if (settings.pages.length === 0) throw Errors.invalidSettings();

    const jobsFile = path.join(request.outputDir, "scan-jobs.json");
    const jobs = {
      outputDir: request.outputDir,
      outputBase: "scan",
      format: settings.format,
      pages: settings.pages.map((p) => ({
        input: p.inputPath,
        corners: p.corners,
        rotate: p.rotate,
        mode: p.mode,
      })),
    };
    writeFileSync(jobsFile, JSON.stringify(jobs), "utf8");

    const result = await this.runner.run("scan", {
      args: ["--jobs", jobsFile],
      timeoutMs: config.scanProcessTimeoutMs,
    });

    if (result.timedOut) {
      logger.error("PhotoScanner timed out", { jobId: request.outputBaseName });
      throw Errors.timeout();
    }
    if (result.exitCode !== 0) {
      logger.error("PhotoScanner failed", {
        exitCode: result.exitCode,
        stderr: result.stderr.slice(-2000),
      });
      throw Errors.exeError();
    }

    const outputPath = path.join(request.outputDir, SCAN_PDF);
    if (!existsSync(outputPath)) {
      logger.error("PhotoScanner reported success but no scan.pdf was produced", { outputDir: request.outputDir });
      throw Errors.processingFailed();
    }

    return { outputPath };
  }

  /**
   * Run edge detection on a single uploaded image and return the detected
   * page corners (TL, TR, BR, BL) in the image's pixel space, already rotated
   * by `rotate` degrees clockwise when requested. Returns null corners when no
   * document boundary is found.
   */
  async detect(inputPath: string, rotate: number, workDir: string): Promise<ScanDetection> {
    const outJson = path.join(workDir, "detect.json");
    const args = ["--detect", inputPath, "--out-json", outJson];
    if (rotate) args.push("--rotate", String(rotate));

    const result = await this.runner.run("scan", { args });
    if (result.exitCode !== 0) {
      logger.error("PhotoScanner detect failed", {
        exitCode: result.exitCode,
        stderr: result.stderr.slice(-2000),
      });
      throw Errors.exeError();
    }

    try {
      const data = JSON.parse(readFileSync(outJson, "utf8")) as { corners?: [number, number][] | null };
      return { corners: data.corners ?? null };
    } catch {
      throw Errors.processingFailed();
    }
  }
}

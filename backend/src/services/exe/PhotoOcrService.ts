import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import readline from "node:readline";

import { config } from "../../config.js";
import { Errors } from "../../utils/errors.js";
import { logger } from "../../utils/logger.js";
import type { ProcessingRequest, ProcessingResult, ProcessingService } from "../ProcessingService.js";
import type { OcrSettings } from "../../validation/validators.js";

export interface OcrWord {
  text: string;
  rect: { x: number; y: number; w: number; h: number };
}

export interface OcrLine {
  text: string;
  words: OcrWord[];
}

export interface OcrPage {
  page: number;
  width: number;
  height: number;
  text: string;
  textAngle: number;
  lines: OcrLine[];
}

export interface OcrAnalysisResult {
  totalPages: number;
  totalWords: number;
  fullText: string;
  pages: OcrPage[];
}

export interface OcrLanguage {
  languageTag: string;
  displayName: string;
  nativeName: string;
}

export class ExeOcrService implements ProcessingService {
  readonly operation = "ocr" as const;

  async process(request: ProcessingRequest): Promise<ProcessingResult> {
    const settings = request.settings as OcrSettings;
    const format = settings.format || "txt";
    const extension = format === "docx" ? "docx" : format === "json" ? "json" : "txt";
    const outputPath = path.join(request.outputDir, `${request.outputBaseName}.${extension}`);

    const python = config.pythonExe || "python";
    const script = config.ocrExtractorScript;

    const args = ["extract", request.inputPath, "--format", format, "--output", outputPath];
    if (settings.language) {
      args.push("--language", settings.language);
    }

    await new Promise<void>((resolve, reject) => {
      const child = spawn(python, [script, ...args], {
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      });

      const rl = readline.createInterface({ input: child.stdout });
      rl.on("line", (line) => {
        const trimmed = line.trim();
        if (trimmed.startsWith("PROGRESS:")) {
          const frac = Number.parseFloat(trimmed.slice("PROGRESS:".length));
          if (Number.isFinite(frac) && request.onProgress) {
            request.onProgress(frac);
          }
        }
      });

      let stderr = "";
      child.stderr.on("data", (chunk: Buffer) => {
        stderr += chunk.toString("utf8");
      });

      const timer = setTimeout(() => {
        child.kill("SIGKILL");
        reject(Errors.timeout());
      }, 300_000);

      child.on("error", (err) => {
        clearTimeout(timer);
        logger.error("Failed to spawn OCR python process", { error: err.message });
        reject(Errors.processingFailed());
      });

      child.on("close", (code) => {
        clearTimeout(timer);
        if (code !== 0) {
          logger.error("OCR extraction failed", { code, stderr: stderr.slice(-1000) });
          reject(Errors.processingFailed());
          return;
        }
        if (!existsSync(outputPath)) {
          logger.error("OCR finished but no output file was written", { outputPath });
          reject(Errors.processingFailed());
          return;
        }
        request.onProgress?.(1);
        resolve();
      });
    });

    return { outputPath };
  }

  static async analyze(inputPath: string, language?: string): Promise<OcrAnalysisResult> {
    const python = config.pythonExe || "python";
    const script = config.ocrExtractorScript;

    const args = ["extract", inputPath, "--format", "json"];
    if (language) {
      args.push("--language", language);
    }

    return new Promise((resolve, reject) => {
      const child = spawn(python, [script, ...args], {
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";

      child.stdout.on("data", (chunk: Buffer) => {
        stdout += chunk.toString("utf8");
      });

      child.stderr.on("data", (chunk: Buffer) => {
        stderr += chunk.toString("utf8");
      });

      const timer = setTimeout(() => {
        child.kill("SIGKILL");
        reject(Errors.timeout());
      }, 120_000);

      child.on("error", (err) => {
        clearTimeout(timer);
        logger.error("Failed to spawn OCR process for analyze", { error: err.message });
        reject(Errors.processingFailed());
      });

      child.on("close", (code) => {
        clearTimeout(timer);
        if (code !== 0) {
          logger.error("OCR analyze failed", { code, stderr: stderr.slice(-1000) });
          reject(Errors.processingFailed());
          return;
        }

        try {
          // stdout may contain PROGRESS: lines before the JSON line
          const lines = stdout.trim().split("\n");
          const jsonLine = lines.find((l) => l.trim().startsWith("{") && l.trim().endsWith("}"));
          if (!jsonLine) {
            throw new Error("No JSON found in OCR output");
          }
          const parsed = JSON.parse(jsonLine.trim()) as OcrAnalysisResult;
          resolve(parsed);
        } catch (err) {
          logger.error("Failed to parse OCR analyze JSON", { err, stdout: stdout.slice(-400) });
          reject(Errors.processingFailed());
        }
      });
    });
  }

  static async getLanguages(): Promise<OcrLanguage[]> {
    const python = config.pythonExe || "python";
    const script = config.ocrExtractorScript;

    return new Promise((resolve) => {
      const child = spawn(python, [script, "languages"], {
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      });

      let stdout = "";
      child.stdout.on("data", (chunk: Buffer) => {
        stdout += chunk.toString("utf8");
      });

      const timer = setTimeout(() => {
        child.kill("SIGKILL");
        resolve([{ languageTag: "en-US", displayName: "English (United States)", nativeName: "English (United States)" }]);
      }, 15_000);

      child.on("error", () => {
        clearTimeout(timer);
        resolve([{ languageTag: "en-US", displayName: "English (United States)", nativeName: "English (United States)" }]);
      });

      child.on("close", (code) => {
        clearTimeout(timer);
        if (code !== 0) {
          resolve([{ languageTag: "en-US", displayName: "English (United States)", nativeName: "English (United States)" }]);
          return;
        }
        try {
          const langs = JSON.parse(stdout.trim()) as OcrLanguage[];
          resolve(langs);
        } catch {
          resolve([{ languageTag: "en-US", displayName: "English (United States)", nativeName: "English (United States)" }]);
        }
      });
    });
  }
}

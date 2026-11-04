import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { existsSync } from "node:fs";

import { config } from "../config.js";
import { logger } from "../utils/logger.js";

const JOB_PREFIX = "job-";

export interface JobDirectories {
  jobDir: string;
  inputDir: string;
  outputDir: string;
  logsDir: string;
}

async function ensureDir(p: string): Promise<void> {
  await fs.mkdir(p, { recursive: true });
}

export async function createJobDirectories(): Promise<{ jobId: string; dirs: JobDirectories }> {
  const jobId = crypto.randomUUID();
  const jobDir = path.join(config.tempDirectory, `${JOB_PREFIX}${jobId}`);
  const dirs: JobDirectories = {
    jobDir,
    inputDir: path.join(jobDir, "input"),
    outputDir: path.join(jobDir, "output"),
    logsDir: path.join(jobDir, "logs"),
  };
  await Promise.all([
    ensureDir(dirs.inputDir),
    ensureDir(dirs.outputDir),
    ensureDir(dirs.logsDir),
  ]);
  return { jobId, dirs };
}

/** Save the uploaded bytes using an internally generated, sanitized name. */
export async function saveInputFile(dirs: JobDirectories, buffer: Buffer, ext: string): Promise<string> {
  const safeExt = ext.replace(/[^a-z0-9]/gi, "").toLowerCase().slice(0, 5) || "bin";
  const name = `${crypto.randomUUID()}.${safeExt}`;
  const filePath = path.join(dirs.inputDir, name);
  await fs.writeFile(filePath, buffer);
  return filePath;
}

/**
 * Move an already-staged upload (e.g. one multer wrote to disk) into the job's
 * input directory under an internally generated name. Falls back to a copy
 * when the source and destination live on different volumes.
 */
export async function moveInputFile(
  dirs: JobDirectories,
  sourcePath: string,
  ext: string,
): Promise<string> {
  const safeExt = ext.replace(/[^a-z0-9]/gi, "").toLowerCase().slice(0, 5) || "bin";
  const name = `${crypto.randomUUID()}.${safeExt}`;
  const filePath = path.join(dirs.inputDir, name);
  try {
    await fs.rename(sourcePath, filePath);
  } catch {
    await fs.copyFile(sourcePath, filePath);
    await fs.rm(sourcePath, { force: true });
  }
  return filePath;
}

export async function writeLog(dirs: JobDirectories, filename: string, content: string): Promise<void> {
  try {
    await fs.writeFile(path.join(dirs.logsDir, filename), content, "utf8");
  } catch (err) {
    logger.warn("Failed to write job log", { filename, error: String(err) });
  }
}

/** List files inside the job's output directory. */
export async function listOutputFiles(dirs: JobDirectories): Promise<string[]> {
  try {
    return (await fs.readdir(dirs.outputDir)).map((f) => path.join(dirs.outputDir, f));
  } catch {
    return [];
  }
}

/** Recursively remove a job directory. */
export async function deleteJobDirectory(jobId: string): Promise<void> {
  const jobDir = path.join(config.tempDirectory, `${JOB_PREFIX}${jobId}`);
  await fs.rm(jobDir, { recursive: true, force: true });
}

/** Returns true when a job's temporary directory still exists. */
export function jobDirectoryExists(jobId: string): boolean {
  return existsSync(path.join(config.tempDirectory, `${JOB_PREFIX}${jobId}`));
}

/** Recompute a job's directory layout from its id (used for downloads). */
export function resolveJobDirectories(jobId: string): JobDirectories {
  const jobDir = path.join(config.tempDirectory, `${JOB_PREFIX}${jobId}`);
  return {
    jobDir,
    inputDir: path.join(jobDir, "input"),
    outputDir: path.join(jobDir, "output"),
    logsDir: path.join(jobDir, "logs"),
  };
}

/**
 * Automatic cleanup of abandoned jobs: removes every job-* directory older
 * than the retention window. Runs on an interval; also exported for manual use.
 */
export async function sweepAbandonedJobs(now = Date.now()): Promise<number> {
  const retentionMs = config.jobRetentionMinutes * 60 * 1000;
  let removed = 0;
  try {
    const entries = await fs.readdir(config.tempDirectory, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || !entry.name.startsWith(JOB_PREFIX)) continue;
      const dirPath = path.join(config.tempDirectory, entry.name);
      try {
        const stat = await fs.stat(dirPath);
        if (now - stat.mtimeMs > retentionMs) {
          await fs.rm(dirPath, { recursive: true, force: true });
          removed += 1;
        }
      } catch (err) {
        logger.warn(`Could not sweep job dir ${entry.name}`, { error: String(err) });
      }
    }
  } catch (err) {
    logger.warn("Temp sweep failed", { error: String(err) });
  }
  return removed;
}

export function startCleanupSweeper(): () => void {
  const timer = setInterval(() => {
    sweepAbandonedJobs()
      .then((n) => {
        if (n > 0) logger.info(`Cleaned up ${n} abandoned job director${n === 1 ? "y" : "ies"}`);
      })
      .catch(() => undefined);
  }, config.cleanupIntervalMs);
  timer.unref();
  return () => clearInterval(timer);
}

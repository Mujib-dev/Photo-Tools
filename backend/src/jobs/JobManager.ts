import { EventEmitter } from "node:events";
import { stat } from "node:fs/promises";
import path from "node:path";

import { config } from "../config.js";
import { logger } from "../utils/logger.js";
import { Errors } from "../utils/errors.js";
import type { JobStore } from "./store/JobStore.js";
import type { QueueProvider } from "./queue/QueueProvider.js";
import type { JobOperation, JobPayload, JobRecord } from "./JobTypes.js";
import type { ProcessingService } from "../services/ProcessingService.js";
import type { ProcessingSettings } from "../services/ProcessingService.js";
import { deleteJobDirectory } from "../storage/TempFileManager.js";

export interface CreateJobInput {
  operation: JobOperation;
  inputFilename: string;
  inputSize: number;
  inputFormat: string;
  outputBaseName: string;
  settings: ProcessingSettings;
  dirs: { inputDir: string; outputDir: string; logsDir: string; inputPath: string };
}

function friendlyError(err: unknown): string {
  if (err instanceof Error && (err as unknown as { safe?: string }).safe) {
    return (err as unknown as { safe: string }).safe;
  }
  return "Unable to process the image.";
}

export class JobManager extends EventEmitter {
  private services: Record<JobOperation, ProcessingService>;
  private progressAt = new Map<string, { pct: number; ts: number }>();

  constructor(
    private readonly store: JobStore,
    private readonly queue: QueueProvider,
    services: Record<JobOperation, ProcessingService>,
  ) {
    super();
    this.services = services;
  }

  async updateAndEmit(jobId: string, patch: Partial<JobRecord>): Promise<void> {
    await this.store.update(jobId, patch);
    const updated = await this.store.get(jobId);
    if (updated) {
      this.emit(`job:${jobId}`, updated);
    }
  }

  async init(): Promise<void> {
    await this.store.init();
    this.queue.onProcess((payload) => this.process(payload));
    if (this.queue.kind === "bullmq") {
      await (this.queue as unknown as { connect: () => Promise<void> }).connect();
    }
    logger.info(`Job system ready (queue=${this.queue.kind}, store=${this.store.kind}, maxConcurrent=${config.maxConcurrentJobs})`);
  }

  async createJob(input: CreateJobInput & { id: string }): Promise<JobRecord> {
    const now = Date.now();
    const record: JobRecord = {
      id: input.id,
      operation: input.operation,
      inputFilename: input.inputFilename,
      inputSize: input.inputSize,
      inputFormat: input.inputFormat,
      outputFilename: null,
      outputSize: null,
      outputFormat: null,
      state: "queued",
      stage: "Queued",
      error: null,
      createdAt: now,
      updatedAt: now,
      processedAt: null,
    };
    await this.store.create(record);

    const payload: JobPayload = {
      jobId: input.id,
      operation: input.operation,
      inputPath: input.dirs.inputPath,
      outputDir: input.dirs.outputDir,
      outputBaseName: input.outputBaseName,
      settings: input.settings,
      inputDir: input.dirs.inputDir,
      logsDir: input.dirs.logsDir,
    };
    await this.queue.enqueue(payload);
    return record;
  }

  private async process(payload: JobPayload): Promise<void> {
    const { jobId, operation } = payload;
    try {
      await this.updateAndEmit(jobId, { state: "processing", stage: "Processing…" });
      const service = this.services[operation];
      const result = await service.process({
        inputPath: payload.inputPath,
        outputDir: payload.outputDir,
        outputBaseName: payload.outputBaseName,
        settings: payload.settings,
        onProgress: (fraction) => this.reportProgress(jobId, fraction),
      });

      const info = await stat(result.outputPath);
      const outputFormat = path.extname(result.outputPath).replace(".", "").toLowerCase();

      await this.updateAndEmit(jobId, {
        state: "completed",
        stage: "Completed",
        outputFilename: path.basename(result.outputPath),
        outputSize: info.size,
        outputFormat,
        processedAt: Date.now(),
      });
      logger.info(`Job ${jobId} completed`, { output: result.outputPath, bytes: info.size });
    } catch (err) {
      const safe = friendlyError(err);
      logger.error(`Job ${jobId} failed`, { operation, error: err instanceof Error ? err.message : String(err) });
      await this.updateAndEmit(jobId, { state: "failed", stage: "Failed", error: safe });
    } finally {
      this.progressAt.delete(jobId);
    }
  }

  /** Persist an in-flight percentage, throttled to avoid spamming the store. */
  private reportProgress(jobId: string, fraction: number): void {
    if (!Number.isFinite(fraction)) return;
    const pct = Math.max(0, Math.min(99, Math.round(fraction * 100)));
    const now = Date.now();
    const last = this.progressAt.get(jobId);
    if (last && last.pct === pct) return;
    if (last && now - last.ts < 750 && pct - last.pct < 3) return;
    this.progressAt.set(jobId, { pct, ts: now });
    void this.updateAndEmit(jobId, { stage: `Processing… ${pct}%` })
      .catch(() => undefined);
  }

  async get(id: string): Promise<JobRecord> {
    const record = await this.store.get(id);
    if (!record) throw Errors.jobNotFound();
    return record;
  }

  async getMany(ids: string[]): Promise<JobRecord[]> {
    const records: JobRecord[] = [];
    for (const id of ids) {
      const record = await this.store.get(id);
      if (record) records.push(record);
    }
    return records;
  }

  /** Resolve a completed job's output file for streaming to the browser. */
  async resolveDownload(id: string): Promise<{ record: JobRecord; outputPath: string }> {
    const record = await this.get(id);
    if (record.state !== "completed" || !record.outputFilename) throw Errors.notReady();
    const outputPath = path.join(config.tempDirectory, `job-${id}`, "output", record.outputFilename);
    return { record, outputPath };
  }

  /** Delete job records (and any leftover temp dirs) that have expired past retention. */
  async sweepExpired(): Promise<number> {
    const retentionMs = config.jobRetentionMinutes * 60 * 1000;
    const ids = await this.store.sweepExpired(Date.now() - retentionMs);
    if (ids.length > 0) {
      await Promise.all(ids.map((id) => deleteJobDirectory(id).catch(() => undefined)));
      logger.info(`Pruned ${ids.length} expired job records`);
    }
    return ids.length;
  }

  async close(): Promise<void> {
    await this.queue.close();
    await this.store.close();
  }
}

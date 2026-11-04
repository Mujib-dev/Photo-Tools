import { EventEmitter } from "node:events";
import { stat } from "node:fs/promises";
import path from "node:path";

import { config } from "../config.js";
import { logger } from "../utils/logger.js";
import { Errors } from "../utils/errors.js";
import type { JobStore } from "./store/JobStore.js";
import type { QueueProvider } from "./queue/QueueProvider.js";
import type { JobOperation, JobPayload, JobRecord, JobState } from "./JobTypes.js";
import type { ProcessingService } from "../services/ProcessingService.js";
import type { ProcessingSettings } from "../services/ProcessingService.js";
import { deleteJobDirectory } from "../storage/TempFileManager.js";
import { triggerUserWebhooks } from "../services/webhookStore.js";

export interface CreateJobInput {
  operation: JobOperation;
  inputFilename: string;
  inputSize: number;
  inputFormat: string;
  outputBaseName: string;
  settings: ProcessingSettings;
  dirs: { inputDir: string; outputDir: string; logsDir: string; inputPath: string };
  /** Account being billed for the job, when the caller is signed in. */
  userId?: string | null;
}

/**
 * Credits integration: a job is charged when it is queued and refunded in
 * full when it fails, so failed work never costs the account anything.
 */
export interface JobBilling {
  charge(userId: string, operation: JobOperation): Promise<void>;
  refund(userId: string, operation: JobOperation): Promise<void>;
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
    private readonly billing?: JobBilling,
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
    const userId = input.userId ?? null;

    // Charge before anything is persisted: a job that cannot be paid for
    // never enters the queue (and the staged input directory is cleaned up).
    let charged = false;
    if (userId && this.billing) {
      try {
        await this.billing.charge(userId, input.operation);
        charged = true;
      } catch (err) {
        await deleteJobDirectory(input.id).catch(() => undefined);
        throw err;
      }
    }

    const record: JobRecord = {
      id: input.id,
      operation: input.operation,
      userId,
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
      userId,
      inputPath: input.dirs.inputPath,
      outputDir: input.dirs.outputDir,
      outputBaseName: input.outputBaseName,
      settings: input.settings,
      inputDir: input.dirs.inputDir,
      logsDir: input.dirs.logsDir,
    };
    try {
      await this.queue.enqueue(payload);
    } catch (err) {
      // The user paid for a job that will never run: give the credits back
      // and remove the record and staged files.
      if (charged && this.billing && userId) {
        await this.billing.refund(userId, input.operation);
      }
      await this.store.deleteMany([input.id]).catch(() => undefined);
      await deleteJobDirectory(input.id).catch(() => undefined);
      throw err;
    }
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
      if (payload.userId) {
        triggerUserWebhooks(payload.userId, "job.completed", {
          jobId,
          operation,
          outputFilename: path.basename(result.outputPath),
          outputSize: info.size,
          outputFormat,
        });
      }
    } catch (err) {
      const safe = friendlyError(err);
      logger.error(`Job ${jobId} failed`, { operation, error: err instanceof Error ? err.message : String(err) });
      await this.updateAndEmit(jobId, { state: "failed", stage: "Failed", error: safe });
      if (payload.userId) {
        triggerUserWebhooks(payload.userId, "job.failed", {
          jobId,
          operation,
          error: safe,
        });
      }
      // Failed jobs are free: return the charge to the account.
      if (payload.userId && this.billing) {
        await this.billing.refund(payload.userId, operation).catch(() => undefined);
      }
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
    if (last && now - last.ts < 250 && pct - last.pct < 1) return;
    this.progressAt.set(jobId, { pct, ts: now });
    void this.updateAndEmit(jobId, { stage: `Downloading… ${pct}%` })
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

  /** Backing store/queue kind, exposed for the admin console. */
  get storeKind(): string {
    return this.store.kind;
  }

  get queueKind(): string {
    return this.queue.kind;
  }

  /** Recent jobs (newest first) for the admin console. */
  async listJobs(limit = 200): Promise<JobRecord[]> {
    return this.store.list(limit);
  }

  /** Recent jobs created at or after `sinceMs` (newest first). */
  async listJobsSince(sinceMs: number, limit = 100_000): Promise<JobRecord[]> {
    return this.store.listSince(sinceMs, limit);
  }

  /**
   * Recent jobs belonging to one account (newest first). Used by the usage
   * dashboard so a user only ever sees their own history.
   */
  async listJobsForUser(userId: string, limit = 500, sinceMs?: number): Promise<JobRecord[]> {
    return this.store.listByUser(userId, limit, sinceMs);
  }

  /** Delete job records and their temp directories. */
  async deleteJobs(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await this.store.deleteMany(ids);
    await Promise.all(ids.map((id) => deleteJobDirectory(id).catch(() => undefined)));
  }

  /** Counts per state (plus total) across the whole store. */
  async jobStats(): Promise<Record<JobState | "total", number>> {
    // Aggregate in the store — never materialise every job row just to count.
    const counts = await this.store.countByState();
    const stats: Record<string, number> = {
      total: 0,
      queued: 0,
      processing: 0,
      completed: 0,
      failed: 0,
    };
    for (const [state, count] of Object.entries(counts)) {
      stats[state] = (stats[state] ?? 0) + count;
      stats.total += count;
    }
    return stats as Record<JobState | "total", number>;
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

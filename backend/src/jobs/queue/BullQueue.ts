import { config } from "../../config.js";
import { logger } from "../../utils/logger.js";
import type { JobPayload } from "../JobTypes.js";
import type { QueueProvider } from "./QueueProvider.js";

/**
 * Production queue backed by Redis + BullMQ (used when REDIS_URL is set).
 * Requires Redis to be reachable; otherwise the in-process queue is used.
 */
export class BullQueue implements QueueProvider {
  readonly kind = "bullmq" as const;

  private queue: import("bullmq").Queue<JobPayload> | null = null;
  private worker: import("bullmq").Worker<JobPayload> | null = null;
  private handler: ((payload: JobPayload) => Promise<void>) | null = null;
  private closed = false;

  constructor(private readonly redisUrl: string) {}

  async connect(): Promise<void> {
    const [{ Queue, Worker }, { Redis }] = await Promise.all([
      import("bullmq"),
      import("ioredis"),
    ]);

    const connection = new Redis(this.redisUrl, { maxRetriesPerRequest: null });

    this.queue = new Queue<JobPayload>("photo-tools-jobs", { connection });
    this.worker = new Worker<JobPayload>(
      "photo-tools-jobs",
      async (job) => {
        if (this.handler) await this.handler(job.data);
      },
      { connection, concurrency: config.maxConcurrentJobs },
    );
    this.worker.on("failed", (job, err) => {
      logger.error("BullMQ job failed", { jobId: job?.data?.jobId, error: err.message });
    });
  }

  onProcess(handler: (payload: JobPayload) => Promise<void>): void {
    this.handler = handler;
  }

  async enqueue(payload: JobPayload): Promise<void> {
    if (this.closed || !this.queue) throw new Error("BullQueue not connected or closed");
    await this.queue.add(payload.jobId, payload, {
      jobId: payload.jobId,
      removeOnComplete: { age: config.jobRetentionMinutes * 60 },
      removeOnFail: { age: config.jobRetentionMinutes * 60 },
    });
  }

  async close(): Promise<void> {
    this.closed = true;
    await this.worker?.close();
    await this.queue?.close();
  }
}

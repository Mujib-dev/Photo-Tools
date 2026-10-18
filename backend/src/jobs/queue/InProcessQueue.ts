import { config } from "../../config.js";
import { logger } from "../../utils/logger.js";
import type { JobPayload } from "../JobTypes.js";
import type { QueueProvider } from "./QueueProvider.js";

/**
 * Built-in queue used when no Redis is available. Serializes work through a
 * concurrency-limited worker pool so we never start unlimited EXE processes.
 */
export class InProcessQueue implements QueueProvider {
  readonly kind = "in-process" as const;

  private handler: ((payload: JobPayload) => Promise<void>) | null = null;
  private queue: JobPayload[] = [];
  private active = 0;
  private drained: Promise<void> | null = null;
  private closed = false;

  onProcess(handler: (payload: JobPayload) => Promise<void>): void {
    this.handler = handler;
  }

  async enqueue(payload: JobPayload): Promise<void> {
    if (this.closed) throw new Error("Queue is closed");
    if (!this.handler) throw new Error("Queue has no processor registered");
    this.queue.push(payload);
    this.pump();
  }

  private pump(): void {
    if (this.drained) return; // already pumping
    this.drained = this.loop().finally(() => {
      this.drained = null;
    });
  }

  private async loop(): Promise<void> {
    while (!this.closed && (this.queue.length > 0 || this.active > 0)) {
      while (!this.closed && this.active < config.maxConcurrentJobs && this.queue.length > 0) {
        const payload = this.queue.shift();
        if (!payload) break;
        this.active += 1;
        void this.run(payload).finally(() => {
          this.active -= 1;
        });
      }
      if (this.active === 0 && this.queue.length === 0) break;
      await new Promise((r) => setTimeout(r, 25));
    }
  }

  private async run(payload: JobPayload): Promise<void> {
    if (!this.handler) return;
    try {
      await this.handler(payload);
    } catch (err) {
      // The job manager already marks failures; log anything that escaped.
      logger.error("Unexpected queue handler error", { jobId: payload.jobId, error: String(err) });
    }
  }

  async close(): Promise<void> {
    this.closed = true;
    await this.drained;
  }
}

import type { JobPayload } from "../JobTypes.js";

export interface QueueProvider {
  readonly kind: "in-process" | "bullmq";
  enqueue(payload: JobPayload): Promise<void>;
  /** Registers the processing callback. Must be called before enqueueing. */
  onProcess(handler: (payload: JobPayload) => Promise<void>): void;
  close(): Promise<void>;
}

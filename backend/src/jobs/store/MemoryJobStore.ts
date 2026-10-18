import type { JobRecord } from "../JobTypes.js";
import type { JobStore } from "./JobStore.js";

/** Last-resort in-memory store (used if neither SQLite nor PostgreSQL is available). */
export class MemoryJobStore implements JobStore {
  readonly kind = "memory";
  private jobs = new Map<string, JobRecord>();

  async init(): Promise<void> {
    // nothing to do
  }

  async create(record: JobRecord): Promise<void> {
    this.jobs.set(record.id, { ...record });
  }

  async update(id: string, patch: Partial<JobRecord>): Promise<void> {
    const existing = this.jobs.get(id);
    if (!existing) return;
    this.jobs.set(id, { ...existing, ...patch, updatedAt: Date.now() });
  }

  async get(id: string): Promise<JobRecord | null> {
    return this.jobs.get(id) ?? null;
  }

  async deleteMany(ids: string[]): Promise<void> {
    for (const id of ids) this.jobs.delete(id);
  }

  async sweepExpired(now: number): Promise<string[]> {
    const ids: string[] = [];
    for (const [id, record] of this.jobs) {
      if (
        (record.state === "completed" || record.state === "failed") &&
        record.updatedAt < now
      ) {
        ids.push(id);
      }
    }
    if (ids.length > 0) await this.deleteMany(ids);
    return ids;
  }

  async close(): Promise<void> {
    this.jobs.clear();
  }
}

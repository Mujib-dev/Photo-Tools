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

  async list(limit: number): Promise<JobRecord[]> {
    return [...this.jobs.values()]
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, Math.max(0, Math.trunc(limit)));
  }

  async listSince(sinceMs: number, limit: number): Promise<JobRecord[]> {
    return [...this.jobs.values()]
      .filter((record) => record.createdAt >= sinceMs)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, Math.max(0, Math.trunc(limit)));
  }

  async listByUser(userId: string, limit: number, sinceMs?: number): Promise<JobRecord[]> {
    const capped = Math.max(0, Math.trunc(limit));
    return [...this.jobs.values()]
      .filter(
        (record) =>
          record.userId === userId && (sinceMs == null || record.createdAt >= sinceMs),
      )
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, capped);
  }

  async countByState(): Promise<Record<string, number>> {
    const counts: Record<string, number> = {};
    for (const record of this.jobs.values()) {
      counts[record.state] = (counts[record.state] ?? 0) + 1;
    }
    return counts;
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

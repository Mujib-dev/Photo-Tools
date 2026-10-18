import type { JobRecord } from "../JobTypes.js";

/**
 * Persistent job store. Implementations: SQLite (local, zero-setup),
 * PostgreSQL (production) or memory (last-resort fallback).
 */
export interface JobStore {
  readonly kind: string;
  init(): Promise<void>;
  create(record: JobRecord): Promise<void>;
  update(id: string, patch: Partial<JobRecord>): Promise<void>;
  get(id: string): Promise<JobRecord | null>;
  deleteMany(ids: string[]): Promise<void>;
  /**
   * Delete terminal (completed/failed) records whose last update is older than
   * `now` and return the ids that were removed.
   */
  sweepExpired(now: number): Promise<string[]>;
  close(): Promise<void>;
}

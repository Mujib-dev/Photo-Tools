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
  /** Most recent jobs first, capped at `limit`. */
  list(limit: number): Promise<JobRecord[]>;
  /** Most recent jobs created at or after `sinceMs`, newest first. */
  listSince(sinceMs: number, limit: number): Promise<JobRecord[]>;
  /**
   * Most recent jobs belonging to one account, newest first, capped at
   * `limit`. When `sinceMs` is given, only jobs created at or after it are
   * returned (used to bound a usage window without scanning the whole store).
   */
  listByUser(userId: string, limit: number, sinceMs?: number): Promise<JobRecord[]>;
  deleteMany(ids: string[]): Promise<void>;
  /**
   * Count records per state without materialising every row. Returns a map of
   * state → count; callers sum it for a total.
   */
  countByState(): Promise<Record<string, number>>;
  /**
   * Delete terminal (completed/failed) records whose last update is older than
   * `now` and return the ids that were removed.
   */
  sweepExpired(now: number): Promise<string[]>;
  close(): Promise<void>;
}

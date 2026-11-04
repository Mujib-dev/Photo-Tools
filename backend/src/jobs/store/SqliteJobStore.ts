import type { DatabaseSync } from "node:sqlite";
import type { JobRecord, JobState } from "../JobTypes.js";
import type { JobStore } from "./JobStore.js";

/**
 * Local durable job store built on Node's built-in SQLite module (node:sqlite,
 * available since Node 22.5). No native dependencies, zero setup.
 */
export class SqliteJobStore implements JobStore {
  readonly kind = "sqlite";
  private db: DatabaseSync | null = null;

  constructor(private readonly filePath = ":memory:") {}

  private get conn(): DatabaseSync {
    if (!this.db) throw new Error("SqliteJobStore not initialized");
    return this.db;
  }

  async init(): Promise<void> {
    // node:sqlite is built into Node >=22.5; import lazily so environments
    // without it still boot (they can use the memory store instead).
    let DatabaseSync: typeof import("node:sqlite").DatabaseSync;
    try {
      ({ DatabaseSync } = await import("node:sqlite"));
    } catch {
      throw new Error("node:sqlite is not available on this Node version");
    }
    this.db = new DatabaseSync(this.filePath);
    this.conn.exec(`
      CREATE TABLE IF NOT EXISTS jobs (
        id             TEXT PRIMARY KEY,
        operation      TEXT    NOT NULL,
        user_id        TEXT,
        input_filename TEXT    NOT NULL,
        input_size     INTEGER NOT NULL,
        input_format   TEXT    NOT NULL,
        output_filename TEXT,
        output_size    INTEGER,
        output_format  TEXT,
        state          TEXT    NOT NULL,
        stage          TEXT    NOT NULL,
        error          TEXT,
        created_at     INTEGER NOT NULL,
        updated_at     INTEGER NOT NULL,
        processed_at   INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_jobs_created ON jobs(created_at);
      CREATE INDEX IF NOT EXISTS idx_jobs_user_created ON jobs(user_id, created_at);
    `);

    // Migration for job databases created before accounts were billed.
    const columns = this.conn.prepare("PRAGMA table_info(jobs)").all() as unknown as { name: string }[];
    if (!columns.some((c) => c.name === "user_id")) {
      this.conn.exec("ALTER TABLE jobs ADD COLUMN user_id TEXT");
    }
  }

  async create(record: JobRecord): Promise<void> {
    this.conn
      .prepare(
        `INSERT INTO jobs (id, operation, user_id, input_filename, input_size, input_format,
                           output_filename, output_size, output_format, state, stage,
                           error, created_at, updated_at, processed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        record.id,
        record.operation,
        record.userId,
        record.inputFilename,
        record.inputSize,
        record.inputFormat,
        record.outputFilename,
        record.outputSize,
        record.outputFormat,
        record.state,
        record.stage,
        record.error,
        record.createdAt,
        record.updatedAt,
        record.processedAt,
      );
  }

  async update(id: string, patch: Partial<JobRecord>): Promise<void> {
    const cols: string[] = [];
    const values: (string | number | null)[] = [];
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined) continue;
      cols.push(`${COLUMN_MAP[key] ?? key} = ?`);
      values.push(value as string | number | null);
    }
    if (cols.length === 0) return;
    cols.push("updated_at = ?");
    values.push(Date.now());
    values.push(id);
    this.conn.prepare(`UPDATE jobs SET ${cols.join(", ")} WHERE id = ?`).run(...values);
  }

  async get(id: string): Promise<JobRecord | null> {
    const row = this.conn.prepare("SELECT * FROM jobs WHERE id = ?").get(id) as
      | Record<string, unknown>
      | undefined;
    return row ? mapRow(row) : null;
  }

  async deleteMany(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const stmt = this.conn.prepare("DELETE FROM jobs WHERE id = ?");
    for (const id of ids) stmt.run(id);
  }

  async list(limit: number): Promise<JobRecord[]> {
    const rows = this.conn
      .prepare("SELECT * FROM jobs ORDER BY created_at DESC LIMIT ?")
      .all(Math.max(0, Math.trunc(limit))) as unknown as Record<string, unknown>[];
    return rows.map(mapRow);
  }

  async listSince(sinceMs: number, limit: number): Promise<JobRecord[]> {
    const rows = this.conn
      .prepare("SELECT * FROM jobs WHERE created_at >= ? ORDER BY created_at DESC LIMIT ?")
      .all(sinceMs, Math.max(0, Math.trunc(limit))) as unknown as Record<string, unknown>[];
    return rows.map(mapRow);
  }

  async listByUser(userId: string, limit: number, sinceMs?: number): Promise<JobRecord[]> {
    const capped = Math.max(0, Math.trunc(limit));
    const rows = (
      sinceMs == null
        ? this.conn
            .prepare("SELECT * FROM jobs WHERE user_id = ? ORDER BY created_at DESC LIMIT ?")
            .all(userId, capped)
        : this.conn
            .prepare(
              "SELECT * FROM jobs WHERE user_id = ? AND created_at >= ? ORDER BY created_at DESC LIMIT ?",
            )
            .all(userId, sinceMs, capped)
    ) as unknown as Record<string, unknown>[];
    return rows.map(mapRow);
  }

  async countByState(): Promise<Record<string, number>> {
    const rows = this.conn
      .prepare("SELECT state, COUNT(*) AS n FROM jobs GROUP BY state")
      .all() as unknown as { state: string; n: number }[];
    const counts: Record<string, number> = {};
    for (const row of rows) counts[String(row.state)] = Number(row.n);
    return counts;
  }

  async sweepExpired(now: number): Promise<string[]> {
    const rows = this.conn
      .prepare(
        "SELECT id FROM jobs WHERE state IN ('completed','failed') AND updated_at < ?",
      )
      .all(now) as unknown as { id: string }[];
    const ids = rows.map((r) => String(r.id));
    if (ids.length > 0) await this.deleteMany(ids);
    return ids;
  }

  async close(): Promise<void> {
    this.db?.close();
    this.db = null;
  }
}

const COLUMN_MAP: Record<string, string> = {
  userId: "user_id",
  inputFilename: "input_filename",
  inputSize: "input_size",
  inputFormat: "input_format",
  outputFilename: "output_filename",
  outputSize: "output_size",
  outputFormat: "output_format",
  createdAt: "created_at",
  updatedAt: "updated_at",
  processedAt: "processed_at",
};

function mapRow(row: Record<string, unknown>): JobRecord {
  return {
    id: String(row.id),
    operation: row.operation as JobRecord["operation"],
    userId: row.user_id == null ? null : String(row.user_id),
    inputFilename: String(row.input_filename),
    inputSize: Number(row.input_size),
    inputFormat: String(row.input_format),
    outputFilename: row.output_filename == null ? null : String(row.output_filename),
    outputSize: row.output_size == null ? null : Number(row.output_size),
    outputFormat: row.output_format == null ? null : String(row.output_format),
    state: row.state as JobState,
    stage: String(row.stage),
    error: row.error == null ? null : String(row.error),
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
    processedAt: row.processed_at == null ? null : Number(row.processed_at),
  };
}

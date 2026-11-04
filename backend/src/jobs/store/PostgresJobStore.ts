import type { Pool } from "pg";
import type { JobRecord, JobState } from "../JobTypes.js";
import type { JobStore } from "./JobStore.js";

const UPSERT_COLUMNS =
  "id, operation, user_id, input_filename, input_size, input_format, output_filename, " +
  "output_size, output_format, state, stage, error, created_at, updated_at, processed_at";

/**
 * PostgreSQL job store for production deployments. Enabled when DATABASE_URL
 * is configured.
 */
export class PostgresJobStore implements JobStore {
  readonly kind = "postgres";
  private pool: Pool | null = null;

  constructor(private readonly connectionString: string) {}

  private get db(): Pool {
    if (!this.pool) throw new Error("PostgresJobStore not initialized");
    return this.pool;
  }

  async init(): Promise<void> {
    const { default: pg } = await import("pg");
    this.pool = new pg.Pool({ connectionString: this.connectionString });
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS jobs (
        id             TEXT PRIMARY KEY,
        operation      TEXT    NOT NULL,
        user_id        TEXT,
        input_filename TEXT    NOT NULL,
        input_size     BIGINT  NOT NULL,
        input_format   TEXT    NOT NULL,
        output_filename TEXT,
        output_size    BIGINT,
        output_format  TEXT,
        state          TEXT    NOT NULL,
        stage          TEXT    NOT NULL,
        error          TEXT,
        created_at     BIGINT  NOT NULL,
        updated_at     BIGINT  NOT NULL,
        processed_at   BIGINT
      );
      CREATE INDEX IF NOT EXISTS idx_jobs_created ON jobs(created_at);
      CREATE INDEX IF NOT EXISTS idx_jobs_user_created ON jobs(user_id, created_at);
      ALTER TABLE jobs ADD COLUMN IF NOT EXISTS user_id TEXT;
    `);
  }

  async create(record: JobRecord): Promise<void> {
    await this.db.query(
      `INSERT INTO jobs (${UPSERT_COLUMNS})
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
      [
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
      ],
    );
  }

  async update(id: string, patch: Partial<JobRecord>): Promise<void> {
    const keys = Object.keys(patch).filter((k) => patch[k as keyof JobRecord] !== undefined);
    if (keys.length === 0) return;
    keys.push("updated_at");
    const setClause = keys.map((k, i) => `${COLUMN_MAP[k] ?? k} = $${i + 1}`).join(", ");
    const values = keys.map((k) =>
      k === "updated_at" ? Date.now() : (patch[k as keyof JobRecord] as unknown),
    );
    values.push(id);
    await this.db.query(`UPDATE jobs SET ${setClause} WHERE id = $${keys.length + 1}`, values);
  }

  async get(id: string): Promise<JobRecord | null> {
    const { rows } = await this.db.query("SELECT * FROM jobs WHERE id = ?".replace("?", "$1"), [id]);
    return rows.length > 0 ? mapRow(rows[0]) : null;
  }

  async deleteMany(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(", ");
    await this.db.query(`DELETE FROM jobs WHERE id IN (${placeholders})`, ids);
  }

  async list(limit: number): Promise<JobRecord[]> {
    const { rows } = await this.db.query("SELECT * FROM jobs ORDER BY created_at DESC LIMIT $1", [
      Math.max(0, Math.trunc(limit)),
    ]);
    return (rows as Record<string, unknown>[]).map(mapRow);
  }

  async listSince(sinceMs: number, limit: number): Promise<JobRecord[]> {
    const { rows } = await this.db.query(
      "SELECT * FROM jobs WHERE created_at >= $1 ORDER BY created_at DESC LIMIT $2",
      [sinceMs, Math.max(0, Math.trunc(limit))],
    );
    return (rows as Record<string, unknown>[]).map(mapRow);
  }

  async listByUser(userId: string, limit: number, sinceMs?: number): Promise<JobRecord[]> {
    const capped = Math.max(0, Math.trunc(limit));
    const { rows } =
      sinceMs == null
        ? await this.db.query(
            "SELECT * FROM jobs WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2",
            [userId, capped],
          )
        : await this.db.query(
            "SELECT * FROM jobs WHERE user_id = $1 AND created_at >= $2 ORDER BY created_at DESC LIMIT $3",
            [userId, sinceMs, capped],
          );
    return (rows as Record<string, unknown>[]).map(mapRow);
  }

  async countByState(): Promise<Record<string, number>> {
    const { rows } = await this.db.query("SELECT state, COUNT(*)::int AS n FROM jobs GROUP BY state");
    const counts: Record<string, number> = {};
    for (const row of rows as { state: string; n: number }[]) {
      counts[String(row.state)] = Number(row.n);
    }
    return counts;
  }

  async sweepExpired(now: number): Promise<string[]> {
    const { rows } = await this.db.query(
      "DELETE FROM jobs WHERE state IN ('completed','failed') AND updated_at < $1 RETURNING id",
      [now],
    );
    return (rows as { id: string }[]).map((r) => String(r.id));
  }

  async close(): Promise<void> {
    await this.pool?.end();
    this.pool = null;
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

import type { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import type { AuthStore, UserRecord } from "./AuthStore.js";

/**
 * SQLite-backed auth store (users + sessions) on Node's built-in node:sqlite.
 */
export class SqliteAuthStore implements AuthStore {
  readonly kind = "sqlite";
  private db: DatabaseSync | null = null;

  constructor(private readonly filePath = ":memory:") {}

  private get conn(): DatabaseSync {
    if (!this.db) throw new Error("SqliteAuthStore not initialized");
    return this.db;
  }

  async init(): Promise<void> {
    let DatabaseSync: typeof import("node:sqlite").DatabaseSync;
    try {
      ({ DatabaseSync } = await import("node:sqlite"));
    } catch {
      throw new Error("node:sqlite is not available on this Node version");
    }
    this.db = new DatabaseSync(this.filePath);
    this.conn.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id            TEXT PRIMARY KEY,
        email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
        password_hash TEXT NOT NULL,
        created_at    INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS sessions (
        token_hash TEXT PRIMARY KEY,
        user_id    TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
    `);
  }

  async createUser(email: string, passwordHash: string): Promise<UserRecord> {
    const existing = this.conn
      .prepare("SELECT id FROM users WHERE email = ?")
      .get(email);
    if (existing) throw new Error("EMAIL_EXISTS");
    const user: UserRecord = {
      id: randomUUID(),
      email,
      passwordHash,
      createdAt: Date.now(),
    };
    this.conn
      .prepare("INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)")
      .run(user.id, user.email, user.passwordHash, user.createdAt);
    return user;
  }

  async getUserByEmail(email: string): Promise<UserRecord | null> {
    const row = this.conn
      .prepare("SELECT id, email, password_hash AS passwordHash, created_at AS createdAt FROM users WHERE email = ?")
      .get(email) as Record<string, unknown> | undefined;
    return row ? mapUser(row) : null;
  }

  async getUserById(id: string): Promise<UserRecord | null> {
    const row = this.conn
      .prepare("SELECT id, email, password_hash AS passwordHash, created_at AS createdAt FROM users WHERE id = ?")
      .get(id) as Record<string, unknown> | undefined;
    return row ? mapUser(row) : null;
  }

  async createSession(userId: string, tokenHash: string, expiresAt: number): Promise<void> {
    this.conn
      .prepare("INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)")
      .run(tokenHash, userId, Date.now(), expiresAt);
  }

  async getUserBySession(tokenHash: string, now = Date.now()): Promise<UserRecord | null> {
    const row = this.conn
      .prepare(
        `SELECT u.id, u.email, u.password_hash AS passwordHash, u.created_at AS createdAt
         FROM sessions s JOIN users u ON u.id = s.user_id
         WHERE s.token_hash = ? AND s.expires_at > ?`,
      )
      .get(tokenHash, now) as Record<string, unknown> | undefined;
    return row ? mapUser(row) : null;
  }

  async deleteSession(tokenHash: string): Promise<void> {
    this.conn.prepare("DELETE FROM sessions WHERE token_hash = ?").run(tokenHash);
  }

  async deleteExpiredSessions(now: number): Promise<void> {
    this.conn.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(now);
  }

  async close(): Promise<void> {
    this.db?.close();
    this.db = null;
  }
}

function mapUser(row: Record<string, unknown>): UserRecord {
  return {
    id: String(row.id),
    email: String(row.email),
    passwordHash: String(row.passwordHash),
    createdAt: Number(row.createdAt),
  };
}

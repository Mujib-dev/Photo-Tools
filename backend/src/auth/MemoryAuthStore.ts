import { randomUUID } from "node:crypto";
import type { AuthStore, UserRecord } from "./AuthStore.js";

interface SessionRow {
  tokenHash: string;
  userId: string;
  expiresAt: number;
}

/** In-memory auth store — useful when node:sqlite is unavailable. Not durable. */
export class MemoryAuthStore implements AuthStore {
  readonly kind = "memory";
  private users = new Map<string, UserRecord>();
  private sessions = new Map<string, SessionRow>();
  private refreshTokens = new Map<string, SessionRow>();

  async init(): Promise<void> {}

  async createUser(email: string, passwordHash: string): Promise<UserRecord> {
    const existing = [...this.users.values()].find((u) => u.email === email);
    if (existing) throw new Error("EMAIL_EXISTS");
    const user: UserRecord = { id: randomUUID(), email, passwordHash, createdAt: Date.now() };
    this.users.set(user.id, user);
    return user;
  }

  async getUserByEmail(email: string): Promise<UserRecord | null> {
    return [...this.users.values()].find((u) => u.email === email) ?? null;
  }

  async getUserById(id: string): Promise<UserRecord | null> {
    return this.users.get(id) ?? null;
  }

  async createSession(userId: string, tokenHash: string, expiresAt: number): Promise<void> {
    this.sessions.set(tokenHash, { tokenHash, userId, expiresAt });
  }

  async getUserBySession(tokenHash: string, now = Date.now()): Promise<UserRecord | null> {
    const session = this.sessions.get(tokenHash);
    if (!session || session.expiresAt <= now) return null;
    return this.users.get(session.userId) ?? null;
  }

  async deleteSession(tokenHash: string): Promise<void> {
    this.sessions.delete(tokenHash);
  }

  async deleteExpiredSessions(now: number): Promise<void> {
    for (const [hash, session] of this.sessions) {
      if (session.expiresAt <= now) this.sessions.delete(hash);
    }
  }

  async createRefreshToken(tokenHash: string, userId: string, expiresAt: number): Promise<void> {
    this.refreshTokens.set(tokenHash, { tokenHash, userId, expiresAt });
  }

  async getRefreshTokenUser(tokenHash: string, now = Date.now()): Promise<UserRecord | null> {
    const refresh = this.refreshTokens.get(tokenHash);
    if (!refresh || refresh.expiresAt <= now) return null;
    return this.users.get(refresh.userId) ?? null;
  }

  async deleteRefreshToken(tokenHash: string): Promise<void> {
    this.refreshTokens.delete(tokenHash);
  }

  async deleteExpiredRefreshTokens(now: number): Promise<void> {
    for (const [hash, refresh] of this.refreshTokens) {
      if (refresh.expiresAt <= now) this.refreshTokens.delete(hash);
    }
  }

  async close(): Promise<void> {
    this.users.clear();
    this.sessions.clear();
    this.refreshTokens.clear();
  }
}

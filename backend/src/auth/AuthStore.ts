export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: number;
}

export interface PublicUser {
  id: string;
  email: string;
}

/**
 * Persistent user + session storage. Implementations mirror the job-store
 * pattern (SQLite locally, memory as fallback) with zero native dependencies.
 */
export interface AuthStore {
  readonly kind: string;
  init(): Promise<void>;
  /** Throws Error("EMAIL_EXISTS") when the email is already registered. */
  createUser(email: string, passwordHash: string): Promise<UserRecord>;
  getUserByEmail(email: string): Promise<UserRecord | null>;
  getUserById(id: string): Promise<UserRecord | null>;
  /** Create a session bound to a user that expires at the given time. */
  createSession(userId: string, tokenHash: string, expiresAt: number): Promise<void>;
  /** Look up the user for a live (unexpired) session token hash, or null. */
  getUserBySession(tokenHash: string, now?: number): Promise<UserRecord | null>;
  deleteSession(tokenHash: string): Promise<void>;
  deleteExpiredSessions(now: number): Promise<void>;
  /** Store a refresh token (hashed) bound to a user. */
  createRefreshToken(tokenHash: string, userId: string, expiresAt: number): Promise<void>;
  /** Look up the user for a live (unexpired) refresh token hash, or null. */
  getRefreshTokenUser(tokenHash: string, now?: number): Promise<UserRecord | null>;
  /** Revoke a refresh token (called on rotation and logout). */
  deleteRefreshToken(tokenHash: string): Promise<void>;
  deleteExpiredRefreshTokens(now: number): Promise<void>;
  close(): Promise<void>;
}

export function toPublicUser(user: UserRecord): PublicUser {
  return { id: user.id, email: user.email };
}

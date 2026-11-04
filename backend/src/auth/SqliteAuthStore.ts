import type { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import type {
  AdminPermission,
  ApiKeyRecord,
  AuthStore,
  PresetRecord,
  PromoCodePatch,
  PromoCodeRecord,
  PromoKind,
  PromoRedemptionRecord,
  UserAccountPatch,
  UserRecord,
  UserRole,
} from "./AuthStore.js";
import { allAdminPermissions, normalizePermissions } from "./AuthStore.js";
import { generateReferralCode } from "./referral.js";
import { PLANS } from "../services/credits.js";

function normalizeRole(raw: unknown): UserRole {
  return raw === "superadmin" ? "superadmin" : raw === "admin" ? "admin" : "user";
}

function serializePermissions(raw: unknown): string {
  return JSON.stringify(normalizePermissions(raw));
}

function parsePermissions(raw: unknown): AdminPermission[] {
  if (typeof raw !== "string" || !raw) return [];
  try {
    return normalizePermissions(JSON.parse(raw));
  } catch {
    return [];
  }
}

function normalizeStatus(raw: unknown): UserRecord["status"] {
  return raw === "suspended" || raw === "banned" ? raw : "active";
}

function normalizePlan(raw: unknown): UserRecord["plan"] {
  return raw === "pro" || raw === "business" ? raw : "free";
}

function normalizePromoKind(raw: unknown): PromoKind {
  return raw === "plan" || raw === "discount" ? raw : "credits";
}

/** node:sqlite only binds null/number/bigint/string/Uint8Array — booleans become 0/1. */
function toSqlValue(raw: unknown): string | number | bigint | Uint8Array | null {
  if (typeof raw === "boolean") return raw ? 1 : 0;
  return (raw ?? null) as string | number | bigint | Uint8Array | null;
}

/** Aliased user columns for queries that join other tables with `u.`. */
const USER_COLS_U = `u.id, u.email, u.full_name AS fullName, u.phone, u.password_hash AS passwordHash,
  u.role, u.permissions AS permissions, u.status AS status, u.ban_reason AS banReason, u.avatar, u.terms_accepted_at AS termsAcceptedAt, u.created_at AS createdAt,
  u.credits AS credits, u.plan AS plan, u.plan_credits_at AS planCreditsAt,
  u.plan_expires_at AS planExpiresAt,
  u.referral_code AS referralCode, u.referred_by AS referredBy,
  u.referral_count AS referralCount, u.digest_at AS digestAt,
  u.stripe_customer_id AS stripeCustomerId, u.stripe_subscription_id AS stripeSubscriptionId,
  u.subscription_status AS subscriptionStatus, u.subscription_renews_at AS subscriptionRenewsAt,
  u.subscription_cancel_at_period_end AS subscriptionCancelAtPeriodEnd`;

/** Unaliased user columns for queries selecting straight from `users`. */
const USER_COLS = `id, email, full_name AS fullName, phone, password_hash AS passwordHash,
  role, permissions, status, ban_reason AS banReason, avatar, terms_accepted_at AS termsAcceptedAt, created_at AS createdAt,
  credits, plan, plan_credits_at AS planCreditsAt, plan_expires_at AS planExpiresAt,
  referral_code AS referralCode, referred_by AS referredBy,
  referral_count AS referralCount, digest_at AS digestAt,
  stripe_customer_id AS stripeCustomerId, stripe_subscription_id AS stripeSubscriptionId,
  subscription_status AS subscriptionStatus, subscription_renews_at AS subscriptionRenewsAt,
  subscription_cancel_at_period_end AS subscriptionCancelAtPeriodEnd`;

const ACCOUNT_COLUMNS: Record<keyof UserAccountPatch, string> = {
  status: "status",
  banReason: "ban_reason",
  credits: "credits",
  plan: "plan",
  planCreditsAt: "plan_credits_at",
  planExpiresAt: "plan_expires_at",
  referralCode: "referral_code",
  referredBy: "referred_by",
  referralCount: "referral_count",
  digestAt: "digest_at",
  stripeCustomerId: "stripe_customer_id",
  stripeSubscriptionId: "stripe_subscription_id",
  subscriptionStatus: "subscription_status",
  subscriptionRenewsAt: "subscription_renews_at",
  subscriptionCancelAtPeriodEnd: "subscription_cancel_at_period_end",
};

/**
 * SQLite-backed auth store (users + sessions + refresh tokens) on Node's built-in node:sqlite.
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
        full_name     TEXT,
        phone         TEXT,
        password_hash TEXT NOT NULL,
        role          TEXT NOT NULL DEFAULT 'user',
        permissions   TEXT NOT NULL DEFAULT '[]',
        status        TEXT NOT NULL DEFAULT 'active',
        ban_reason    TEXT,
        avatar        TEXT,
        terms_accepted_at INTEGER,
        credits       INTEGER NOT NULL DEFAULT 0,
        plan          TEXT NOT NULL DEFAULT 'free',
        plan_credits_at INTEGER,
        plan_expires_at INTEGER,
        referral_code TEXT,
        referred_by   TEXT,
        referral_count INTEGER NOT NULL DEFAULT 0,
        digest_at     INTEGER,
        stripe_customer_id TEXT,
        stripe_subscription_id TEXT,
        subscription_status TEXT,
        subscription_renews_at INTEGER,
        subscription_cancel_at_period_end INTEGER NOT NULL DEFAULT 0,
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
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        token_hash TEXT PRIMARY KEY,
        user_id    TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires ON refresh_tokens(expires_at);
      CREATE TABLE IF NOT EXISTS password_resets (
        token_hash TEXT PRIMARY KEY,
        user_id    TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_password_resets_user ON password_resets(user_id);
      CREATE TABLE IF NOT EXISTS api_keys (
        id           TEXT PRIMARY KEY,
        user_id      TEXT NOT NULL,
        name         TEXT NOT NULL,
        prefix       TEXT NOT NULL,
        token_hash   TEXT NOT NULL UNIQUE,
        created_at   INTEGER NOT NULL,
        last_used_at INTEGER,
        expires_at   INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id);
      CREATE TABLE IF NOT EXISTS user_presets (
        id         TEXT PRIMARY KEY,
        user_id    TEXT NOT NULL,
        operation  TEXT NOT NULL,
        name       TEXT NOT NULL,
        settings   TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_user_presets_user ON user_presets(user_id);
      CREATE TABLE IF NOT EXISTS promo_codes (
        id               TEXT PRIMARY KEY,
        code             TEXT NOT NULL UNIQUE,
        description      TEXT NOT NULL DEFAULT '',
        kind             TEXT NOT NULL DEFAULT 'credits',
        credits          INTEGER NOT NULL DEFAULT 0,
        plan             TEXT,
        plan_days        INTEGER NOT NULL DEFAULT 30,
        percent_off      INTEGER NOT NULL DEFAULT 0,
        max_redemptions  INTEGER,
        max_per_user     INTEGER NOT NULL DEFAULT 1,
        redeemed_count   INTEGER NOT NULL DEFAULT 0,
        expires_at       INTEGER,
        active           INTEGER NOT NULL DEFAULT 1,
        stripe_coupon_id TEXT,
        created_at       INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS promo_redemptions (
        id              TEXT PRIMARY KEY,
        promo_id        TEXT NOT NULL,
        code            TEXT NOT NULL,
        user_id         TEXT NOT NULL,
        credits_granted INTEGER NOT NULL DEFAULT 0,
        created_at      INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_promo_redemptions_promo ON promo_redemptions(promo_id);
      CREATE INDEX IF NOT EXISTS idx_promo_redemptions_user ON promo_redemptions(user_id, promo_id);
    `);

    // Migrations for databases created before roles and avatars existed.
    const columns = this.conn.prepare("PRAGMA table_info(users)").all() as unknown as { name: string }[];
    const permissionsColumnAdded = !columns.some((c) => c.name === "permissions");
    if (!columns.some((c) => c.name === "role")) {
      this.conn.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'");
    }
    if (permissionsColumnAdded) {
      this.conn.exec("ALTER TABLE users ADD COLUMN permissions TEXT NOT NULL DEFAULT '[]'");
    }
    if (!columns.some((c) => c.name === "status")) {
      this.conn.exec("ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'active'");
    }
    if (!columns.some((c) => c.name === "ban_reason")) {
      this.conn.exec("ALTER TABLE users ADD COLUMN ban_reason TEXT");
    }
    if (!columns.some((c) => c.name === "avatar")) {
      this.conn.exec("ALTER TABLE users ADD COLUMN avatar TEXT");
    }
    if (!columns.some((c) => c.name === "full_name")) {
      this.conn.exec("ALTER TABLE users ADD COLUMN full_name TEXT");
    }
    if (!columns.some((c) => c.name === "phone")) {
      this.conn.exec("ALTER TABLE users ADD COLUMN phone TEXT");
    }
    if (!columns.some((c) => c.name === "terms_accepted_at")) {
      this.conn.exec("ALTER TABLE users ADD COLUMN terms_accepted_at INTEGER");
    }
    // Billing / referral columns (credits, plans, invites, digests).
    if (!columns.some((c) => c.name === "credits")) {
      this.conn.exec("ALTER TABLE users ADD COLUMN credits INTEGER NOT NULL DEFAULT 0");
    }
    if (!columns.some((c) => c.name === "plan")) {
      this.conn.exec("ALTER TABLE users ADD COLUMN plan TEXT NOT NULL DEFAULT 'free'");
    }
    if (!columns.some((c) => c.name === "plan_credits_at")) {
      this.conn.exec("ALTER TABLE users ADD COLUMN plan_credits_at INTEGER");
    }
    if (!columns.some((c) => c.name === "plan_expires_at")) {
      this.conn.exec("ALTER TABLE users ADD COLUMN plan_expires_at INTEGER");
    }
    if (!columns.some((c) => c.name === "referral_code")) {
      this.conn.exec("ALTER TABLE users ADD COLUMN referral_code TEXT");
    }
    if (!columns.some((c) => c.name === "referred_by")) {
      this.conn.exec("ALTER TABLE users ADD COLUMN referred_by TEXT");
    }
    if (!columns.some((c) => c.name === "referral_count")) {
      this.conn.exec("ALTER TABLE users ADD COLUMN referral_count INTEGER NOT NULL DEFAULT 0");
    }
    if (!columns.some((c) => c.name === "digest_at")) {
      this.conn.exec("ALTER TABLE users ADD COLUMN digest_at INTEGER");
    }
    // Stripe subscription columns (recurring paid plans).
    if (!columns.some((c) => c.name === "stripe_customer_id")) {
      this.conn.exec("ALTER TABLE users ADD COLUMN stripe_customer_id TEXT");
    }
    if (!columns.some((c) => c.name === "stripe_subscription_id")) {
      this.conn.exec("ALTER TABLE users ADD COLUMN stripe_subscription_id TEXT");
    }
    if (!columns.some((c) => c.name === "subscription_status")) {
      this.conn.exec("ALTER TABLE users ADD COLUMN subscription_status TEXT");
    }
    if (!columns.some((c) => c.name === "subscription_renews_at")) {
      this.conn.exec("ALTER TABLE users ADD COLUMN subscription_renews_at INTEGER");
    }
    if (!columns.some((c) => c.name === "subscription_cancel_at_period_end")) {
      this.conn.exec(
        "ALTER TABLE users ADD COLUMN subscription_cancel_at_period_end INTEGER NOT NULL DEFAULT 0",
      );
    }

    // Administrators created before granular permissions existed keep full
    // console access; the super administrator can then trim their access.
    // Only run this when the column was just added so an intentionally empty
    // permission set is not re-expanded on the next start.
    if (permissionsColumnAdded) {
      this.conn
        .prepare(
          "UPDATE users SET permissions = ? WHERE role IN ('admin','superadmin') AND (permissions IS NULL OR permissions = '' OR permissions = '[]')",
        )
        .run(JSON.stringify(allAdminPermissions()));
    }

    // Existing accounts predate invite codes: give each one one now. A null
    // plan_credits_at also marks "never granted", so the next access picks up
    // the first allowance for pre-existing users.
    const missing = this.conn
      .prepare("SELECT id FROM users WHERE referral_code IS NULL")
      .all() as unknown as { id: string }[];
    if (missing.length > 0) {
      const insert = this.conn.prepare("UPDATE users SET referral_code = ? WHERE id = ?");
      for (const { id } of missing) {
        let code = generateReferralCode();
        while (this.conn.prepare("SELECT 1 FROM users WHERE referral_code = ?").get(code)) {
          code = generateReferralCode();
        }
        insert.run(code, id);
      }
    }
    // Created after the migration/backfill so legacy databases get it too.
    this.conn.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code)");
  }

  async createUser(
    email: string,
    passwordHash: string,
    role: UserRole = "user",
    fullName: string | null = null,
    phone: string | null = null,
    termsAcceptedAt: number | null = null,
    permissions: AdminPermission[] = [],
  ): Promise<UserRecord> {
    const existing = this.conn
      .prepare("SELECT id FROM users WHERE email = ?")
      .get(email);
    if (existing) throw new Error("EMAIL_EXISTS");
    const now = Date.now();
    let referralCode = generateReferralCode();
    while (this.conn.prepare("SELECT 1 FROM users WHERE referral_code = ?").get(referralCode)) {
      referralCode = generateReferralCode();
    }
    const resolvedPermissions =
      role === "user"
        ? []
        : normalizePermissions(permissions.length > 0 ? permissions : allAdminPermissions());
    const user: UserRecord = {
      id: randomUUID(),
      email,
      fullName,
      phone,
      passwordHash,
      role,
      permissions: resolvedPermissions,
      status: "active",
      banReason: null,
      avatar: null,
      termsAcceptedAt,
      // Welcome allowance: the free plan's first monthly grant, stamped now.
      credits: PLANS.free.monthlyCredits,
      plan: "free",
      planCreditsAt: now,
      planExpiresAt: null,
      referralCode,
      referredBy: null,
      referralCount: 0,
      digestAt: null,
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      subscriptionStatus: null,
      subscriptionRenewsAt: null,
      subscriptionCancelAtPeriodEnd: false,
      createdAt: now,
    };
    this.conn
      .prepare(
        `INSERT INTO users (id, email, full_name, phone, password_hash, role, permissions, status, ban_reason, avatar, terms_accepted_at,
           credits, plan, plan_credits_at, plan_expires_at, referral_code, referred_by, referral_count, digest_at,
           stripe_customer_id, stripe_subscription_id, subscription_status, subscription_renews_at,
           subscription_cancel_at_period_end, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        user.id,
        user.email,
        user.fullName,
        user.phone,
        user.passwordHash,
        user.role,
        serializePermissions(user.permissions),
        user.status,
        user.banReason,
        user.avatar,
        user.termsAcceptedAt,
        user.credits,
        user.plan,
        user.planCreditsAt,
        user.planExpiresAt,
        user.referralCode,
        user.referredBy,
        user.referralCount,
        user.digestAt,
        user.stripeCustomerId,
        user.stripeSubscriptionId,
        user.subscriptionStatus,
        user.subscriptionRenewsAt,
        user.subscriptionCancelAtPeriodEnd ? 1 : 0,
        user.createdAt,
      );
    return user;
  }

  async getUserByEmail(email: string): Promise<UserRecord | null> {
    const row = this.conn
      .prepare(`SELECT ${USER_COLS} FROM users WHERE email = ?`)
      .get(email) as Record<string, unknown> | undefined;
    return row ? mapUser(row) : null;
  }

  async getUserById(id: string): Promise<UserRecord | null> {
    const row = this.conn
      .prepare(`SELECT ${USER_COLS} FROM users WHERE id = ?`)
      .get(id) as Record<string, unknown> | undefined;
    return row ? mapUser(row) : null;
  }

  async listUsers(): Promise<UserRecord[]> {
    const rows = this.conn
      .prepare(`SELECT ${USER_COLS} FROM users ORDER BY created_at ASC`)
      .all() as unknown as Record<string, unknown>[];
    return rows.map(mapUser);
  }

  async listUsersByPhone(phone: string): Promise<UserRecord[]> {
    const rows = this.conn
      .prepare(`SELECT ${USER_COLS} FROM users WHERE phone = ? ORDER BY created_at ASC`)
      .all(phone) as unknown as Record<string, unknown>[];
    return rows.map(mapUser);
  }

  async setUserRole(id: string, role: UserRole): Promise<void> {
    if (role === "user") {
      this.conn.prepare("UPDATE users SET role = ?, permissions = '[]' WHERE id = ?").run(role, id);
      return;
    }
    const row = this.conn.prepare("SELECT permissions FROM users WHERE id = ?").get(id) as
      | { permissions?: unknown }
      | undefined;
    const permissions =
      parsePermissions(row?.permissions).length > 0
        ? parsePermissions(row?.permissions)
        : allAdminPermissions();
    this.conn
      .prepare("UPDATE users SET role = ?, permissions = ? WHERE id = ?")
      .run(role, serializePermissions(permissions), id);
  }

  async setUserPermissions(id: string, permissions: AdminPermission[]): Promise<void> {
    this.conn
      .prepare("UPDATE users SET permissions = ? WHERE id = ?")
      .run(serializePermissions(permissions), id);
  }

  async setUserEmail(id: string, email: string): Promise<void> {
    const existing = this.conn
      .prepare("SELECT id FROM users WHERE email = ? AND id <> ?")
      .get(email, id);
    if (existing) throw new Error("EMAIL_EXISTS");
    try {
      this.conn.prepare("UPDATE users SET email = ? WHERE id = ?").run(email, id);
    } catch (err) {
      if (err instanceof Error && err.message.includes("UNIQUE constraint failed")) {
        throw new Error("EMAIL_EXISTS");
      }
      throw err;
    }
  }

  async setUserAvatar(id: string, avatar: string | null): Promise<void> {
    this.conn.prepare("UPDATE users SET avatar = ? WHERE id = ?").run(avatar, id);
  }

  async setUserPasswordHash(id: string, passwordHash: string): Promise<void> {
    this.conn.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(passwordHash, id);
  }

  async updateUserAccount(id: string, patch: UserAccountPatch): Promise<void> {
    const sets: string[] = [];
    const values: (string | number | bigint | Uint8Array | null)[] = [];
    for (const [key, column] of Object.entries(ACCOUNT_COLUMNS) as [keyof UserAccountPatch, string][]) {
      const raw = patch[key];
      if (raw === undefined) continue;
      // Credits are clamped so a bad value can never produce a negative balance.
      sets.push(`${column} = ?`);
      values.push(key === "credits" ? Math.max(0, Number(raw)) : toSqlValue(raw));
    }
    if (sets.length === 0) return;
    values.push(id);
    this.conn.prepare(`UPDATE users SET ${sets.join(", ")} WHERE id = ?`).run(...values);
  }

  async deductCredits(id: string, amount: number): Promise<number | null> {
    const result = this.conn
      .prepare("UPDATE users SET credits = credits - ? WHERE id = ? AND credits >= ?")
      .run(amount, id, amount);
    if (Number(result.changes) === 0) return null;
    const row = this.conn.prepare("SELECT credits FROM users WHERE id = ?").get(id) as
      | { credits: number }
      | undefined;
    return row ? Number(row.credits) : null;
  }

  async addCredits(id: string, amount: number): Promise<number> {
    this.conn.prepare("UPDATE users SET credits = credits + ? WHERE id = ?").run(amount, id);
    const row = this.conn.prepare("SELECT credits FROM users WHERE id = ?").get(id) as
      | { credits: number }
      | undefined;
    return row ? Number(row.credits) : 0;
  }

  async deleteUser(id: string): Promise<void> {
    this.conn.prepare("DELETE FROM users WHERE id = ?").run(id);
    this.conn.prepare("DELETE FROM sessions WHERE user_id = ?").run(id);
    this.conn.prepare("DELETE FROM refresh_tokens WHERE user_id = ?").run(id);
    this.conn.prepare("DELETE FROM api_keys WHERE user_id = ?").run(id);
    this.conn.prepare("DELETE FROM user_presets WHERE user_id = ?").run(id);
  }

  async createSession(userId: string, tokenHash: string, expiresAt: number): Promise<void> {
    this.conn
      .prepare("INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)")
      .run(tokenHash, userId, Date.now(), expiresAt);
  }

  async getUserBySession(tokenHash: string, now = Date.now()): Promise<UserRecord | null> {
    const row = this.conn
      .prepare(
        `SELECT ${USER_COLS_U}
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

  async createPasswordReset(tokenHash: string, userId: string, expiresAt: number): Promise<void> {
    this.conn.prepare("DELETE FROM password_resets WHERE user_id = ?").run(userId);
    this.conn
      .prepare("INSERT INTO password_resets (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)")
      .run(tokenHash, userId, Date.now(), expiresAt);
  }

  async getPasswordResetUser(tokenHash: string, now = Date.now()): Promise<UserRecord | null> {
    const row = this.conn
      .prepare(
        `SELECT ${USER_COLS_U}
         FROM password_resets p JOIN users u ON u.id = p.user_id
         WHERE p.token_hash = ? AND p.expires_at > ?`,
      )
      .get(tokenHash, now) as Record<string, unknown> | undefined;
    return row ? mapUser(row) : null;
  }

  async deletePasswordReset(tokenHash: string): Promise<void> {
    this.conn.prepare("DELETE FROM password_resets WHERE token_hash = ?").run(tokenHash);
  }

  async deletePasswordResetsForUser(userId: string): Promise<void> {
    this.conn.prepare("DELETE FROM password_resets WHERE user_id = ?").run(userId);
  }

  async createRefreshToken(tokenHash: string, userId: string, expiresAt: number): Promise<void> {
    this.conn
      .prepare("INSERT INTO refresh_tokens (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)")
      .run(tokenHash, userId, Date.now(), expiresAt);
  }

  async getRefreshTokenUser(tokenHash: string, now = Date.now()): Promise<UserRecord | null> {
    const row = this.conn
      .prepare(
        `SELECT ${USER_COLS_U}
         FROM refresh_tokens r JOIN users u ON u.id = r.user_id
         WHERE r.token_hash = ? AND r.expires_at > ?`,
      )
      .get(tokenHash, now) as Record<string, unknown> | undefined;
    return row ? mapUser(row) : null;
  }

  async deleteRefreshToken(tokenHash: string): Promise<void> {
    this.conn.prepare("DELETE FROM refresh_tokens WHERE token_hash = ?").run(tokenHash);
  }

  async deleteExpiredRefreshTokens(now: number): Promise<void> {
    this.conn.prepare("DELETE FROM refresh_tokens WHERE expires_at <= ?").run(now);
  }

  async deleteRefreshTokensForUser(userId: string): Promise<void> {
    this.conn.prepare("DELETE FROM refresh_tokens WHERE user_id = ?").run(userId);
  }

  async deleteSessionsForUser(userId: string): Promise<void> {
    this.conn.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
  }

  async createApiKey(record: ApiKeyRecord): Promise<void> {
    this.conn
      .prepare(
        "INSERT INTO api_keys (id, user_id, name, prefix, token_hash, created_at, last_used_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
        record.id,
        record.userId,
        record.name,
        record.prefix,
        record.tokenHash,
        record.createdAt,
        record.lastUsedAt,
        record.expiresAt,
      );
  }

  async listApiKeysForUser(userId: string): Promise<ApiKeyRecord[]> {
    const rows = this.conn
      .prepare(
        "SELECT id, user_id AS userId, name, prefix, token_hash AS tokenHash, created_at AS createdAt, last_used_at AS lastUsedAt, expires_at AS expiresAt FROM api_keys WHERE user_id = ? ORDER BY created_at DESC",
      )
      .all(userId) as unknown as Record<string, unknown>[];
    return rows.map(mapApiKey);
  }

  async getApiKeyByHash(tokenHash: string, now = Date.now()): Promise<ApiKeyRecord | null> {
    const row = this.conn
      .prepare(
        "SELECT id, user_id AS userId, name, prefix, token_hash AS tokenHash, created_at AS createdAt, last_used_at AS lastUsedAt, expires_at AS expiresAt FROM api_keys WHERE token_hash = ? AND (expires_at IS NULL OR expires_at > ?)",
      )
      .get(tokenHash, now) as Record<string, unknown> | undefined;
    return row ? mapApiKey(row) : null;
  }

  async deleteApiKey(id: string, userId: string): Promise<boolean> {
    const result = this.conn
      .prepare("DELETE FROM api_keys WHERE id = ? AND user_id = ?")
      .run(id, userId);
    return Number(result.changes) > 0;
  }

  async touchApiKey(id: string, now: number): Promise<void> {
    this.conn.prepare("UPDATE api_keys SET last_used_at = ? WHERE id = ?").run(now, id);
  }

  async deleteApiKeysForUser(userId: string): Promise<void> {
    this.conn.prepare("DELETE FROM api_keys WHERE user_id = ?").run(userId);
  }

  async createPreset(record: PresetRecord): Promise<void> {
    this.conn
      .prepare(
        "INSERT INTO user_presets (id, user_id, operation, name, settings, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
        record.id,
        record.userId,
        record.operation,
        record.name,
        JSON.stringify(record.settings),
        record.createdAt,
        record.updatedAt,
      );
  }

  async listPresets(userId: string, operation?: string): Promise<PresetRecord[]> {
    const rows = (
      operation
        ? this.conn
            .prepare(
              "SELECT id, user_id AS userId, operation, name, settings, created_at AS createdAt, updated_at AS updatedAt FROM user_presets WHERE user_id = ? AND operation = ? ORDER BY updated_at DESC",
            )
            .all(userId, operation)
        : this.conn
            .prepare(
              "SELECT id, user_id AS userId, operation, name, settings, created_at AS createdAt, updated_at AS updatedAt FROM user_presets WHERE user_id = ? ORDER BY updated_at DESC",
            )
            .all(userId)
    ) as unknown as Record<string, unknown>[];
    return rows.map(mapPreset);
  }

  async deletePreset(id: string, userId: string): Promise<boolean> {
    const result = this.conn
      .prepare("DELETE FROM user_presets WHERE id = ? AND user_id = ?")
      .run(id, userId);
    return Number(result.changes) > 0;
  }

  async deletePresetsForUser(userId: string): Promise<void> {
    this.conn.prepare("DELETE FROM user_presets WHERE user_id = ?").run(userId);
  }

  // --- promo codes --------------------------------------------------------

  async createPromoCode(record: PromoCodeRecord): Promise<void> {
    this.conn
      .prepare(
        `INSERT INTO promo_codes (id, code, description, kind, credits, plan, plan_days, percent_off,
           max_redemptions, max_per_user, redeemed_count, expires_at, active, stripe_coupon_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        record.id,
        record.code,
        record.description,
        record.kind,
        record.credits,
        record.plan,
        record.planDays,
        record.percentOff,
        record.maxRedemptions,
        record.maxPerUser,
        record.redeemedCount,
        record.expiresAt,
        record.active ? 1 : 0,
        record.stripeCouponId,
        record.createdAt,
      );
  }

  async listPromoCodes(): Promise<PromoCodeRecord[]> {
    const rows = this.conn
      .prepare(
        `SELECT id, code, description, kind, credits, plan, plan_days AS planDays,
           percent_off AS percentOff, max_redemptions AS maxRedemptions, max_per_user AS maxPerUser,
           redeemed_count AS redeemedCount, expires_at AS expiresAt, active,
           stripe_coupon_id AS stripeCouponId, created_at AS createdAt
         FROM promo_codes ORDER BY created_at ASC`,
      )
      .all() as unknown as Record<string, unknown>[];
    return rows.map(mapPromoCode);
  }

  async getPromoCode(id: string): Promise<PromoCodeRecord | null> {
    const row = this.conn
      .prepare(
        `SELECT id, code, description, kind, credits, plan, plan_days AS planDays,
           percent_off AS percentOff, max_redemptions AS maxRedemptions, max_per_user AS maxPerUser,
           redeemed_count AS redeemedCount, expires_at AS expiresAt, active,
           stripe_coupon_id AS stripeCouponId, created_at AS createdAt
         FROM promo_codes WHERE id = ?`,
      )
      .get(id) as unknown as Record<string, unknown> | undefined;
    return row ? mapPromoCode(row) : null;
  }

  async getPromoCodeByCode(code: string): Promise<PromoCodeRecord | null> {
    const row = this.conn
      .prepare(
        `SELECT id, code, description, kind, credits, plan, plan_days AS planDays,
           percent_off AS percentOff, max_redemptions AS maxRedemptions, max_per_user AS maxPerUser,
           redeemed_count AS redeemedCount, expires_at AS expiresAt, active,
           stripe_coupon_id AS stripeCouponId, created_at AS createdAt
         FROM promo_codes WHERE code = ?`,
      )
      .get(code) as unknown as Record<string, unknown> | undefined;
    return row ? mapPromoCode(row) : null;
  }

  async updatePromoCode(id: string, patch: PromoCodePatch): Promise<boolean> {
    const columns: Record<keyof PromoCodePatch, string> = {
      description: "description",
      kind: "kind",
      credits: "credits",
      plan: "plan",
      planDays: "plan_days",
      percentOff: "percent_off",
      maxRedemptions: "max_redemptions",
      maxPerUser: "max_per_user",
      expiresAt: "expires_at",
      active: "active",
      stripeCouponId: "stripe_coupon_id",
    };
    const sets: string[] = [];
    const values: (string | number | bigint | Uint8Array | null)[] = [];
    for (const key of Object.keys(columns) as (keyof PromoCodePatch)[]) {
      const value = patch[key];
      if (value === undefined) continue;
      sets.push(`${columns[key]} = ?`);
      values.push(toSqlValue(value));
    }
    if (sets.length === 0) return (await this.getPromoCode(id)) != null;
    values.push(id);
    const result = this.conn
      .prepare(`UPDATE promo_codes SET ${sets.join(", ")} WHERE id = ?`)
      .run(...values);
    return Number(result.changes) > 0;
  }

  async deletePromoCode(id: string): Promise<boolean> {
    this.conn.prepare("DELETE FROM promo_redemptions WHERE promo_id = ?").run(id);
    const result = this.conn.prepare("DELETE FROM promo_codes WHERE id = ?").run(id);
    return Number(result.changes) > 0;
  }

  async createPromoRedemption(record: PromoRedemptionRecord): Promise<void> {
    this.conn
      .prepare(
        "INSERT INTO promo_redemptions (id, promo_id, code, user_id, credits_granted, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .run(
        record.id,
        record.promoId,
        record.code,
        record.userId,
        record.creditsGranted,
        record.createdAt,
      );
    this.conn
      .prepare("UPDATE promo_codes SET redeemed_count = redeemed_count + 1 WHERE id = ?")
      .run(record.promoId);
  }

  async listPromoRedemptions(promoId: string): Promise<PromoRedemptionRecord[]> {
    const rows = this.conn
      .prepare(
        `SELECT id, promo_id AS promoId, code, user_id AS userId, credits_granted AS creditsGranted,
           created_at AS createdAt
         FROM promo_redemptions WHERE promo_id = ? ORDER BY created_at DESC`,
      )
      .all(promoId) as unknown as Record<string, unknown>[];
    return rows.map((row) => ({
      id: String(row.id),
      promoId: String(row.promoId),
      code: String(row.code),
      userId: String(row.userId),
      creditsGranted: Number(row.creditsGranted ?? 0),
      createdAt: Number(row.createdAt ?? 0),
    }));
  }

  async countPromoRedemptions(promoId: string, userId: string): Promise<number> {
    const row = this.conn
      .prepare("SELECT COUNT(*) AS n FROM promo_redemptions WHERE promo_id = ? AND user_id = ?")
      .get(promoId, userId) as unknown as { n?: number } | undefined;
    return Number(row?.n ?? 0);
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
    fullName: row.fullName == null ? null : String(row.fullName),
    phone: row.phone == null ? null : String(row.phone),
    passwordHash: String(row.passwordHash),
    role: normalizeRole(row.role),
    permissions: parsePermissions(row.permissions),
    status: normalizeStatus(row.status),
    banReason: row.banReason == null ? null : String(row.banReason),
    avatar: row.avatar == null ? null : String(row.avatar),
    termsAcceptedAt: row.termsAcceptedAt == null ? null : Number(row.termsAcceptedAt),
    credits: row.credits == null ? 0 : Number(row.credits),
    plan: normalizePlan(row.plan),
    planCreditsAt: row.planCreditsAt == null ? null : Number(row.planCreditsAt),
    planExpiresAt: row.planExpiresAt == null ? null : Number(row.planExpiresAt),
    referralCode: row.referralCode == null ? "" : String(row.referralCode),
    referredBy: row.referredBy == null ? null : String(row.referredBy),
    referralCount: row.referralCount == null ? 0 : Number(row.referralCount),
    digestAt: row.digestAt == null ? null : Number(row.digestAt),
    stripeCustomerId: row.stripeCustomerId == null ? null : String(row.stripeCustomerId),
    stripeSubscriptionId:
      row.stripeSubscriptionId == null ? null : String(row.stripeSubscriptionId),
    subscriptionStatus: row.subscriptionStatus == null ? null : String(row.subscriptionStatus),
    subscriptionRenewsAt: row.subscriptionRenewsAt == null ? null : Number(row.subscriptionRenewsAt),
    subscriptionCancelAtPeriodEnd: Number(row.subscriptionCancelAtPeriodEnd ?? 0) !== 0,
    createdAt: Number(row.createdAt),
  };
}

function mapApiKey(row: Record<string, unknown>): ApiKeyRecord {
  return {
    id: String(row.id),
    userId: String(row.userId),
    name: String(row.name),
    prefix: String(row.prefix),
    tokenHash: String(row.tokenHash),
    createdAt: Number(row.createdAt),
    lastUsedAt: row.lastUsedAt == null ? null : Number(row.lastUsedAt),
    expiresAt: row.expiresAt == null ? null : Number(row.expiresAt),
  };
}

function mapPromoCode(row: Record<string, unknown>): PromoCodeRecord {
  return {
    id: String(row.id),
    code: String(row.code),
    description: row.description == null ? "" : String(row.description),
    kind: normalizePromoKind(row.kind),
    credits: Number(row.credits ?? 0),
    plan: row.plan == null ? null : normalizePlan(row.plan),
    planDays: Number(row.planDays ?? 30),
    percentOff: Number(row.percentOff ?? 0),
    maxRedemptions: row.maxRedemptions == null ? null : Number(row.maxRedemptions),
    maxPerUser: Number(row.maxPerUser ?? 1),
    redeemedCount: Number(row.redeemedCount ?? 0),
    expiresAt: row.expiresAt == null ? null : Number(row.expiresAt),
    active: Number(row.active ?? 1) !== 0,
    stripeCouponId: row.stripeCouponId == null ? null : String(row.stripeCouponId),
    createdAt: Number(row.createdAt ?? 0),
  };
}

function mapPreset(row: Record<string, unknown>): PresetRecord {
  let settings: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(String(row.settings));
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      settings = parsed as Record<string, unknown>;
    }
  } catch {
    // A corrupt blob degrades to empty settings rather than failing the list.
  }
  return {
    id: String(row.id),
    userId: String(row.userId),
    operation: String(row.operation),
    name: String(row.name),
    settings,
    createdAt: Number(row.createdAt),
    updatedAt: Number(row.updatedAt),
  };
}

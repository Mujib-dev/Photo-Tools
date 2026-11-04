export type UserRole = "admin" | "user" | "superadmin";

/** Which admin-console sections a regular administrator may access. */
export const ADMIN_PERMISSIONS = [
  "users",
  "revenue",
  "support",
  "jobs",
  "promos",
  "affiliates",
  "contacts",
  "audit",
  "settings",
  "analytics",
] as const;

export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number];

export function isAdminRole(role: UserRole): boolean {
  return role === "admin" || role === "superadmin";
}

export function normalizePermissions(raw: unknown): AdminPermission[] {
  if (!Array.isArray(raw)) return [];
  const valid = new Set<string>(ADMIN_PERMISSIONS);
  const out: AdminPermission[] = [];
  for (const value of raw) {
    if (typeof value === "string" && valid.has(value) && !out.includes(value as AdminPermission)) {
      out.push(value as AdminPermission);
    }
  }
  return out;
}

export function allAdminPermissions(): AdminPermission[] {
  return [...ADMIN_PERMISSIONS];
}


/** Account standing: active accounts have full access; suspended/banned accounts cannot log in or run jobs. */
export type UserStatus = "active" | "suspended" | "banned";

/** Subscription tier. Plans grant a monthly credit allowance (free included). */
export type UserPlan = "free" | "pro" | "business";

/** Mutable billing/account fields, updated through `AuthStore.updateUserAccount`. */
export interface UserAccountPatch {
  status?: UserStatus;
  banReason?: string | null;
  credits?: number;
  plan?: UserPlan;
  planCreditsAt?: number | null;
  /** When a promo-granted plan ends; null for a normal (indefinite) plan. */
  planExpiresAt?: number | null;
  referralCode?: string;
  referredBy?: string | null;
  referralCount?: number;
  digestAt?: number | null;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  subscriptionStatus?: string | null;
  subscriptionRenewsAt?: number | null;
  subscriptionCancelAtPeriodEnd?: boolean;
}

export interface UserRecord {
  id: string;
  email: string;
  fullName: string | null;
  phone: string | null;
  passwordHash: string;
  role: UserRole;
  /** Admin-console sections a regular administrator may access (empty for users). */
  permissions: AdminPermission[];
  status: UserStatus;
  banReason: string | null;
  avatar: string | null;
  /** When the user accepted the Terms of Service at sign-up, or null. */
  termsAcceptedAt: number | null;
  /** Credit balance available for processing jobs. Never negative. */
  credits: number;
  plan: UserPlan;
  /** When the plan's monthly credits were last granted, or null. */
  planCreditsAt: number | null;
  /**
   * When a promo-granted plan ends (ms epoch), or null when the plan is
   * permanent (a paid subscription or a plan set by an administrator).
   */
  planExpiresAt: number | null;
  /** Personal invite code for the referral program. */
  referralCode: string;
  /** The referring user's id, set once at sign-up. */
  referredBy: string | null;
  /** How many accounts this user has successfully referred. */
  referralCount: number;
  /** When the last weekly usage digest email was sent, or null. */
  digestAt: number | null;
  /** Stripe customer for paid plans, or null when never billed. */
  stripeCustomerId: string | null;
  /** The active Stripe subscription id, or null when there is none. */
  stripeSubscriptionId: string | null;
  /** Stripe's subscription status (active, past_due, canceled, …), or null. */
  subscriptionStatus: string | null;
  /** When the current paid period ends (ms epoch), or null. */
  subscriptionRenewsAt: number | null;
  /** True when the customer canceled but keeps the plan until period end. */
  subscriptionCancelAtPeriodEnd: boolean;
  createdAt: number;
}

export interface PublicUser {
  id: string;
  email: string;
  fullName: string | null;
  phone: string | null;
  role: UserRole;
  permissions: AdminPermission[];
  status: UserStatus;
  banReason: string | null;
  avatar: string | null;
}

export interface ApiKeyRecord {
  id: string;
  userId: string;
  name: string;
  /** Non-secret display fragment, e.g. "ptk_a1b2c3d4". */
  prefix: string;
  /** SHA-256 hash of the full token; the token itself is never stored. */
  tokenHash: string;
  createdAt: number;
  lastUsedAt: number | null;
  /** Absolute expiry (ms since epoch), or null for a non-expiring key. */
  expiresAt: number | null;
}

export interface PublicApiKey {
  id: string;
  name: string;
  prefix: string;
  createdAt: number;
  lastUsedAt: number | null;
  expiresAt: number | null;
}

/** A saved bundle of tool settings ("preset"), scoped to one operation. */
export interface PresetRecord {
  id: string;
  userId: string;
  /** Tool operation the preset applies to, e.g. "resize". */
  operation: string;
  name: string;
  /** JSON-serialisable tool settings blob. */
  settings: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

/** What a promo code grants when redeemed. */
export type PromoKind = "credits" | "plan" | "discount";

/**
 * A redeemable promotional code.
 *
 * - `credits` grants a one-off credit allowance.
 * - `plan` upgrades the account to a tier for `planDays` days.
 * - `discount` takes `percentOff` off the next invoice (Stripe checkout).
 */
export interface PromoCodeRecord {
  id: string;
  /** Canonical uppercase code, e.g. "LAUNCH500". */
  code: string;
  description: string;
  kind: PromoKind;
  /** Credits granted (kind = credits). */
  credits: number;
  /** Tier granted (kind = plan). */
  plan: UserPlan | null;
  /** How long the granted tier lasts in days (kind = plan). */
  planDays: number;
  /** Percentage off the next invoice (kind = discount). */
  percentOff: number;
  /** Total redemptions allowed, or null for unlimited. */
  maxRedemptions: number | null;
  /** Redemptions allowed per account. */
  maxPerUser: number;
  /** Times this code has been redeemed so far. */
  redeemedCount: number;
  /** Expiry (ms epoch), or null when it never expires. */
  expiresAt: number | null;
  active: boolean;
  /** Stripe coupon id created for discount codes, so it is reused. */
  stripeCouponId: string | null;
  createdAt: number;
}

/** Mutable fields of a promo code. */
export interface PromoCodePatch {
  description?: string;
  kind?: PromoKind;
  credits?: number;
  plan?: UserPlan | null;
  planDays?: number;
  percentOff?: number;
  maxRedemptions?: number | null;
  maxPerUser?: number;
  expiresAt?: number | null;
  active?: boolean;
  /** Stripe coupon id, set once a discount code is used at checkout. */
  stripeCouponId?: string | null;
}

/** One account redeeming one promo code. */
export interface PromoRedemptionRecord {
  id: string;
  promoId: string;
  code: string;
  userId: string;
  /** Credits actually granted by this redemption. */
  creditsGranted: number;
  createdAt: number;
}

/**
 * Persistent user + session storage. Implementations mirror the job-store
 * pattern (SQLite locally, memory as fallback) with zero native dependencies.
 */
export interface AuthStore {
  readonly kind: string;
  init(): Promise<void>;
  /** Throws Error("EMAIL_EXISTS") when the email is already registered. */
  createUser(
    email: string,
    passwordHash: string,
    role?: UserRole,
    fullName?: string | null,
    phone?: string | null,
    termsAcceptedAt?: number | null,
    permissions?: AdminPermission[],
  ): Promise<UserRecord>;
  getUserByEmail(email: string): Promise<UserRecord | null>;
  getUserById(id: string): Promise<UserRecord | null>;
  /** All users, newest last. Used by the admin console. */
  listUsers(): Promise<UserRecord[]>;
  /** Every account whose phone matches the given normalised number. */
  listUsersByPhone(phone: string): Promise<UserRecord[]>;
  /** Update a user's role. */
  setUserRole(id: string, role: UserRole): Promise<void>;
  /** Replace the admin-console sections a regular administrator may access. */
  setUserPermissions(id: string, permissions: AdminPermission[]): Promise<void>;
  /** Change a user's email. Throws Error("EMAIL_EXISTS") when already taken. */
  setUserEmail(id: string, email: string): Promise<void>;
  /** Replace the user's avatar (a data URL), or clear it with null. */
  setUserAvatar(id: string, avatar: string | null): Promise<void>;
  /** Replace a user's password hash (admin reset). */
  setUserPasswordHash(id: string, passwordHash: string): Promise<void>;
  /** Update billing/account fields (credits, plan, referral, digest state). */
  updateUserAccount(id: string, patch: UserAccountPatch): Promise<void>;
  /** Atomically subtract credits; returns the new balance, or null when short. */
  deductCredits(id: string, amount: number): Promise<number | null>;
  /** Atomically add credits; returns the new balance. */
  addCredits(id: string, amount: number): Promise<number>;
  /** Delete a user and every credential bound to them. */
  deleteUser(id: string): Promise<void>;
  /** Create a session bound to a user that expires at the given time. */
  createSession(userId: string, tokenHash: string, expiresAt: number): Promise<void>;
  /** Look up the user for a live (unexpired) session token hash, or null. */
  getUserBySession(tokenHash: string, now?: number): Promise<UserRecord | null>;
  deleteSession(tokenHash: string): Promise<void>;
  deleteExpiredSessions(now: number): Promise<void>;
  /** Create a single-use password-reset token (hashed) bound to a user. */
  createPasswordReset(tokenHash: string, userId: string, expiresAt: number): Promise<void>;
  /** Look up the user for a live (unexpired) password-reset token hash, or null. */
  getPasswordResetUser(tokenHash: string, now?: number): Promise<UserRecord | null>;
  /** Consume (delete) a password-reset token. */
  deletePasswordReset(tokenHash: string): Promise<void>;
  /** Revoke every outstanding password-reset token for a user. */
  deletePasswordResetsForUser(userId: string): Promise<void>;
  /** Store a refresh token (hashed) bound to a user. */
  createRefreshToken(tokenHash: string, userId: string, expiresAt: number): Promise<void>;
  /** Look up the user for a live (unexpired) refresh token hash, or null. */
  getRefreshTokenUser(tokenHash: string, now?: number): Promise<UserRecord | null>;
  /** Revoke a refresh token (called on rotation and logout). */
  deleteRefreshToken(tokenHash: string): Promise<void>;
  deleteExpiredRefreshTokens(now: number): Promise<void>;
  /** Revoke every refresh token for a user (refresh-theft detection). */
  deleteRefreshTokensForUser(userId: string): Promise<void>;
  /** Revoke every legacy session for a user (refresh-theft detection). */
  deleteSessionsForUser(userId: string): Promise<void>;
  /** Persist a new personal API key (the token is already hashed). */
  createApiKey(record: ApiKeyRecord): Promise<void>;
  /** All API keys owned by a user, newest first. */
  listApiKeysForUser(userId: string): Promise<ApiKeyRecord[]>;
  /** Look up a live (unexpired) API key by its token hash, or null. */
  getApiKeyByHash(tokenHash: string, now?: number): Promise<ApiKeyRecord | null>;
  /** Revoke one of a user's API keys. Returns false when it does not exist. */
  deleteApiKey(id: string, userId: string): Promise<boolean>;
  /** Record that a key was just used. */
  touchApiKey(id: string, now: number): Promise<void>;
  /** Revoke every API key for a user (called when the account is removed). */
  deleteApiKeysForUser(userId: string): Promise<void>;
  /** Persist a tool-settings preset. */
  createPreset(record: PresetRecord): Promise<void>;
  /** A user's presets, optionally filtered by operation, newest first. */
  listPresets(userId: string, operation?: string): Promise<PresetRecord[]>;
  /** Delete one of a user's presets. Returns false when it does not exist. */
  deletePreset(id: string, userId: string): Promise<boolean>;
  /** Remove every preset for a user (called when the account is removed). */
  deletePresetsForUser(userId: string): Promise<void>;
  /** Persist a promo code. */
  createPromoCode(record: PromoCodeRecord): Promise<void>;
  /** Every promo code, newest last. */
  listPromoCodes(): Promise<PromoCodeRecord[]>;
  /** One promo code by id, or null. */
  getPromoCode(id: string): Promise<PromoCodeRecord | null>;
  /** One promo code by its canonical code, or null. */
  getPromoCodeByCode(code: string): Promise<PromoCodeRecord | null>;
  /** Update a promo code. Returns false when it does not exist. */
  updatePromoCode(id: string, patch: PromoCodePatch): Promise<boolean>;
  /** Delete a promo code and its redemptions. Returns false when unknown. */
  deletePromoCode(id: string): Promise<boolean>;
  /** Record a redemption and bump the code's counter. */
  createPromoRedemption(record: PromoRedemptionRecord): Promise<void>;
  /** Redemptions of one code, newest first. */
  listPromoRedemptions(promoId: string): Promise<PromoRedemptionRecord[]>;
  /** How many times one account redeemed one code. */
  countPromoRedemptions(promoId: string, userId: string): Promise<number>;
  close(): Promise<void>;
}

export function toPublicUser(user: UserRecord): PublicUser {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    phone: user.phone,
    role: user.role,
    permissions: user.permissions ?? [],
    status: user.status ?? "active",
    banReason: user.banReason ?? null,
    avatar: user.avatar,
  };
}

export function toPublicApiKey(key: ApiKeyRecord): PublicApiKey {
  return {
    id: key.id,
    name: key.name,
    prefix: key.prefix,
    createdAt: key.createdAt,
    lastUsedAt: key.lastUsedAt,
    expiresAt: key.expiresAt,
  };
}

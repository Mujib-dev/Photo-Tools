import { randomUUID } from "node:crypto";
import type {
  AdminPermission,
  ApiKeyRecord,
  AuthStore,
  PresetRecord,
  PromoCodePatch,
  PromoCodeRecord,
  PromoRedemptionRecord,
  UserAccountPatch,
  UserRecord,
  UserRole,
} from "./AuthStore.js";
import { allAdminPermissions, normalizePermissions } from "./AuthStore.js";
import { generateReferralCode } from "./referral.js";
import { PLANS } from "../services/credits.js";

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
  private passwordResets = new Map<string, SessionRow>();
  private apiKeys = new Map<string, ApiKeyRecord>();
  private presets = new Map<string, PresetRecord>();
  private promoCodes = new Map<string, PromoCodeRecord>();
  private promoRedemptions = new Map<string, PromoRedemptionRecord>();

  async init(): Promise<void> {}

  async createUser(
    email: string,
    passwordHash: string,
    role: UserRole = "user",
    fullName: string | null = null,
    phone: string | null = null,
    termsAcceptedAt: number | null = null,
    permissions: AdminPermission[] = [],
  ): Promise<UserRecord> {
    const existing = [...this.users.values()].find((u) => u.email === email);
    if (existing) throw new Error("EMAIL_EXISTS");
    let referralCode = generateReferralCode();
    while ([...this.users.values()].some((u) => u.referralCode === referralCode)) {
      referralCode = generateReferralCode();
    }
    const now = Date.now();
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
    this.users.set(user.id, user);
    return user;
  }

  async getUserByEmail(email: string): Promise<UserRecord | null> {
    return [...this.users.values()].find((u) => u.email === email) ?? null;
  }

  async getUserById(id: string): Promise<UserRecord | null> {
    return this.users.get(id) ?? null;
  }

  async listUsers(): Promise<UserRecord[]> {
    return [...this.users.values()].sort((a, b) => a.createdAt - b.createdAt);
  }

  async listUsersByPhone(phone: string): Promise<UserRecord[]> {
    return [...this.users.values()]
      .filter((u) => u.phone === phone)
      .sort((a, b) => a.createdAt - b.createdAt);
  }

  async setUserRole(id: string, role: UserRole): Promise<void> {
    const user = this.users.get(id);
    if (user) {
      const permissions =
        role === "user" ? [] : user.permissions.length > 0 ? user.permissions : allAdminPermissions();
      this.users.set(id, { ...user, role, permissions });
    }
  }

  async setUserPermissions(id: string, permissions: AdminPermission[]): Promise<void> {
    const user = this.users.get(id);
    if (user) this.users.set(id, { ...user, permissions: normalizePermissions(permissions) });
  }

  async setUserEmail(id: string, email: string): Promise<void> {
    const existing = [...this.users.values()].find(
      (u) => u.id !== id && u.email.toLowerCase() === email.toLowerCase(),
    );
    if (existing) throw new Error("EMAIL_EXISTS");
    const user = this.users.get(id);
    if (user) this.users.set(id, { ...user, email });
  }

  async setUserAvatar(id: string, avatar: string | null): Promise<void> {
    const user = this.users.get(id);
    if (user) this.users.set(id, { ...user, avatar });
  }

  async setUserPasswordHash(id: string, passwordHash: string): Promise<void> {
    const user = this.users.get(id);
    if (user) this.users.set(id, { ...user, passwordHash });
  }

  async updateUserAccount(id: string, patch: UserAccountPatch): Promise<void> {
    const user = this.users.get(id);
    if (!user) return;
    this.users.set(id, { ...user, ...patch, credits: Math.max(0, patch.credits ?? user.credits) });
  }

  async deductCredits(id: string, amount: number): Promise<number | null> {
    const user = this.users.get(id);
    if (!user || user.credits < amount) return null;
    const credits = user.credits - amount;
    this.users.set(id, { ...user, credits });
    return credits;
  }

  async addCredits(id: string, amount: number): Promise<number> {
    const user = this.users.get(id);
    if (!user) return 0;
    const credits = user.credits + amount;
    this.users.set(id, { ...user, credits });
    return credits;
  }

  async deleteUser(id: string): Promise<void> {
    this.users.delete(id);
    for (const [hash, session] of this.sessions) if (session.userId === id) this.sessions.delete(hash);
    for (const [hash, refresh] of this.refreshTokens) if (refresh.userId === id) this.refreshTokens.delete(hash);
    for (const [keyId, key] of this.apiKeys) if (key.userId === id) this.apiKeys.delete(keyId);
    for (const [presetId, preset] of this.presets) if (preset.userId === id) this.presets.delete(presetId);
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

  async createPasswordReset(tokenHash: string, userId: string, expiresAt: number): Promise<void> {
    for (const [hash, reset] of this.passwordResets) if (reset.userId === userId) this.passwordResets.delete(hash);
    this.passwordResets.set(tokenHash, { tokenHash, userId, expiresAt });
  }

  async getPasswordResetUser(tokenHash: string, now = Date.now()): Promise<UserRecord | null> {
    const reset = this.passwordResets.get(tokenHash);
    if (!reset || reset.expiresAt <= now) return null;
    return this.users.get(reset.userId) ?? null;
  }

  async deletePasswordReset(tokenHash: string): Promise<void> {
    this.passwordResets.delete(tokenHash);
  }

  async deletePasswordResetsForUser(userId: string): Promise<void> {
    for (const [hash, reset] of this.passwordResets) if (reset.userId === userId) this.passwordResets.delete(hash);
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

  async deleteRefreshTokensForUser(userId: string): Promise<void> {
    for (const [hash, refresh] of this.refreshTokens) {
      if (refresh.userId === userId) this.refreshTokens.delete(hash);
    }
  }

  async deleteSessionsForUser(userId: string): Promise<void> {
    for (const [hash, session] of this.sessions) {
      if (session.userId === userId) this.sessions.delete(hash);
    }
  }

  async createApiKey(record: ApiKeyRecord): Promise<void> {
    this.apiKeys.set(record.id, record);
  }

  async listApiKeysForUser(userId: string): Promise<ApiKeyRecord[]> {
    return [...this.apiKeys.values()]
      .filter((key) => key.userId === userId)
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  async getApiKeyByHash(tokenHash: string, now = Date.now()): Promise<ApiKeyRecord | null> {
    const key = [...this.apiKeys.values()].find((k) => k.tokenHash === tokenHash);
    if (!key) return null;
    if (key.expiresAt != null && key.expiresAt <= now) return null;
    return key;
  }

  async deleteApiKey(id: string, userId: string): Promise<boolean> {
    const key = this.apiKeys.get(id);
    if (!key || key.userId !== userId) return false;
    this.apiKeys.delete(id);
    return true;
  }

  async touchApiKey(id: string, now: number): Promise<void> {
    const key = this.apiKeys.get(id);
    if (key) this.apiKeys.set(id, { ...key, lastUsedAt: now });
  }

  async deleteApiKeysForUser(userId: string): Promise<void> {
    for (const [id, key] of this.apiKeys) if (key.userId === userId) this.apiKeys.delete(id);
  }

  async createPreset(record: PresetRecord): Promise<void> {
    this.presets.set(record.id, record);
  }

  async listPresets(userId: string, operation?: string): Promise<PresetRecord[]> {
    return [...this.presets.values()]
      .filter((preset) => preset.userId === userId && (!operation || preset.operation === operation))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async deletePreset(id: string, userId: string): Promise<boolean> {
    const preset = this.presets.get(id);
    if (!preset || preset.userId !== userId) return false;
    this.presets.delete(id);
    return true;
  }

  async deletePresetsForUser(userId: string): Promise<void> {
    for (const [id, preset] of this.presets) if (preset.userId === userId) this.presets.delete(id);
  }

  // --- promo codes --------------------------------------------------------

  async createPromoCode(record: PromoCodeRecord): Promise<void> {
    this.promoCodes.set(record.id, { ...record });
  }

  async listPromoCodes(): Promise<PromoCodeRecord[]> {
    return [...this.promoCodes.values()].sort((a, b) => a.createdAt - b.createdAt);
  }

  async getPromoCode(id: string): Promise<PromoCodeRecord | null> {
    return this.promoCodes.get(id) ?? null;
  }

  async getPromoCodeByCode(code: string): Promise<PromoCodeRecord | null> {
    for (const promo of this.promoCodes.values()) {
      if (promo.code === code) return promo;
    }
    return null;
  }

  async updatePromoCode(id: string, patch: PromoCodePatch): Promise<boolean> {
    const existing = this.promoCodes.get(id);
    if (!existing) return false;
    this.promoCodes.set(id, { ...existing, ...patch });
    return true;
  }

  async deletePromoCode(id: string): Promise<boolean> {
    for (const [redemptionId, redemption] of this.promoRedemptions) {
      if (redemption.promoId === id) this.promoRedemptions.delete(redemptionId);
    }
    return this.promoCodes.delete(id);
  }

  async createPromoRedemption(record: PromoRedemptionRecord): Promise<void> {
    this.promoRedemptions.set(record.id, { ...record });
    const promo = this.promoCodes.get(record.promoId);
    if (promo) {
      this.promoCodes.set(record.promoId, { ...promo, redeemedCount: promo.redeemedCount + 1 });
    }
  }

  async listPromoRedemptions(promoId: string): Promise<PromoRedemptionRecord[]> {
    return [...this.promoRedemptions.values()]
      .filter((redemption) => redemption.promoId === promoId)
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  async countPromoRedemptions(promoId: string, userId: string): Promise<number> {
    let count = 0;
    for (const redemption of this.promoRedemptions.values()) {
      if (redemption.promoId === promoId && redemption.userId === userId) count += 1;
    }
    return count;
  }

  async close(): Promise<void> {
    this.users.clear();
    this.sessions.clear();
    this.refreshTokens.clear();
    this.passwordResets.clear();
    this.apiKeys.clear();
    this.presets.clear();
    this.promoCodes.clear();
    this.promoRedemptions.clear();
  }
}

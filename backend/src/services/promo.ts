import { randomBytes, randomUUID } from "node:crypto";

import type { AuthStore, PromoCodeRecord, UserPlan, UserRecord } from "../auth/AuthStore.js";
import { AppError } from "../utils/errors.js";
import { PLANS } from "./credits.js";

/**
 * Promo codes: one-off discounts handed out for launches, campaigns and
 * support.
 *
 * Three kinds, all redeemed by the signed-in account:
 *
 * - `credits`  — a one-off credit allowance (e.g. LAUNCH500 → 500 credits).
 * - `plan`     — a tier upgrade for a number of days (e.g. PRO30 → 30 days
 *                of Pro, including that tier's monthly allowance).
 * - `discount` — a percentage off the next invoice, applied to the Stripe
 *                checkout session (see `promoDiscount` in billing.routes.ts).
 *
 * Limits are enforced server-side: a total redemption cap, a per-account cap
 * (one by default) and an expiry date. Every redemption is recorded so the
 * admin console can audit who used what.
 */

/** Codes are stored uppercase; the alphabet keeps them easy to read aloud. */
const PROMO_ALPHABET = "ABCDEFGHJKMNPQRSTVWXYZ23456789";
const PROMO_CODE_LENGTH = 8;

/** Hard ceiling on a single credit grant, so a typo can't mint a fortune. */
export const MAX_PROMO_CREDITS = 1_000_000;

/** Longest plan a promo can grant, in days. */
export const MAX_PROMO_PLAN_DAYS = 365;

export function generatePromoCode(): string {
  const bytes = randomBytes(PROMO_CODE_LENGTH);
  let out = "";
  for (let i = 0; i < PROMO_CODE_LENGTH; i += 1) {
    out += PROMO_ALPHABET[bytes[i] % PROMO_ALPHABET.length];
  }
  return out;
}

/** Canonical form used for lookups. */
export function normalizePromoCode(raw: string): string {
  return raw.trim().toUpperCase();
}

/** The code may only contain letters, digits and dashes (case-insensitive). */
export function isValidPromoCodeFormat(raw: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9-]{2,31}$/.test(raw);
}

export type PromoRejection =
  | "unknown"
  | "inactive"
  | "expired"
  | "exhausted"
  | "already-redeemed"
  | "not-at-checkout";

/** Why a code cannot be redeemed, or null when it can. */
export function promoRejection(
  promo: PromoCodeRecord,
  redemptionsByUser: number,
  now: number,
): PromoRejection | null {
  if (!promo.active) return "inactive";
  if (promo.expiresAt != null && promo.expiresAt <= now) return "expired";
  if (promo.maxRedemptions != null && promo.redeemedCount >= promo.maxRedemptions) {
    return "exhausted";
  }
  if (redemptionsByUser >= promo.maxPerUser) return "already-redeemed";
  return null;
}

const REJECTION_MESSAGES: Record<PromoRejection, string> = {
  unknown: "That promo code isn't valid.",
  inactive: "That promo code is no longer active.",
  expired: "That promo code has expired.",
  exhausted: "That promo code has been fully claimed.",
  "already-redeemed": "You've already used that promo code.",
  "not-at-checkout": "That promo code applies at checkout, not in the app.",
};

/** The user-facing message for a rejection. */
export function promoRejectionMessage(reason: PromoRejection): string {
  return REJECTION_MESSAGES[reason];
}

export function promoError(reason: PromoRejection): AppError {
  return new AppError(400, promoRejectionMessage(reason));
}

/** What a redemption granted. */
export interface PromoRedemptionOutcome {
  code: string;
  kind: PromoCodeRecord["kind"];
  /** Credits added to the balance. */
  creditsGranted: number;
  /** New plan, when the code granted one. */
  plan: UserPlan | null;
  /** Days the granted plan lasts. */
  planDays: number;
  /** Percentage off the next invoice (kind = discount). */
  percentOff: number;
  /** The account's credit balance after the redemption. */
  balance: number;
}

/**
 * Redeem a code for an account.
 *
 * Grants happen in one shot: the balance (or plan) is updated first, then the
 * redemption is recorded. A concurrent double-submit of the same code is
 * rejected by the per-account cap, which is checked before anything is
 * granted.
 */
export async function redeemPromo(
  store: AuthStore,
  user: UserRecord,
  rawCode: string,
  now = Date.now(),
): Promise<PromoRedemptionOutcome> {
  const code = normalizePromoCode(rawCode);
  const promo = await store.getPromoCodeByCode(code);
  if (!promo) throw promoError("unknown");

  const used = await store.countPromoRedemptions(promo.id, user.id);
  const rejection = promoRejection(promo, used, now);
  if (rejection) throw promoError(rejection);

  // Discount codes are applied to the checkout session, not to the balance.
  if (promo.kind === "discount") throw promoError("not-at-checkout");

  let creditsGranted = 0;
  let plan: UserPlan | null = null;

  if (promo.kind === "credits") {
    creditsGranted = promo.credits;
    await store.addCredits(user.id, creditsGranted);
  } else if (promo.kind === "plan" && promo.plan) {
    plan = promo.plan;
    // The granted tier brings its own monthly allowance, on top of whatever
    // the account already has.
    creditsGranted = PLANS[plan].monthlyCredits;
    // The tier is temporary: it lapses back to Free when the days run out.
    await store.updateUserAccount(user.id, {
      plan,
      planCreditsAt: now,
      planExpiresAt: now + promo.planDays * 24 * 60 * 60 * 1000,
    });
    // Added, not assigned, so a job charged between the read and the write
    // cannot be clobbered by the grant.
    await store.addCredits(user.id, creditsGranted);
  }

  await store.createPromoRedemption({
    id: randomUUID(),
    promoId: promo.id,
    code: promo.code,
    userId: user.id,
    creditsGranted,
    createdAt: now,
  });

  const fresh = await store.getUserById(user.id);
  return {
    code: promo.code,
    kind: promo.kind,
    creditsGranted,
    plan,
    planDays: promo.planDays,
    percentOff: promo.percentOff,
    balance: fresh?.credits ?? user.credits + creditsGranted,
  };
}

/**
 * Resolve a discount code for a checkout session.
 *
 * Discount codes are not redeemed in-app: they are attached to the Stripe
 * checkout session, so the discount only takes effect if the payment
 * completes. The code's redemption cap is not consumed here.
 */
export async function resolveCheckoutPromo(
  store: AuthStore,
  user: UserRecord,
  rawCode: string,
  now = Date.now(),
): Promise<PromoCodeRecord> {
  const code = normalizePromoCode(rawCode);
  const promo = await store.getPromoCodeByCode(code);
  if (!promo) throw promoError("unknown");
  if (promo.kind !== "discount") throw promoError("not-at-checkout");

  const used = await store.countPromoRedemptions(promo.id, user.id);
  const rejection = promoRejection(promo, used, now);
  if (rejection) throw promoError(rejection);

  return promo;
}

/**
 * Record a checkout discount as redeemed.
 *
 * The discount itself is applied by Stripe, so the redemption is only
 * written once the payment completed — otherwise an abandoned checkout would
 * burn the code. Idempotent: replaying a webhook or a browser return for the
 * same session does not consume the cap twice.
 */
export async function recordCheckoutRedemption(
  store: AuthStore,
  userId: string,
  rawCode: string,
  now = Date.now(),
): Promise<PromoRedemptionOutcome | null> {
  const code = normalizePromoCode(rawCode);
  const promo = await store.getPromoCodeByCode(code);
  if (!promo) return null;

  // Already counted (webhook + browser return both fire) — nothing to do.
  const used = await store.countPromoRedemptions(promo.id, userId);
  if (used > 0) {
    const existing = (await store.listPromoRedemptions(promo.id)).find(
      (r) => r.userId === userId,
    );
    const user = await store.getUserById(userId);
    return {
      code: promo.code,
      kind: promo.kind,
      creditsGranted: existing?.creditsGranted ?? 0,
      plan: null,
      planDays: promo.planDays,
      percentOff: promo.percentOff,
      balance: user?.credits ?? 0,
    };
  }

  await store.createPromoRedemption({
    id: randomUUID(),
    promoId: promo.id,
    code: promo.code,
    userId,
    creditsGranted: 0,
    createdAt: now,
  });

  const user = await store.getUserById(userId);
  return {
    code: promo.code,
    kind: promo.kind,
    creditsGranted: 0,
    plan: null,
    planDays: promo.planDays,
    percentOff: promo.percentOff,
    balance: user?.credits ?? 0,
  };
}

/**
 * Check a code without redeeming it, so the UI can show what a code will do
 * before the account commits to it.
 *
 * A discount code is valid here but has nothing to grant in-app: it is
 * applied to the next checkout, so `redemption` stays null.
 */
export async function previewPromo(
  store: AuthStore,
  user: UserRecord,
  rawCode: string,
  now = Date.now(),
): Promise<{
  promo: PromoCodeRecord;
  redemption: PromoRedemptionOutcome | null;
  rejection: PromoRejection | null;
}> {
  const code = normalizePromoCode(rawCode);
  const promo = await store.getPromoCodeByCode(code);
  if (!promo) throw promoError("unknown");

  const used = await store.countPromoRedemptions(promo.id, user.id);
  const rejection = promoRejection(promo, used, now);
  if (rejection) return { promo, redemption: null, rejection };

  if (promo.kind === "discount") {
    return { promo, redemption: null, rejection: null };
  }

  const creditsGranted =
    promo.kind === "credits"
      ? promo.credits
      : promo.plan
        ? PLANS[promo.plan].monthlyCredits
        : 0;

  return {
    promo,
    rejection: null,
    redemption: {
      code: promo.code,
      kind: promo.kind,
      creditsGranted,
      plan: promo.kind === "plan" ? promo.plan : null,
      planDays: promo.planDays,
      percentOff: promo.percentOff,
      balance: user.credits,
    },
  };
}

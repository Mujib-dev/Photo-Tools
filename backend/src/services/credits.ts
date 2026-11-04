import type { AuthStore, UserPlan, UserRecord } from "../auth/AuthStore.js";
import type { JobOperation } from "../jobs/JobTypes.js";
import { Errors } from "../utils/errors.js";

/**
 * Credits, plans and the referral bonus — the metering layer for processing.
 *
 * Every plan (free included) grants its monthly allowance on a rolling 30-day
 * cycle, lazily: the grant is applied the next time the account is used after
 * the cycle elapses. Jobs charge their operation's cost up-front and are
 * refunded in full when they fail, so a broken job never costs credits.
 */

export interface PlanInfo {
  key: UserPlan;
  label: string;
  description: string;
  monthlyCredits: number;
  /** Shown in the UI; billing is handled outside this app. */
  priceUsd: number;
  /** Monthly-equivalent price when billed annually (the yearly total is this × 12). */
  priceUsdAnnual: number;
}

/** How a recurring plan is billed. */
export type BillingCycle = "monthly" | "annual";

export const PLANS: Record<UserPlan, PlanInfo> = {
  free: {
    key: "free",
    label: "Free",
    description: "Everything you need to try PicTools.",
    monthlyCredits: 100,
    priceUsd: 0,
    priceUsdAnnual: 0,
  },
  pro: {
    key: "pro",
    label: "Pro",
    description: "For regular heavy use: more jobs, bigger files.",
    monthlyCredits: 5_000,
    priceUsd: 9.99,
    priceUsdAnnual: 6.99,
  },
  business: {
    key: "business",
    label: "Business",
    description: "Teams and production pipelines.",
    monthlyCredits: 50_000,
    priceUsd: 29.99,
    priceUsdAnnual: 23.99,
  },
};

export const PLAN_ORDER: UserPlan[] = ["free", "pro", "business"];

/** The price of a plan for a billing cycle (annual prices are per month). */
export function planPrice(plan: PlanInfo, cycle: BillingCycle): number {
  return cycle === "annual" ? plan.priceUsdAnnual : plan.priceUsd;
}

/** The yearly total for an annual plan (rounded to whole cents). */
export function planAnnualTotal(plan: PlanInfo): number {
  return Math.round(plan.priceUsdAnnual * 12 * 100) / 100;
}

/** Bonus granted to both sides of a successful referral. */
export const REFERRAL_BONUS_CREDITS = 50;

/** A plan's credits are re-granted every 30 days (measured from the last grant). */
export const PLAN_CREDIT_CYCLE_MS = 30 * 24 * 60 * 60 * 1000;

/** Operations that cost credits (speech tools charge per request). */
export type BillableOperation = JobOperation | "tts" | "stt";

/** Cost of one job/request, per operation. */
export const OPERATION_COSTS: Record<BillableOperation, number> = {
  resize: 1,
  convert: 1,
  compress: 1,
  watermark: 1,
  fetch: 1,
  pdf: 1,
  scan: 2,
  ocr: 2,
  audio: 2,
  enhance: 2,
  video: 3,
  removebg: 5,
  tts: 2,
  stt: 2,
};

export function operationCost(operation: BillableOperation): number {
  return OPERATION_COSTS[operation] ?? 1;
}

export function isBillableOperation(value: string): value is BillableOperation {
  return Object.prototype.hasOwnProperty.call(OPERATION_COSTS, value);
}

/**
 * Switch an account to a new plan: set the tier, grant that tier's monthly
 * allowance immediately and restart the 30-day cycle from now. Shared by the
 * admin console and paid Stripe checkouts.
 */
export async function applyPlanChange(
  store: AuthStore,
  user: UserRecord,
  plan: UserPlan,
  now = Date.now(),
): Promise<void> {
  await store.updateUserAccount(user.id, {
    plan,
    credits: user.credits + PLANS[plan].monthlyCredits,
    planCreditsAt: now,
    // A paid or administrator-set plan is permanent: drop any promo expiry.
    planExpiresAt: null,
  });
}

/**
 * Grant the plan's monthly allowance when the current cycle has elapsed.
 * Returns the (possibly updated) user record.
 */
export async function ensurePlanCredits(
  store: AuthStore,
  user: UserRecord,
  now = Date.now(),
): Promise<UserRecord> {
  // A promo-granted tier lapses on its own; drop back to Free first so the
  // allowance below is the right one.
  const lapsed = await expirePromoPlan(store, user, now);
  if (lapsed) user = lapsed;

  if (user.planCreditsAt != null && now - user.planCreditsAt < PLAN_CREDIT_CYCLE_MS) {
    return user;
  }
  const grant = PLANS[user.plan].monthlyCredits;
  const credits = user.credits + grant;
  await store.updateUserAccount(user.id, { credits, planCreditsAt: now });
  return { ...user, credits, planCreditsAt: now };
}

/**
 * Revert a lapsed promo plan back to Free.
 *
 * A plan granted by a promo code carries an expiry; when it passes, the tier
 * is dropped so the account falls back to the free allowance. Paid plans
 * (Stripe subscriptions) and administrator-assigned plans have no expiry and
 * are never touched.
 *
 * Returns the updated record, or null when nothing changed.
 */
export async function expirePromoPlan(
  store: AuthStore,
  user: UserRecord,
  now = Date.now(),
): Promise<UserRecord | null> {
  if (user.planExpiresAt == null || user.planExpiresAt > now) return null;
  if (user.plan === "free") {
    await store.updateUserAccount(user.id, { planExpiresAt: null });
    return { ...user, planExpiresAt: null };
  }
  await store.updateUserAccount(user.id, {
    plan: "free",
    planExpiresAt: null,
    // Restart the cycle so the free allowance is granted straight away.
    planCreditsAt: now,
  });
  const credits = user.credits + PLANS.free.monthlyCredits;
  await store.updateUserAccount(user.id, { credits });
  return { ...user, plan: "free", planExpiresAt: null, credits, planCreditsAt: now };
}

/**
 * Charge an operation up-front. Applies a due plan grant first, then deducts
 * atomically — throws 402 when the balance is too low.
 */
export async function chargeCredits(
  store: AuthStore,
  userId: string,
  operation: BillableOperation,
  now = Date.now(),
): Promise<{ cost: number; balance: number }> {
  const user = await store.getUserById(userId);
  if (!user) throw Errors.unauthorized();
  const fresh = await ensurePlanCredits(store, user, now);
  const cost = operationCost(operation);
  const balance = await store.deductCredits(userId, cost);
  if (balance == null) throw Errors.insufficientCredits(cost, fresh.credits);
  return { cost, balance };
}

/** Give credits back (job failed after the charge). Never throws. */
export async function refundCredits(
  store: AuthStore,
  userId: string,
  operation: BillableOperation,
): Promise<void> {
  await store.addCredits(userId, operationCost(operation)).catch(() => undefined);
}

/**
 * Apply an invite code to a fresh account: both sides get the referral bonus.
 * Unknown codes are ignored (registration still succeeds) so a typo never
 * blocks sign-up, and there is no oracle for probing codes.
 *
 * Returns the bonus applied, or null when the code matched nothing.
 */
export async function applyReferral(
  store: AuthStore,
  user: UserRecord,
  rawCode: string | null | undefined,
): Promise<number | null> {
  if (!rawCode) return null;
  const code = rawCode.trim().toUpperCase();
  if (!code) return null;
  const referrer = (await store.listUsers()).find(
    (candidate) => candidate.id !== user.id && candidate.referralCode === code,
  );
  if (!referrer) return null;

  await store.updateUserAccount(user.id, {
    referredBy: referrer.id,
    credits: user.credits + REFERRAL_BONUS_CREDITS,
  });
  await store.updateUserAccount(referrer.id, {
    referralCount: referrer.referralCount + 1,
    credits: referrer.credits + REFERRAL_BONUS_CREDITS,
  });
  return REFERRAL_BONUS_CREDITS;
}

import Stripe from "stripe";

import { config } from "../config.js";
import type { AuthStore, UserAccountPatch, UserPlan, UserRecord } from "../auth/AuthStore.js";
import { PLANS } from "./credits.js";
import { logger } from "../utils/logger.js";

/**
 * Subscription lifecycle for paid plans.
 *
 * The plan field on the user record stays the single source of truth for
 * metering; this module keeps it in sync with Stripe:
 *
 * - Activation: browser verify and the `checkout.session.completed` webhook,
 *   both idempotent (plan only changes when it differs).
 * - Renewals/cancellations: webhook first, lazy sync (`syncSubscription`)
 *   when a user is active without a webhook, plus a periodic sweep for
 *   subscribers who never show up. Sync fails open — a Stripe outage must
 *   never block the app.
 * - Downgrade: a non-live subscription reverts to Free (granting the free
 *   allowance). Canceling keeps the plan until Stripe ends the period.
 *
 * Credit cadence is deliberately independent: the 30-day lazy grant in
 * credits.ts is untouched by any of this, so a missed or duplicated
 * webhook can never double-grant credits.
 */

/** Statuses that keep the paid plan (past_due stays live during dunning). */
const LIVE_STATUSES = new Set(["active", "trialing", "past_due"]);

/** Avoid hammering Stripe on every request: one reconcile per user per TTL. */
const SYNC_TTL_MS = 5 * 60_000;
const syncedAt = new Map<string, number>();

/** Normalised slice of a Stripe subscription persisted onto the user record. */
export interface SubscriptionState {
  /** Stripe customer id, when known (set at checkout/verify). */
  customerId?: string | null;
  subscriptionId: string | null;
  status: string | null;
  /** First item's price id — maps an unseen subscription to a plan. */
  priceId?: string | null;
  /** Current paid period end as ms epoch, or null. */
  renewsAt: number | null;
  cancelAtPeriodEnd: boolean;
}

/** The shape we accept from either the SDK or a parsed webhook payload. */
interface SubscriptionLike {
  id?: string;
  status?: string;
  customer?: string | { id?: string } | null;
  cancel_at_period_end?: boolean;
  /** Pre-basil API versions. */
  current_period_end?: number | null;
  items?: {
    data?: { price?: { id?: string | null } | null; current_period_end?: number | null }[];
  };
  metadata?: Record<string, string | undefined>;
}

/** Epoch seconds vs ms — Stripe sends seconds; be forgiving either way. */
function toMsEpoch(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return value < 1_000_000_000_000 ? Math.round(value * 1000) : Math.round(value);
}

export function toSubscriptionState(sub: SubscriptionLike): SubscriptionState {
  const item = sub.items?.data?.[0];
  const customerId =
    typeof sub.customer === "string" ? sub.customer : (sub.customer?.id ?? null);
  return {
    customerId,
    subscriptionId: sub.id ?? null,
    status: sub.status ?? null,
    priceId: item?.price?.id ?? null,
    renewsAt: toMsEpoch(sub.current_period_end ?? item?.current_period_end),
    cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
  };
}

/** Which paid tier a configured Stripe price belongs to, if any. */
function planForPrice(priceId: string | null | undefined): UserPlan | null {
  if (!priceId) return null;
  if (priceId === config.stripePricePro) return "pro";
  if (priceId === config.stripePriceBusiness) return "business";
  return null;
}

export function isLiveStatus(status: string | null | undefined): boolean {
  return status != null && LIVE_STATUSES.has(status);
}

export function stripeClient(): Stripe {
  if (!config.stripeSecretKey) throw new Error("STRIPE_SECRET_KEY is not configured");
  return new Stripe(config.stripeSecretKey);
}

/**
 * Reconcile one account with a subscription state. One idempotent write:
 * plan tier (downgrade when not live, activate when told), plus the stored
 * subscription fields. Returns the fresh user record.
 *
 * `activatePlan` is the tier from checkout metadata — trusted because only
 * the server puts it there.
 */
export async function applySubscriptionState(
  store: AuthStore,
  user: UserRecord,
  state: SubscriptionState,
  opts: { activatePlan?: UserPlan | null; now?: number } = {},
): Promise<UserRecord> {
  const now = opts.now ?? Date.now();
  const live = isLiveStatus(state.status);

  let targetPlan: UserPlan = user.plan;
  if (!live) {
    targetPlan = "free";
  } else if (opts.activatePlan) {
    targetPlan = opts.activatePlan;
  } else if (user.plan === "free") {
    // Activation the browser hasn't reported yet — trust the price mapping.
    targetPlan = planForPrice(state.priceId) ?? "free";
  }

  const patch: UserAccountPatch = {
    stripeCustomerId: state.customerId ?? user.stripeCustomerId,
    stripeSubscriptionId: state.subscriptionId,
    subscriptionStatus: state.status,
    subscriptionRenewsAt: state.renewsAt,
    subscriptionCancelAtPeriodEnd: state.cancelAtPeriodEnd,
  };

  if (targetPlan !== user.plan) {
    const credits = user.credits + PLANS[targetPlan].monthlyCredits;
    await store.updateUserAccount(user.id, {
      ...patch,
      plan: targetPlan,
      credits,
      planCreditsAt: now,
      // A paid plan is permanent: drop any promo expiry.
      planExpiresAt: null,
    });
    logger.info("Subscription changed plan", {
      userId: user.id,
      from: user.plan,
      to: targetPlan,
      status: state.status,
    });
    return { ...user, ...patch, plan: targetPlan, credits, planCreditsAt: now };
  }

  if (live && user.planExpiresAt != null) {
    // The subscription now backs the tier, so a promo expiry no longer applies.
    await store.updateUserAccount(user.id, { ...patch, planExpiresAt: null });
    return { ...user, ...patch, planExpiresAt: null };
  }

  await store.updateUserAccount(user.id, patch);
  return { ...user, ...patch };
}

/**
 * Lazy sync: fetch the account's subscription from Stripe and reconcile.
 * Throttled per user; fails open (an error just leaves state as-is until
 * the next attempt or the webhook).
 */
export async function syncSubscription(
  store: AuthStore,
  user: UserRecord,
  opts: { force?: boolean } = {},
): Promise<UserRecord> {
  if (!config.stripeSecretKey || !user.stripeSubscriptionId) return user;
  const now = Date.now();
  if (!opts.force) {
    const last = syncedAt.get(user.id);
    if (last != null && now - last < SYNC_TTL_MS) return user;
  }
  // Stamp before the call: a failing Stripe never turns into a request storm.
  syncedAt.set(user.id, now);

  try {
    const sub = await stripeClient().subscriptions.retrieve(user.stripeSubscriptionId);
    return await applySubscriptionState(store, user, toSubscriptionState(sub), { now });
  } catch (err) {
    const missing =
      typeof err === "object" && err !== null && (err as { code?: string }).code === "resource_missing";
    if (missing) {
      // The subscription is gone from Stripe — treat it as ended.
      return applySubscriptionState(
        store,
        user,
        {
          subscriptionId: user.stripeSubscriptionId,
          status: "canceled",
          priceId: null,
          renewsAt: null,
          cancelAtPeriodEnd: false,
        },
        { now },
      );
    }
    logger.warn("Subscription sync failed (keeping current state)", {
      userId: user.id,
      error: err instanceof Error ? err.message : String(err),
    });
    return user;
  }
}

/**
 * Periodic sweep: downgrade anyone whose stored status already says the
 * subscription ended, and force-sync the rest of the subscribers so lapsed
 * accounts are caught even when the owner never signs in.
 */
export async function sweepSubscriptions(
  store: AuthStore,
): Promise<{ checked: number; downgraded: number }> {
  const users = await store.listUsers();
  let checked = 0;
  let downgraded = 0;
  const now = Date.now();

  for (const user of users) {
    if (user.plan !== "free" && user.subscriptionStatus != null && !isLiveStatus(user.subscriptionStatus)) {
      // Stored state already proves the paid period is over.
      const updated = await applySubscriptionState(
        store,
        user,
        {
          subscriptionId: user.stripeSubscriptionId,
          status: user.subscriptionStatus,
          priceId: null,
          renewsAt: user.subscriptionRenewsAt,
          cancelAtPeriodEnd: user.subscriptionCancelAtPeriodEnd,
        },
        { now },
      );
      if (updated.plan === "free") downgraded += 1;
      continue;
    }
    if (user.stripeSubscriptionId && config.stripeSecretKey) {
      checked += 1;
      const before = user.plan;
      const updated = await syncSubscription(store, user, { force: true });
      if (updated.plan !== before) downgraded += 1;
    }
  }
  return { checked, downgraded };
}

/** Test hook: forget the lazy-sync throttle. */
export function resetSubscriptionSyncCache(): void {
  syncedAt.clear();
}

import { Router, type Request, type Response } from "express";

import { config } from "../config.js";
import type { AuthStore } from "../auth/AuthStore.js";
import type { JobManager } from "../jobs/JobManager.js";
import {
  OPERATION_COSTS,
  PLANS,
  PLAN_CREDIT_CYCLE_MS,
  PLAN_ORDER,
  REFERRAL_BONUS_CREDITS,
  ensurePlanCredits,
  isBillableOperation,
  operationCost,
} from "../services/credits.js";
import { syncSubscription } from "../services/subscription.js";
import { Errors } from "../utils/errors.js";

/**
 * The signed-in account's metering state: balance, plan, invite link and a
 * seven-day usage summary (also used by the onboarding checklist and the
 * weekly digest).
 */

const USAGE_WINDOW_DAYS = 7;
const USAGE_WINDOW_MS = USAGE_WINDOW_DAYS * 24 * 60 * 60 * 1000;
/** Newest jobs considered for the usage summary. */
const USAGE_SCAN_LIMIT = 5_000;

function appOrigin(): string {
  return config.publicAppUrl.replace(/\/$/, "");
}

export function creditsRoutes(authStore: AuthStore, jobs: JobManager): Router {
  const router = Router();

  router.get("/", async (req: Request, res: Response, next) => {
    try {
      const userId = req.authUser?.id;
      if (!userId) throw Errors.unauthorized();
      const raw = await authStore.getUserById(userId);
      if (!raw) throw Errors.unauthorized();

      // Lazy subscription sync first (throttled, fails open), then pick up a
      // due plan grant so the balance and tier are always current together.
      const synced = await syncSubscription(authStore, raw);
      const user = await ensurePlanCredits(authStore, synced);
      const plan = PLANS[user.plan];

      const since = Date.now() - USAGE_WINDOW_MS;
      const recent = (await jobs.listJobs(USAGE_SCAN_LIMIT)).filter(
        (job) => job.userId === user.id && job.createdAt >= since,
      );
      const byOperation = new Map<string, { jobs: number; credits: number }>();
      let completed = 0;
      let failed = 0;
      let creditsUsed = 0;
      for (const job of recent) {
        if (job.state === "completed") completed += 1;
        if (job.state === "failed") failed += 1;
        const cost = isBillableOperation(job.operation) ? operationCost(job.operation) : 1;
        creditsUsed += cost;
        const bucket = byOperation.get(job.operation) ?? { jobs: 0, credits: 0 };
        bucket.jobs += 1;
        bucket.credits += cost;
        byOperation.set(job.operation, bucket);
      }

      res.setHeader("Cache-Control", "no-store");
      res.json({
        balance: user.credits,
        plan: {
          key: plan.key,
          label: plan.label,
          description: plan.description,
          monthlyCredits: plan.monthlyCredits,
          priceUsd: plan.priceUsd,
          priceUsdAnnual: plan.priceUsdAnnual,
        },
        plans: PLAN_ORDER.map((key) => PLANS[key]),
        planCreditsAt: user.planCreditsAt,
        nextGrantAt:
          user.planCreditsAt == null ? null : user.planCreditsAt + PLAN_CREDIT_CYCLE_MS,
        // When a promo-granted tier lapses (null for a permanent plan).
        planExpiresAt: user.planExpiresAt,
        // Recurring subscription state (null on free/manual plans).
        subscription: user.stripeSubscriptionId
          ? {
              status: user.subscriptionStatus,
              renewsAt: user.subscriptionRenewsAt,
              cancelAtPeriodEnd: user.subscriptionCancelAtPeriodEnd,
            }
          : null,
        // Per-run credit prices, so tool pages can show "this costs N credits".
        operationCosts: OPERATION_COSTS,
        referral: {
          code: user.referralCode,
          count: user.referralCount,
          bonus: REFERRAL_BONUS_CREDITS,
          referred: user.referredBy != null,
          link: `${appOrigin()}/signup?ref=${user.referralCode}`,
        },
        usage: {
          windowDays: USAGE_WINDOW_DAYS,
          jobs: recent.length,
          completed,
          failed,
          creditsUsed,
          byOperation: [...byOperation.entries()]
            .map(([operation, stats]) => ({ operation, ...stats }))
            .sort((a, b) => b.jobs - a.jobs),
        },
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

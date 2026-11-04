import { Router, type Request, type Response } from "express";

import type { AuthStore } from "../auth/AuthStore.js";
import type { JobManager } from "../jobs/JobManager.js";
import type { JobRecord } from "../jobs/JobTypes.js";
import { PLANS, PLAN_CREDIT_CYCLE_MS, ensurePlanCredits } from "../services/credits.js";
import { syncSubscription } from "../services/subscription.js";
import {
  USAGE_CATEGORY_LABELS,
  computeUserUsage,
  creditCost,
  operationCategory,
  type UsageCategory,
} from "../services/usage.js";
import { Errors } from "../utils/errors.js";

/**
 * The signed-in account's usage history: what it consumed, which tools spent
 * the credits and how the last period compares with the one before it.
 *
 * Read-only and scoped to the caller — a user can only ever see their own
 * jobs, credits and history.
 */

/** Windows the dashboard offers. */
const ALLOWED_WINDOWS = [7, 14, 30, 90, 365];
const DEFAULT_WINDOW_DAYS = 30;

/** Upper bound on the jobs scanned for one account in a request. */
const SCAN_LIMIT = 10_000;

/** Jobs listed in the "recent activity" table. */
const HISTORY_LIMIT = 25;

const DAY_MS = 24 * 60 * 60 * 1000;

function parseWindow(raw: unknown): number {
  const n = Number.parseInt(String(raw ?? ""), 10);
  if (!Number.isFinite(n)) return DEFAULT_WINDOW_DAYS;
  return ALLOWED_WINDOWS.includes(n) ? n : DEFAULT_WINDOW_DAYS;
}

/** The UTC calendar month a timestamp falls in, as `[startMs, endMs)`. */
function monthRange(ms: number): { start: number; end: number; label: string } {
  const date = new Date(ms);
  const start = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1);
  const end = Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1);
  const label = date.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  return { start, end, label };
}

interface HistoryEntry {
  id: string;
  operation: string;
  category: UsageCategory;
  state: string;
  inputFilename: string;
  inputSize: number;
  inputFormat: string;
  outputSize: number | null;
  outputFormat: string | null;
  createdAt: number;
  /** Credit price of this job's operation. */
  creditCost: number;
  /** Credits actually kept (0 for failed jobs, which are refunded). */
  creditsCharged: number;
  /** True when the job failed and its credits were returned. */
  refunded: boolean;
}

function historyEntry(record: JobRecord): HistoryEntry {
  const cost = creditCost(record.operation);
  const refunded = record.state === "failed";
  return {
    id: record.id,
    operation: record.operation,
    category: operationCategory(record.operation),
    state: record.state,
    inputFilename: record.inputFilename,
    inputSize: record.inputSize,
    inputFormat: record.inputFormat,
    outputSize: record.outputSize,
    outputFormat: record.outputFormat,
    createdAt: record.createdAt,
    creditCost: cost,
    creditsCharged: refunded ? 0 : cost,
    refunded,
  };
}

export function usageRoutes(authStore: AuthStore, jobs: JobManager): Router {
  const router = Router();

  router.get("/", async (req: Request, res: Response, next) => {
    try {
      const userId = req.authUser?.id;
      if (!userId) throw Errors.unauthorized();
      const raw = await authStore.getUserById(userId);
      if (!raw) throw Errors.unauthorized();

      // Keep the balance current (lazy subscription sync + due plan grant) so
      // the "remaining" figure matches what the credits endpoint reports.
      const synced = await syncSubscription(authStore, raw);
      const user = await ensurePlanCredits(authStore, synced);
      const plan = PLANS[user.plan];

      const days = parseWindow(req.query.days);
      const now = Date.now();
      const sinceMs = now - days * DAY_MS;

      const month = monthRange(now);
      const previousMonth = monthRange(month.start - 1);

      // One scan covers the window plus both calendar months compared in the
      // summary, so the whole response comes from a single store read.
      const records = await jobs.listJobsForUser(
        userId,
        SCAN_LIMIT,
        Math.min(sinceMs, month.start, previousMonth.start),
      );

      const usage = computeUserUsage(records, { sinceMs, now, windowDays: days });
      const monthUsage = computeUserUsage(records, {
        sinceMs: month.start,
        now: month.end - 1,
        windowDays: days,
      });
      const previousUsage = computeUserUsage(records, {
        sinceMs: previousMonth.start,
        now: month.start - 1,
        windowDays: days,
      });

      const recentJobs = records
        .filter((record) => record.createdAt >= sinceMs)
        .slice(0, HISTORY_LIMIT)
        .map(historyEntry);

      res.setHeader("Cache-Control", "no-store");
      res.json({
        windowDays: days,
        since: sinceMs,
        generatedAt: now,
        plan: {
          key: plan.key,
          label: plan.label,
          monthlyCredits: plan.monthlyCredits,
        },
        credits: {
          balance: user.credits,
          monthlyAllowance: plan.monthlyCredits,
          /** Credits still available from the current balance. */
          remaining: user.credits,
          /** When the next plan allowance is granted, or null if unknown. */
          nextGrantAt: user.planCreditsAt == null ? null : user.planCreditsAt + PLAN_CREDIT_CYCLE_MS,
        },
        totals: usage.totals,
        byOperation: usage.byOperation,
        byCategory: usage.byCategory.map((entry) => ({
          ...entry,
          label: USAGE_CATEGORY_LABELS[entry.category],
        })),
        byDay: usage.byDay,
        month: {
          label: month.label,
          since: month.start,
          jobs: monthUsage.totals.jobs,
          creditsUsed: monthUsage.totals.creditsUsed,
          creditsCharged: monthUsage.totals.creditsCharged,
          previous: {
            label: previousMonth.label,
            jobs: previousUsage.totals.jobs,
            creditsUsed: previousUsage.totals.creditsUsed,
          },
        },
        recentJobs,
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

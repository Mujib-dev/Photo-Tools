import type { JobRecord } from "../jobs/JobTypes.js";
import { isBillableOperation, operationCost } from "./credits.js";

/**
 * Per-account usage analytics for the customer-facing usage dashboard.
 *
 * Pure and side-effect free (like the admin analytics service) so it can be
 * unit-tested without a store, queue or network. All bucketing is UTC.
 *
 * Credit accounting mirrors how billing actually works:
 *  - a job is charged its operation's cost when it is queued;
 *  - a job that fails is refunded in full, so a broken job costs nothing;
 *  - a job that is still queued or processing is charged but not yet settled.
 *
 * Therefore `creditsUsed` counts only completed work, `creditsPending` counts
 * in-flight work and `creditsCharged` is the gross amount taken from the
 * balance (used + pending).
 */

/** The family of tools a job belongs to. */
export type UsageCategory = "image" | "document" | "media";

export const USAGE_CATEGORIES: UsageCategory[] = ["image", "document", "media"];

/** Human labels for the categories (mirrored in the web UI). */
export const USAGE_CATEGORY_LABELS: Record<UsageCategory, string> = {
  image: "Image tools",
  document: "Documents",
  media: "Media",
};

/** Which category each backend operation belongs to. */
export const OPERATION_CATEGORIES: Record<string, UsageCategory> = {
  resize: "image",
  convert: "image",
  compress: "image",
  watermark: "image",
  enhance: "image",
  removebg: "image",
  scan: "document",
  pdf: "document",
  ocr: "document",
  video: "media",
  audio: "media",
  fetch: "media",
};

/** The category an operation falls into (unknown operations count as media). */
export function operationCategory(operation: string): UsageCategory {
  return OPERATION_CATEGORIES[operation] ?? "media";
}

/** The credit price of one run of an operation. */
export function creditCost(operation: string): number {
  return isBillableOperation(operation) ? operationCost(operation) : 1;
}

export interface UsageOperationStat {
  operation: string;
  category: UsageCategory;
  jobs: number;
  completed: number;
  failed: number;
  active: number;
  /** Credits consumed by this operation in the window (failed jobs excluded). */
  credits: number;
  /** Credit price of a single run of this operation. */
  unitCost: number;
}

export interface UsageCategoryStat {
  category: UsageCategory;
  jobs: number;
  credits: number;
}

export interface UsageDayStat {
  /** Local UTC calendar day, `YYYY-MM-DD`. */
  date: string;
  jobs: number;
  completed: number;
  failed: number;
  credits: number;
}

export interface UsageTotals {
  jobs: number;
  completed: number;
  failed: number;
  active: number;
  /** Completed ÷ finished jobs (0–1); 0 when nothing has finished. */
  successRate: number;
  /** Credits actually consumed (completed work only). */
  creditsUsed: number;
  /** Credits charged for work that is still queued or processing. */
  creditsPending: number;
  /** Gross credits taken from the balance (used + pending). */
  creditsCharged: number;
  /** Credits returned because a job failed. */
  creditsRefunded: number;
  /** Mean credits consumed per completed job. */
  avgCreditsPerJob: number;
}

export interface UserUsage {
  windowDays: number;
  since: number;
  generatedAt: number;
  totals: UsageTotals;
  byOperation: UsageOperationStat[];
  byCategory: UsageCategoryStat[];
  byDay: UsageDayStat[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

function dayKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * Aggregate one account's jobs into a usage summary for the window that
 * starts at `sinceMs`.
 */
export function computeUserUsage(
  records: JobRecord[],
  { sinceMs, now = Date.now(), windowDays }: { sinceMs: number; now?: number; windowDays: number },
): UserUsage {
  const within = records.filter((record) => record.createdAt >= sinceMs && record.createdAt <= now);

  let completed = 0;
  let failed = 0;
  let active = 0;
  let creditsUsed = 0;
  let creditsPending = 0;
  let creditsRefunded = 0;

  const operations = new Map<string, UsageOperationStat>();
  const categories = new Map<UsageCategory, UsageCategoryStat>();
  const days = new Map<string, UsageDayStat>();

  for (const record of within) {
    const cost = creditCost(record.operation);
    const category = operationCategory(record.operation);

    if (record.state === "completed") {
      completed += 1;
      creditsUsed += cost;
    } else if (record.state === "failed") {
      failed += 1;
      // Failed jobs are refunded in full, so they consume nothing.
      creditsRefunded += cost;
    } else {
      active += 1;
      creditsPending += cost;
    }

    const op =
      operations.get(record.operation) ?? {
        operation: record.operation,
        category,
        jobs: 0,
        completed: 0,
        failed: 0,
        active: 0,
        credits: 0,
        unitCost: cost,
      };
    op.jobs += 1;
    if (record.state === "completed") {
      op.completed += 1;
      op.credits += cost;
    } else if (record.state === "failed") {
      op.failed += 1;
    } else {
      op.active += 1;
    }
    operations.set(record.operation, op);

    const cat =
      categories.get(category) ?? { category, jobs: 0, credits: 0 };
    cat.jobs += 1;
    if (record.state === "completed") cat.credits += cost;
    categories.set(category, cat);

    const key = dayKey(record.createdAt);
    const day = days.get(key) ?? { date: key, jobs: 0, completed: 0, failed: 0, credits: 0 };
    day.jobs += 1;
    if (record.state === "completed") {
      day.completed += 1;
      day.credits += cost;
    } else if (record.state === "failed") {
      day.failed += 1;
    }
    days.set(key, day);
  }

  // Emit an entry for every day in the window so charts have no gaps.
  const byDay: UsageDayStat[] = [];
  const start = new Date(sinceMs);
  const startOfDay = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
  for (let t = startOfDay; t <= now; t += DAY_MS) {
    const key = dayKey(t);
    byDay.push(days.get(key) ?? { date: key, jobs: 0, completed: 0, failed: 0, credits: 0 });
  }

  const finished = completed + failed;
  return {
    windowDays,
    since: sinceMs,
    generatedAt: now,
    totals: {
      jobs: within.length,
      completed,
      failed,
      active,
      successRate: finished > 0 ? completed / finished : 0,
      creditsUsed,
      creditsPending,
      creditsCharged: creditsUsed + creditsPending,
      creditsRefunded,
      avgCreditsPerJob: completed > 0 ? Math.round((creditsUsed / completed) * 100) / 100 : 0,
    },
    byOperation: [...operations.values()].sort(
      (a, b) => b.credits - a.credits || b.jobs - a.jobs || a.operation.localeCompare(b.operation),
    ),
    byCategory: [...categories.values()].sort(
      (a, b) => b.credits - a.credits || b.jobs - a.jobs || a.category.localeCompare(b.category),
    ),
    byDay,
  };
}

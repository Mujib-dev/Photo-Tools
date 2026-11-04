import { config } from "../config.js";
import type { AuthStore, UserRecord } from "../auth/AuthStore.js";
import type { JobManager } from "../jobs/JobManager.js";
import { PLANS, REFERRAL_BONUS_CREDITS, isBillableOperation, operationCost } from "./credits.js";
import { usageDigestEmail, type EmailTemplate } from "./emailTemplates.js";
import { emailEnabled, sendEmail } from "./notify.js";
import { logger } from "../utils/logger.js";

/**
 * Weekly usage digest: a summary of each account's last seven days of jobs and
 * credits, emailed once per week to accounts that actually did something.
 * Runs from a timer in index.ts (and on demand from the admin console).
 */

const WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
/** Newest jobs considered when building per-user summaries. */
const SCAN_LIMIT = 5_000;

export interface DigestRunResult {
  /** Digests dispatched (including log-only dispatch when SMTP is unset). */
  sent: number;
  /** Due accounts with no activity in the window (no email sent). */
  skipped: number;
  /** Accounts whose weekly slot had come due at all. */
  due: number;
  /** False when email delivery is not configured. */
  enabled: boolean;
}

const dateLabel = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });

function periodLabel(now: number): string {
  return `${dateLabel.format(now - WINDOW_MS)} – ${dateLabel.format(now)}`;
}

function topToolOf(jobs: { operation: string }[]): string | null {
  const counts = new Map<string, number>();
  for (const job of jobs) counts.set(job.operation, (counts.get(job.operation) ?? 0) + 1);
  let best: string | null = null;
  let bestCount = 0;
  for (const [tool, count] of counts) {
    if (count > bestCount || (count === bestCount && best !== null && tool < best)) {
      best = tool;
      bestCount = count;
    }
  }
  return best;
}

/** Build the digest payload for one user from their jobs in the window. */
export function buildDigestFor(
  user: UserRecord,
  jobs: { operation: string; state: string; createdAt: number }[],
  now: number,
): EmailTemplate {
  const completed = jobs.filter((job) => job.state === "completed").length;
  const creditsUsed = jobs.reduce(
    (total, job) =>
      total + (isBillableOperation(job.operation) ? operationCost(job.operation) : 1),
    0,
  );
  return usageDigestEmail({
    recipientName: user.fullName ?? user.email.split("@")[0],
    periodLabel: periodLabel(now),
    jobs: jobs.length,
    completed,
    topTool: topToolOf(jobs),
    creditsUsed,
    balance: user.credits,
    planLabel: PLANS[user.plan].label,
    referralCount: user.referralCount,
    referralLink: `${config.publicAppUrl.replace(/\/$/, "")}/signup?ref=${user.referralCode}`,
    referralBonus: REFERRAL_BONUS_CREDITS,
  });
}

/** True when this account's weekly digest slot is due. */
export function digestDue(user: UserRecord, now = Date.now()): boolean {
  if (user.digestAt == null) {
    // Never sent: only after the account has existed for a full week, so a
    // brand-new user does not get a digest about their sign-up day.
    return now - user.createdAt >= WINDOW_MS;
  }
  return now - user.digestAt >= WINDOW_MS;
}

export async function runWeeklyDigests(
  authStore: AuthStore,
  jobs: JobManager,
  now = Date.now(),
): Promise<DigestRunResult> {
  const result: DigestRunResult = { sent: 0, skipped: 0, due: 0, enabled: emailEnabled() };
  if (!result.enabled) return result;

  const since = now - WINDOW_MS;
  const allJobs = await jobs.listJobs(SCAN_LIMIT);
  const users = await authStore.listUsers();

  for (const user of users) {
    if (!digestDue(user, now)) continue;
    result.due += 1;

    const mine = allJobs.filter((job) => job.userId === user.id && job.createdAt >= since);
    if (mine.length === 0) {
      // Quiet week: nothing to report, and the slot stays open until there is.
      result.skipped += 1;
      continue;
    }

    const template = buildDigestFor(user, mine, now);
    try {
      await sendEmail({ to: user.email, subject: template.subject, text: template.text, html: template.html });
      await authStore.updateUserAccount(user.id, { digestAt: now });
      result.sent += 1;
    } catch (err) {
      // Leave digestAt untouched so the send is retried on the next run.
      result.skipped += 1;
      logger.warn("Weekly digest could not be sent", {
        userId: user.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return result;
}

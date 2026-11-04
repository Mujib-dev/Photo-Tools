import { errorFrom, request } from "@/lib/auth";

export interface PlanInfo {
  key: "free" | "pro" | "business";
  label: string;
  description: string;
  monthlyCredits: number;
  priceUsd: number;
  /** Price per month when billed annually (the yearly total is this × 12). */
  priceUsdAnnual: number;
}

export interface CreditsReferral {
  code: string;
  count: number;
  bonus: number;
  referred: boolean;
  link: string;
}

export interface CreditsUsage {
  windowDays: number;
  jobs: number;
  completed: number;
  failed: number;
  creditsUsed: number;
  byOperation: { operation: string; jobs: number; credits: number }[];
}

export interface CreditsSubscription {
  /** Stripe status: active, trialing, past_due, canceled, … */
  status: string | null;
  /** When the current paid period ends (ms epoch), or null. */
  renewsAt: number | null;
  /** True when canceled but still paid up until renewsAt. */
  cancelAtPeriodEnd: boolean;
}

export interface CreditsState {
  balance: number;
  plan: PlanInfo;
  plans: PlanInfo[];
  planCreditsAt: number | null;
  nextGrantAt: number | null;
  /** When a promo-granted tier lapses; null for a permanent plan. */
  planExpiresAt: number | null;
  /** Recurring Stripe subscription state; null on free/manual plans. */
  subscription: CreditsSubscription | null;
  referral: CreditsReferral;
  usage: CreditsUsage;
  /** Per-run credit price of each billable operation, e.g. { resize: 1, removebg: 5 }. */
  operationCosts: Record<string, number>;
}

/** Load the signed-in user's credit balance, plan, usage and referral info. */
export async function fetchCredits(): Promise<CreditsState> {
  const res = await request("/api/backend/credits");
  if (!res.ok) throw await errorFrom(res);
  return (await res.json()) as CreditsState;
}

const CACHE_TTL_MS = 60_000;
let cached: { at: number; state: CreditsState } | null = null;
let inFlight: Promise<CreditsState> | null = null;

/**
 * fetchCredits with a tiny module-level cache: concurrent callers share one
 * request and results are reused for a minute (header pill, checklist and
 * tool-page hints can all ask at once without triple-fetching).
 */
export function fetchCreditsCached(): Promise<CreditsState> {
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return Promise.resolve(cached.state);
  if (inFlight) return inFlight;
  inFlight = fetchCredits()
    .then((state) => {
      cached = { at: Date.now(), state };
      return state;
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

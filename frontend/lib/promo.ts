import { errorFrom, request } from "@/lib/auth";
import type { UserPlan } from "@/lib/types";

/**
 * Promo codes: one-off discounts handed out for launches and campaigns.
 *
 * `credits` and `plan` codes are redeemed in the app; `discount` codes are
 * applied to the Stripe checkout session instead.
 */

export type PromoKind = "credits" | "plan" | "discount";

export interface PromoSummary {
  code: string;
  description: string;
  kind: PromoKind;
  credits: number;
  plan: UserPlan | null;
  planDays: number;
  percentOff: number;
  expiresAt: number | null;
  maxRedemptions: number | null;
}

export interface PromoRedemption {
  code: string;
  kind: PromoKind;
  creditsGranted: number;
  plan: UserPlan | null;
  planDays: number;
  percentOff: number;
  balance: number;
}

export interface PromoPreview {
  valid: boolean;
  promo: PromoSummary;
  redemption: PromoRedemption | null;
  /** Why the code can't be used, or null when it can. */
  message: string | null;
}

export interface PromoRedemptionResult extends PromoRedemption {
  ok: true;
}

/** Preview a code without redeeming it. */
export async function validatePromo(code: string): Promise<PromoPreview> {
  const res = await request("/api/backend/promo/validate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  if (!res.ok) throw await errorFrom(res);
  return (await res.json()) as PromoPreview;
}

/** Redeem a code: grant the credits or the tier upgrade. */
export async function redeemPromo(code: string): Promise<PromoRedemptionResult> {
  const res = await request("/api/backend/promo/redeem", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  if (!res.ok) throw await errorFrom(res);
  return (await res.json()) as PromoRedemptionResult;
}

/** A short, human summary of what a code grants. */
export function describePromo(promo: {
  kind: PromoKind;
  credits: number;
  plan: UserPlan | null;
  planDays: number;
  percentOff: number;
}): string {
  switch (promo.kind) {
    case "credits":
      return `${promo.credits.toLocaleString("en-US")} credits`;
    case "plan":
      return `${promo.planDays} days of ${promo.plan ?? "Pro"}`;
    case "discount":
      return `${promo.percentOff}% off your next invoice`;
    default:
      return "A promotional offer";
  }
}

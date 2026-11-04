import { Crown, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";

/**
 * Marketing copy for the paid tiers. Prices and credit allowances are not
 * hard-coded here — they come from the backend catalogue (`/api/billing/plans`)
 * so the pricing page, the payment page and the profile always agree.
 */

export type PaidPlanKey = "pro" | "business";

export interface PlanPresentation {
  key: PaidPlanKey;
  title: string;
  tagline: string;
  icon: LucideIcon;
  badge?: string;
  /** Feature bullets, shown on the pricing and payment pages. */
  features: string[];
}

export const PLAN_PRESENTATION: Record<PaidPlanKey, PlanPresentation> = {
  pro: {
    key: "pro",
    title: "Pro Creator",
    tagline: "For e-commerce merchants, photographers & creators.",
    icon: Sparkles,
    badge: "Most Popular",
    features: [
      "Commercial E-Commerce Product Studio",
      "AI Vectorizer & SVG Trace with unlimited exports",
      "AI Vintage Scratch & Tear Restorer (4K output)",
      "Real Estate Exterior & Twilight Blue Hour Staging",
      "Commercial license for marketing & client work",
      "Priority GPU processing speed",
    ],
  },
  business: {
    key: "business",
    title: "Business & Team",
    tagline: "For high-volume brands, realtors & agencies.",
    icon: Crown,
    features: [
      "Unlimited Batch Studio photo processing",
      "Personal REST API Keys for automated pipelines",
      "Multi-seat team sharing & custom watermarks",
      "Zero data retention & enterprise privacy",
      "Dedicated 24/7 priority support",
    ],
  },
};

export function isPaidPlan(key: string): key is PaidPlanKey {
  return key === "pro" || key === "business";
}

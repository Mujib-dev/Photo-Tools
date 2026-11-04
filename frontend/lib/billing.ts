import { errorFrom, request } from "@/lib/auth";

/** How a recurring plan is billed. */
export type BillingCycle = "monthly" | "annual";

export interface BillingConfig {
  /** True when Stripe Checkout is configured on this deployment. */
  checkoutEnabled: boolean;
  /** True when yearly Stripe prices are configured too. */
  annualEnabled: boolean;
}

export interface PlanCatalogEntry {
  key: "free" | "pro" | "business";
  label: string;
  description: string;
  monthlyCredits: number;
  /** Price per month on monthly billing. */
  priceUsd: number;
  /** Price per month when billed annually (the yearly total is this × 12). */
  priceUsdAnnual: number;
  /** Yearly total in USD, rounded to whole cents. */
  annualTotalUsd: number;
}

/** Whether Stripe Checkout is configured on this deployment. */
export async function getBillingConfig(): Promise<BillingConfig> {
  const res = await request("/api/backend/billing/config");
  if (!res.ok) throw await errorFrom(res);
  return (await res.json()) as BillingConfig;
}

/**
 * The public plan catalogue with both billing cycles' prices. Available
 * without a session so the pricing and payment pages can render before
 * sign-in.
 */
export async function getPlanCatalog(): Promise<BillingConfig & { plans: PlanCatalogEntry[] }> {
  const res = await request("/api/backend/billing/plans");
  if (!res.ok) throw await errorFrom(res);
  return (await res.json()) as BillingConfig & { plans: PlanCatalogEntry[] };
}

export interface CheckoutResult {
  /** Hosted Stripe Checkout URL, or null when the tier was swapped in place. */
  url: string | null;
  /** True when an existing subscription's price was prorated to the new tier. */
  swapped: boolean;
  /** The discount code applied to the session, when there was one. */
  promoCode?: string | null;
}

/**
 * Start a recurring plan purchase (or an in-place tier swap when subscribed).
 *
 * `promoCode` is optional; a discount code is attached to the Stripe session
 * so the discount only takes effect once the payment completes.
 */
export async function createCheckout(
  plan: "pro" | "business",
  cycle: BillingCycle = "monthly",
  promoCode?: string | null,
): Promise<CheckoutResult> {
  const res = await request("/api/backend/billing/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plan, cycle, ...(promoCode ? { promoCode } : {}) }),
  });
  if (!res.ok) throw await errorFrom(res);
  return (await res.json()) as CheckoutResult;
}

export interface VerifyResult {
  ok: boolean;
  plan: string;
  /** False when the session had already been applied (replay/retry). */
  changed: boolean;
  status: string | null;
}

/**
 * Confirm the session the browser came back with. The server re-fetches it
 * from Stripe, so this cannot be faked client-side.
 */
export async function verifyCheckout(sessionId: string): Promise<VerifyResult> {
  const res = await request("/api/backend/billing/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId }),
  });
  if (!res.ok) throw await errorFrom(res);
  return (await res.json()) as VerifyResult;
}

/** Open the Stripe Customer Portal (card, invoices, cancel at period end). */
export async function createPortalSession(): Promise<{ url: string }> {
  const res = await request("/api/backend/billing/portal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  if (!res.ok) throw await errorFrom(res);
  return (await res.json()) as { url: string };
}

export interface PakistanPaymentMethod {
  id: "jazzcash" | "easypaisa" | "bank";
  name: string;
  tag: string;
  accountTitle: string;
  accountNumber: string;
  tillId?: string;
  bankName?: string;
  iban?: string;
  raastId?: string;
  instructions: string;
}

export interface PakistanPaymentCatalog {
  currency: "PKR";
  exchangeRateUsdToPkr: number;
  plans: {
    pro: { monthlyPkr: number; annualPkr: number };
    business: { monthlyPkr: number; annualPkr: number };
  };
  methods: PakistanPaymentMethod[];
}

export interface ManualPaymentResult {
  ok: boolean;
  plan: string;
  cycle: string;
  method: string;
  transactionId: string;
  renewsAt: number;
  creditsGranted: number;
  totalCredits: number;
}

/** Get Pakistani payment accounts (JazzCash, EasyPaisa, Bank Transfer / Raast). */
export async function getPakistanPaymentMethods(): Promise<PakistanPaymentCatalog> {
  const res = await request("/api/backend/billing/pakistan-methods");
  if (!res.ok) throw await errorFrom(res);
  return (await res.json()) as PakistanPaymentCatalog;
}

/** Submit a JazzCash, EasyPaisa or Bank Transfer transaction ID for plan activation. */
export async function submitManualPayment(params: {
  plan: "pro" | "business";
  cycle: BillingCycle;
  method: "jazzcash" | "easypaisa" | "bank";
  transactionId: string;
  senderAccount: string;
}): Promise<ManualPaymentResult> {
  const res = await request("/api/backend/billing/manual-payment", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw await errorFrom(res);
  return (await res.json()) as ManualPaymentResult;
}

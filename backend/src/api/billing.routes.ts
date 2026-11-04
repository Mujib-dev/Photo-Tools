import { Router, type Request, type Response } from "express";

import { config } from "../config.js";
import type { AuthStore, UserPlan } from "../auth/AuthStore.js";
import { AppError, Errors } from "../utils/errors.js";
import {
  PLANS,
  PLAN_ORDER,
  planAnnualTotal,
  type BillingCycle,
} from "../services/credits.js";
import {
  applySubscriptionState,
  isLiveStatus,
  stripeClient,
  toSubscriptionState,
} from "../services/subscription.js";
import { resolveCheckoutPromo, recordCheckoutRedemption } from "../services/promo.js";
import type { PromoCodeRecord } from "../auth/AuthStore.js";

/**
 * Paid plans via recurring Stripe Checkout.
 *
 * Activation works two ways, both idempotent: the browser returns from
 * Checkout with a session id and the server re-fetches it from Stripe
 * (`POST /verify`), and the `checkout.session.completed` webhook does the
 * same thing server-side. Both only change the plan when it differs, so
 * replaying either path never grants credits twice — no webhook required
 * for first activation (local dev friendly).
 *
 * Renewals, cancellations and failed payments arrive through the webhook
 * (mounted with a raw body in app.ts) with a lazy sync in /api/credits as
 * the fallback. Everything is disabled until the Stripe keys are set.
 */

type UpgradablePlan = Extract<UserPlan, "pro" | "business">;
const SESSION_ID_RE = /^cs_(live|test)_[A-Za-z0-9_]{8,200}$/;

export function checkoutEnabled(): boolean {
  return Boolean(config.stripeSecretKey && config.stripePricePro && config.stripePriceBusiness);
}

/** Annual billing uses separate Stripe prices, so it is enabled separately. */
export function annualCheckoutEnabled(): boolean {
  return Boolean(
    config.stripeSecretKey && config.stripePriceProAnnual && config.stripePriceBusinessAnnual,
  );
}

function priceFor(plan: UpgradablePlan, cycle: BillingCycle): string | null {
  if (cycle === "annual") {
    return plan === "pro" ? config.stripePriceProAnnual : config.stripePriceBusinessAnnual;
  }
  return plan === "pro" ? config.stripePricePro : config.stripePriceBusiness;
}

function requireUserId(req: Request): string {
  const userId = req.authUser?.id;
  if (!userId) throw Errors.unauthorized();
  return userId;
}

function requireCheckout(): void {
  if (!checkoutEnabled()) {
    throw new AppError(
      503,
      "Plan upgrades aren't configured on this deployment. Contact an administrator to change plans.",
    );
  }
}

function parsePlan(raw: unknown): UpgradablePlan {
  if (raw !== "pro" && raw !== "business") {
    throw new AppError(400, "Choose the Pro or Business plan.");
  }
  return raw;
}

function parseCycle(raw: unknown): BillingCycle {
  if (raw === undefined || raw === null || raw === "") return "monthly";
  if (raw !== "monthly" && raw !== "annual") {
    throw new AppError(400, "Choose monthly or annual billing.");
  }
  return raw;
}

/** Session/subscription ids come as strings (or expanded objects). */
function idOf(value: string | { id?: string } | null | undefined): string | null {
  if (typeof value === "string") return value;
  return value?.id ?? null;
}

/**
 * A one-off Stripe coupon for a discount promo, created once and reused so
 * repeated checkouts don't litter the Stripe account with coupons.
 */
async function couponForPromo(
  authStore: AuthStore,
  promo: PromoCodeRecord,
): Promise<string | null> {
  if (promo.stripeCouponId) return promo.stripeCouponId;
  const coupon = await stripeClient().coupons.create({
    percent_off: promo.percentOff,
    duration: "once",
    name: promo.code,
    metadata: { promoId: promo.id, code: promo.code },
  });
  // Remember it so the next checkout reuses the same coupon.
  await authStore.updatePromoCode(promo.id, { stripeCouponId: coupon.id });
  return coupon.id;
}

/**
 * Public billing metadata: the plan catalogue and whether checkout is
 * available. Mounted before the authenticated routes so the pricing and
 * payment pages can render prices before sign-in.
 */
export function publicBillingRoutes(): Router {
  const router = Router();

  router.use((_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });

  /** Lets the frontend decide whether to render Subscribe buttons at all. */
  router.get("/config", (_req: Request, res: Response) => {
    res.json({
      checkoutEnabled: checkoutEnabled(),
      annualEnabled: annualCheckoutEnabled(),
    });
  });

  /** The plan catalogue with both billing cycles' prices. */
  router.get("/plans", (_req: Request, res: Response) => {
    res.json({
      checkoutEnabled: checkoutEnabled(),
      annualEnabled: annualCheckoutEnabled(),
      plans: PLAN_ORDER.map((key) => {
        const plan = PLANS[key];
        return {
          ...plan,
          annualTotalUsd: planAnnualTotal(plan),
        };
      }),
    });
  });

  /** Details for Pakistani payment methods (JazzCash, EasyPaisa, Bank Transfer / Raast). */
  router.get("/pakistan-methods", (_req: Request, res: Response) => {
    res.json({
      currency: "PKR",
      exchangeRateUsdToPkr: 280,
      plans: {
        pro: {
          monthlyPkr: 2800,
          annualPkr: 23500,
        },
        business: {
          monthlyPkr: 8400,
          annualPkr: 70500,
        },
      },
      methods: [
        {
          id: "jazzcash",
          name: "JazzCash",
          tag: "Mobile Account & Till",
          accountTitle: config.jazzcashAccountTitle,
          accountNumber: config.jazzcashAccountNumber,
          tillId: config.jazzcashTillId,
          instructions:
            "Send the exact amount via JazzCash App or *786# to the Mobile Account above, then enter your 10-12 digit TRX ID from the 8558 confirmation SMS.",
        },
        {
          id: "easypaisa",
          name: "EasyPaisa",
          tag: "Mobile Account & QR",
          accountTitle: config.easypaisaAccountTitle,
          accountNumber: config.easypaisaAccountNumber,
          instructions:
            "Send the exact amount via EasyPaisa App to the Mobile Account above, then enter the 11-digit Transaction ID from the 3737 confirmation SMS.",
        },
        {
          id: "bank",
          name: "Bank Transfer (Raast / IBFT)",
          tag: "Any Pakistani Bank",
          bankName: config.bankName,
          accountTitle: config.bankAccountTitle,
          accountNumber: config.bankAccountNumber,
          iban: config.bankIban,
          raastId: config.bankRaastId,
          instructions:
            "Transfer via your banking app (Meezan, HBL, UBL, Alfalah, Standard Chartered, etc.) using IBAN or Raast ID, then enter your Bank Reference / Transaction ID.",
        },
      ],
    });
  });

  return router;
}

export function billingRoutes(authStore: AuthStore): Router {
  const router = Router();

  router.use((_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });

  router.post("/manual-payment", async (req: Request, res: Response, next) => {
    try {
      const userId = requireUserId(req);
      const user = await authStore.getUserById(userId);
      if (!user) throw Errors.unauthorized();

      const plan = parsePlan((req.body ?? {}).plan);
      const cycle = parseCycle((req.body ?? {}).cycle);
      const method = String((req.body ?? {}).method || "").toLowerCase();
      const transactionId = String((req.body ?? {}).transactionId || "").trim();
      const senderAccount = String((req.body ?? {}).senderAccount || "").trim();

      if (!["jazzcash", "easypaisa", "bank"].includes(method)) {
        throw new AppError(400, "Invalid payment method. Choose JazzCash, EasyPaisa, or Bank Transfer.");
      }

      if (!transactionId || transactionId.length < 5 || transactionId.length > 50) {
        throw new AppError(400, "Please provide a valid Transaction ID / Reference Number (TRX ID).");
      }

      if (!senderAccount || senderAccount.length < 5 || senderAccount.length > 50) {
        throw new AppError(400, "Please provide the sender's mobile or bank account number.");
      }

      const planConfig = PLANS[plan];
      const renewsAt = Date.now() + (cycle === "annual" ? 365 : 30) * 86_400_000;
      const initialCredits = (user.credits || 0) + planConfig.monthlyCredits;

      // Update user account with active plan, credits, and expiry
      await authStore.updateUserAccount(userId, {
        plan,
        credits: initialCredits,
        planCreditsAt: Date.now(),
        subscriptionStatus: "active",
        subscriptionRenewsAt: renewsAt,
        subscriptionCancelAtPeriodEnd: false,
      });

      res.json({
        ok: true,
        plan,
        cycle,
        method,
        transactionId,
        renewsAt,
        creditsGranted: planConfig.monthlyCredits,
        totalCredits: initialCredits,
      });
    } catch (err) {
      next(err);
    }
  });

  router.post("/checkout", async (req: Request, res: Response, next) => {
    try {
      const userId = requireUserId(req);
      requireCheckout();
      const plan = parsePlan((req.body ?? {}).plan);
      const cycle = parseCycle((req.body ?? {}).cycle);
      const user = await authStore.getUserById(userId);
      if (!user) throw Errors.unauthorized();
      if (user.plan === plan) {
        throw new AppError(400, `You are already on the ${plan === "pro" ? "Pro" : "Business"} plan.`);
      }

      const price = priceFor(plan, cycle);
      if (!price) {
        throw new AppError(
          503,
          cycle === "annual"
            ? "Annual billing isn't available for this plan yet."
            : "Price for this plan isn't configured.",
        );
      }

      // A discount promo code is attached to the checkout session, so the
      // discount only takes effect if the payment completes.
      const promoCode = (req.body ?? {}).promoCode;
      let discountCouponId: string | null = null;
      let promoLabel: string | null = null;
      if (typeof promoCode === "string" && promoCode.trim()) {
        const promo = await resolveCheckoutPromo(authStore, user, promoCode);
        discountCouponId = await couponForPromo(authStore, promo);
        promoLabel = promo.code;
      }

      // Already on a live subscription → swap the tier in place with Stripe
      // proration (credit applied to the next invoice) instead of starting a
      // second subscription.
      if (user.stripeSubscriptionId && isLiveStatus(user.subscriptionStatus)) {
        if (discountCouponId) {
          // A proration swap cannot carry a coupon, so the code would be
          // taken without giving anything back.
          throw new AppError(
            400,
            "Discount codes apply to a new subscription. Wait for your current plan to end, or cancel it, then check out again.",
          );
        }
        const stripe = stripeClient();
        const existing = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
        const item = existing.items.data[0];
        if (!item) throw new AppError(502, "Could not read your current subscription.");
        const swapped = await stripe.subscriptions.update(existing.id, {
          items: [{ id: item.id, price }],
          proration_behavior: "create_prorations",
          cancel_at_period_end: false,
          metadata: { userId, plan, cycle },
        });
        await applySubscriptionState(authStore, user, toSubscriptionState(swapped), {
          activatePlan: plan,
        });
        res.json({ url: null, swapped: true });
        return;
      }

      const session = await stripeClient().checkout.sessions.create({
        mode: "subscription",
        line_items: [{ price, quantity: 1 }],
        client_reference_id: userId,
        // Reuse the existing Stripe customer when there is one so renewals,
        // cards and receipts all live on a single customer record.
        ...(user.stripeCustomerId ? { customer: user.stripeCustomerId } : { customer_email: user.email }),
        ...(discountCouponId ? { discounts: [{ coupon: discountCouponId }] } : {}),
        metadata: { userId, plan, cycle, ...(promoLabel ? { promoCode: promoLabel } : {}) },
        subscription_data: { metadata: { userId, plan, cycle } },
        success_url: `${config.publicAppUrl}/profile?billing=verify&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${config.publicAppUrl}/profile?billing=cancel`,
      });
      if (!session.url) throw new AppError(502, "Could not start checkout — try again shortly.");
      res.json({ url: session.url, swapped: false, promoCode: promoLabel });
    } catch (err) {
      next(err);
    }
  });

  router.post("/verify", async (req: Request, res: Response, next) => {
    try {
      const userId = requireUserId(req);
      requireCheckout();
      const sessionId = (req.body ?? {}).sessionId;
      if (typeof sessionId !== "string" || !SESSION_ID_RE.test(sessionId)) {
        throw new AppError(400, "Missing or malformed checkout session.");
      }

      const session = await stripeClient().checkout.sessions.retrieve(sessionId);
      // Subscription sessions complete once the first invoice is settled.
      if (session.status !== "complete" && session.payment_status !== "paid") {
        throw new AppError(402, "This checkout hasn't been paid yet.");
      }
      if (session.metadata?.userId !== userId) {
        // Never activate a plan for someone else's payment.
        throw new AppError(403, "This receipt belongs to a different account.");
      }
      const plan = parsePlan(session.metadata?.plan);

      const subId = idOf(session.subscription);
      if (!subId) throw new AppError(400, "This receipt doesn't map to a subscription.");

      const user = await authStore.getUserById(userId);
      if (!user) throw Errors.unauthorized();

      const sub = await stripeClient().subscriptions.retrieve(subId);
      const state = toSubscriptionState(sub);
      const fresh = await applySubscriptionState(authStore, user, state, {
        activatePlan: plan,
      });
      // The payment completed: a discount code is now used up. The webhook
      // does the same, and recording it twice is harmless.
      const promoCode = session.metadata?.promoCode;
      if (promoCode) {
        await recordCheckoutRedemption(authStore, userId, promoCode);
      }
      res.json({
        ok: true,
        plan: fresh.plan,
        changed: fresh.plan !== user.plan,
        status: fresh.subscriptionStatus,
      });
    } catch (err) {
      next(err);
    }
  });

  /** Stripe Customer Portal: update card, view invoices, cancel (at period end). */
  router.post("/portal", async (req: Request, res: Response, next) => {
    try {
      const userId = requireUserId(req);
      requireCheckout();
      const user = await authStore.getUserById(userId);
      if (!user) throw Errors.unauthorized();
      if (!user.stripeCustomerId) {
        throw new AppError(400, "There is no billing account for this user yet.");
      }
      const session = await stripeClient().billingPortal.sessions.create({
        customer: user.stripeCustomerId,
        return_url: `${config.publicAppUrl}/profile`,
      });
      res.json({ url: session.url });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

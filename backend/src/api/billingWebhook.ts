import type { Request, Response } from "express";
import type Stripe from "stripe";

import { config } from "../config.js";
import type { AuthStore, UserRecord } from "../auth/AuthStore.js";
import { logger } from "../utils/logger.js";
import {
  applySubscriptionState,
  stripeClient,
  toSubscriptionState,
} from "../services/subscription.js";
import { recordCheckoutRedemption } from "../services/promo.js";

/**
 * Stripe webhook receiver — mounted with `express.raw` BEFORE the JSON
 * parser (see app.ts) because signature verification needs the exact bytes.
 *
 * Handled events:
 * - checkout.session.completed  → activate the plan (idempotent with verify)
 * - customer.subscription.updated/deleted → status/period/plan reconciliation
 * - invoice.payment_failed / invoice.paid → pull the authoritative state
 *
 * Unknown events are acknowledged and ignored so adding events in the
 * Stripe dashboard never causes retries. Processing errors return 500 so
 * Stripe retries later; a bad signature returns 400 (never retried).
 */

type Handler = (req: Request, res: Response) => void;

function idOf(value: string | { id?: string } | null | undefined): string | null {
  if (typeof value === "string") return value;
  return value?.id ?? null;
}

/** Invoice → subscription id across old (invoice.subscription) and new (parent…) shapes. */
function invoiceSubscriptionId(raw: unknown): string | null {
  const inv = raw as {
    subscription?: string | { id?: string } | null;
    parent?: { subscription_details?: { subscription?: string | { id?: string } | null } | null } | null;
  };
  return idOf(inv.subscription) ?? idOf(inv.parent?.subscription_details?.subscription);
}

/** Resolve which account a subscription belongs to (metadata first, then a scan). */
async function findUserForSubscription(
  store: AuthStore,
  subscriptionId: string,
  metadataUserId?: string,
): Promise<UserRecord | null> {
  if (metadataUserId) {
    const byMetadata = await store.getUserById(metadataUserId);
    if (byMetadata && (byMetadata.stripeSubscriptionId === subscriptionId || !byMetadata.stripeSubscriptionId)) {
      return byMetadata;
    }
  }
  const users = await store.listUsers();
  return users.find((u) => u.stripeSubscriptionId === subscriptionId) ?? null;
}

async function dispatch(store: AuthStore, event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as unknown as Stripe.Checkout.Session;
      if (session.mode !== "subscription") return;
      const userId = session.metadata?.userId ?? session.client_reference_id ?? undefined;
      const plan = session.metadata?.plan;
      if (!userId || (plan !== "pro" && plan !== "business")) return;
      const user = await store.getUserById(userId);
      if (!user) return;
      const subId = idOf(session.subscription);
      if (!subId) return;
      const sub = await stripeClient().subscriptions.retrieve(subId);
      await applySubscriptionState(store, user, toSubscriptionState(sub), { activatePlan: plan });
      // The payment completed, so a discount code is now used up. Recording
      // it here (and in /verify) is idempotent — the first one wins.
      const promoCode = session.metadata?.promoCode;
      if (promoCode) {
        await recordCheckoutRedemption(store, userId, promoCode);
      }
      return;
    }

    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = event.data.object as unknown as Parameters<typeof toSubscriptionState>[0];
      const subId = sub.id ?? null;
      if (!subId) return;
      const user = await findUserForSubscription(store, subId, sub.metadata?.userId);
      if (!user) {
        logger.warn("Webhook: subscription has no matching account", { subscriptionId: subId });
        return;
      }
      await applySubscriptionState(store, user, toSubscriptionState(sub));
      return;
    }

    case "invoice.payment_failed":
    case "invoice.paid": {
      const subId = invoiceSubscriptionId(event.data.object);
      if (!subId) return;
      const user = await findUserForSubscription(store, subId);
      if (!user) return;
      try {
        const sub = await stripeClient().subscriptions.retrieve(subId);
        await applySubscriptionState(store, user, toSubscriptionState(sub));
      } catch (err) {
        const missing =
          typeof err === "object" && err !== null && (err as { code?: string }).code === "resource_missing";
        if (!missing) throw err;
        await applySubscriptionState(store, user, {
          subscriptionId: subId,
          status: "canceled",
          priceId: null,
          renewsAt: null,
          cancelAtPeriodEnd: false,
        });
      }
      return;
    }

    default:
      // Acknowledged and ignored (no-op).
      return;
  }
}

export function stripeWebhookHandler(authStore: AuthStore): Handler {
  return (req: Request, res: Response) => {
    void (async () => {
      if (!config.stripeSecretKey || !config.stripeWebhookSecret) {
        res.status(503).json({ error: "Stripe webhooks are not configured." });
        return;
      }
      const signature = req.headers["stripe-signature"];
      if (typeof signature !== "string") {
        res.status(400).json({ error: "Missing Stripe signature." });
        return;
      }

      let event: Stripe.Event;
      try {
        // req.body is the raw Buffer from express.raw — never re-serialised.
        event = stripeClient().webhooks.constructEvent(
          req.body as Buffer,
          signature,
          config.stripeWebhookSecret,
        );
      } catch (err) {
        logger.warn("Webhook: bad signature", { error: err instanceof Error ? err.message : String(err) });
        res.status(400).json({ error: "Invalid Stripe signature." });
        return;
      }

      try {
        await dispatch(authStore, event);
        res.json({ received: true });
      } catch (err) {
        // 500 → Stripe retries with backoff, so transient failures recover.
        logger.error("Webhook: processing failed", {
          type: event.type,
          error: err instanceof Error ? err.message : String(err),
        });
        res.status(500).json({ error: "Webhook handling failed." });
      }
    })();
  };
}

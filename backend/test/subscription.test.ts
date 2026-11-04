import test from "node:test";
import assert from "node:assert/strict";

import { MemoryAuthStore } from "../src/auth/MemoryAuthStore.js";
import { SqliteAuthStore } from "../src/auth/SqliteAuthStore.js";
import type { SubscriptionState } from "../src/services/subscription.js";
import {
  applySubscriptionState,
  isLiveStatus,
  sweepSubscriptions,
  syncSubscription,
} from "../src/services/subscription.js";

const DAY_MS = 24 * 60 * 60 * 1000;

function state(overrides: Partial<SubscriptionState> = {}): SubscriptionState {
  return {
    customerId: "cus_123",
    subscriptionId: "sub_123",
    status: "active",
    priceId: "price_pro",
    renewsAt: Date.now() + 30 * DAY_MS,
    cancelAtPeriodEnd: false,
    ...overrides,
  };
}

test("isLiveStatus: only subscription states that keep a paid plan", () => {
  assert.equal(isLiveStatus("active"), true);
  assert.equal(isLiveStatus("trialing"), true);
  assert.equal(isLiveStatus("past_due"), true, "dunning window keeps the plan");
  assert.equal(isLiveStatus("canceled"), false);
  assert.equal(isLiveStatus("unpaid"), false);
  assert.equal(isLiveStatus("incomplete_expired"), false);
  assert.equal(isLiveStatus(null), false);
});

test("applySubscriptionState: checkout activation grants the tier exactly once", async () => {
  const store = new MemoryAuthStore();
  const user = await store.createUser("act@example.com", "hash");
  assert.equal(user.plan, "free");
  const welcome = user.credits;

  const fresh = await applySubscriptionState(store, user, state(), { activatePlan: "pro" });
  assert.equal(fresh.plan, "pro");
  assert.equal(fresh.credits, welcome + 5_000, "the Pro allowance is granted on activation");
  assert.equal(fresh.stripeCustomerId, "cus_123");
  assert.equal(fresh.stripeSubscriptionId, "sub_123");
  assert.equal(fresh.subscriptionStatus, "active");
  assert.ok(fresh.subscriptionRenewsAt != null);

  // Replay (webhook + browser verify both landing) must not grant twice.
  const again = await applySubscriptionState(store, fresh, state(), { activatePlan: "pro" });
  assert.equal(again.plan, "pro");
  assert.equal(again.credits, fresh.credits, "idempotent — no second grant");
});

test("applySubscriptionState: past_due and cancel-at-period-end keep the plan", async () => {
  const store = new MemoryAuthStore();
  const user = await store.createUser("keep@example.com", "hash");
  let fresh = await applySubscriptionState(store, user, state(), { activatePlan: "business" });
  assert.equal(fresh.plan, "business");

  fresh = await applySubscriptionState(store, fresh, state({ status: "past_due" }));
  assert.equal(fresh.plan, "business", "failed payment stays live during Stripe retries");
  assert.equal(fresh.subscriptionStatus, "past_due");

  fresh = await applySubscriptionState(
    store,
    fresh,
    state({ cancelAtPeriodEnd: true, renewsAt: 1_000_000 }),
  );
  assert.equal(fresh.plan, "business", "canceling keeps the plan until period end");
  assert.equal(fresh.subscriptionCancelAtPeriodEnd, true);
  assert.equal(fresh.subscriptionRenewsAt, 1_000_000);
});

test("applySubscriptionState: an ended subscription downgrades to free with a grant", async () => {
  const store = new MemoryAuthStore();
  const user = await store.createUser("end@example.com", "hash");
  const welcome = user.credits;
  let fresh = await applySubscriptionState(store, user, state(), { activatePlan: "pro" });
  fresh = await applySubscriptionState(store, fresh, state({ status: "canceled", priceId: null }));

  assert.equal(fresh.plan, "free");
  assert.equal(fresh.subscriptionStatus, "canceled");
  assert.equal(fresh.credits, welcome + 5_000 + 100, "downgrade grants the free allowance once");
  assert.ok(fresh.planCreditsAt != null, "the 30-day cycle restarts on downgrade");

  // A second canceled-state reconciliation (sweep after webhook) changes nothing.
  const stable = await applySubscriptionState(store, fresh, state({ status: "canceled", priceId: null }));
  assert.equal(stable.credits, fresh.credits);
  assert.equal(stable.plan, "free");
});

test("applySubscriptionState: a free account with an active sub activates from the price mapping", async () => {
  // No configured prices in tests → the mapping can't fire, so the plan must
  // stay free while the stored state is still reconciled.
  const store = new MemoryAuthStore();
  const user = await store.createUser("map@example.com", "hash");
  const fresh = await applySubscriptionState(store, user, state());
  assert.equal(fresh.plan, "free");
  assert.equal(fresh.stripeSubscriptionId, "sub_123");
  assert.equal(fresh.subscriptionStatus, "active");
});

test("syncSubscription: a no-op without Stripe or a stored subscription", async () => {
  const store = new MemoryAuthStore();
  const plain = await store.createUser("plain@example.com", "hash");
  assert.equal(await syncSubscription(store, plain, { force: true }), plain, "no Stripe key, no call");

  const withSub = await store.createUser("sub@example.com", "hash");
  await store.updateUserAccount(withSub.id, {
    stripeSubscriptionId: "sub_x",
    subscriptionStatus: "active",
  });
  const reloaded = (await store.getUserById(withSub.id))!;
  const synced = await syncSubscription(store, reloaded, { force: true });
  // STRIPE_SECRET_KEY is unset in tests → fails open and keeps state as-is.
  assert.equal(synced.plan, "free");
  assert.equal(synced.stripeSubscriptionId, "sub_x");
  assert.equal(synced.subscriptionStatus, "active");
});

test("sweepSubscriptions: downgrades lapsed plans locally, ignores manual ones", async () => {
  const store = new MemoryAuthStore();

  // Lapsed: paid plan, stored status proves the subscription ended.
  const lapsed = await store.createUser("lapsed@example.com", "hash");
  await store.updateUserAccount(lapsed.id, {
    plan: "pro",
    stripeSubscriptionId: "sub_gone",
    subscriptionStatus: "canceled",
    subscriptionRenewsAt: Date.now() - DAY_MS,
  });

  // Manual: admin-granted plan with no subscription linkage at all.
  const manual = await store.createUser("manual@example.com", "hash");
  await store.updateUserAccount(manual.id, { plan: "business" });

  const result = await sweepSubscriptions(store);
  assert.equal(result.downgraded, 1);

  const lapsedAfter = (await store.getUserById(lapsed.id))!;
  assert.equal(lapsedAfter.plan, "free");
  assert.equal(lapsedAfter.stripeSubscriptionId, "sub_gone", "history is kept");
  assert.equal(lapsedAfter.subscriptionStatus, "canceled");

  const manualAfter = (await store.getUserById(manual.id))!;
  assert.equal(manualAfter.plan, "business", "admin-granted plans are untouched");
});

test("sqlite store: subscription columns migrate and round-trip", async () => {
  const store = new SqliteAuthStore(":memory:");
  await store.init();
  const user = await store.createUser("sql@example.com", "hash");

  const defaults = await store.getUserById(user.id);
  assert.equal(defaults?.stripeCustomerId, null);
  assert.equal(defaults?.stripeSubscriptionId, null);
  assert.equal(defaults?.subscriptionStatus, null);
  assert.equal(defaults?.subscriptionRenewsAt, null);
  assert.equal(defaults?.subscriptionCancelAtPeriodEnd, false);

  await store.updateUserAccount(user.id, {
    plan: "pro",
    stripeCustomerId: "cus_sql",
    stripeSubscriptionId: "sub_sql",
    subscriptionStatus: "active",
    subscriptionRenewsAt: 1_700_000_000_000,
    subscriptionCancelAtPeriodEnd: true,
  });

  const updated = await store.getUserById(user.id);
  assert.ok(updated, "row still readable after the migration");
  assert.equal(updated.plan, "pro");
  assert.equal(updated.stripeCustomerId, "cus_sql");
  assert.equal(updated.stripeSubscriptionId, "sub_sql");
  assert.equal(updated.subscriptionStatus, "active");
  assert.equal(updated.subscriptionRenewsAt, 1_700_000_000_000);
  assert.equal(updated.subscriptionCancelAtPeriodEnd, true, "boolean survives the 0/1 column");

  await store.updateUserAccount(user.id, { subscriptionCancelAtPeriodEnd: false });
  assert.equal((await store.getUserById(user.id))?.subscriptionCancelAtPeriodEnd, false);
  await store.close();
});

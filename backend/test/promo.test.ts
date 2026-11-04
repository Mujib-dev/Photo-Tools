import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import express, { type NextFunction, type Request, type Response } from "express";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";

import { MemoryAuthStore } from "../src/auth/MemoryAuthStore.js";
import type { PromoCodeRecord, UserRecord } from "../src/auth/AuthStore.js";
import { promoRoutes } from "../src/api/promo.routes.js";
import {
  MAX_PROMO_CREDITS,
  isValidPromoCodeFormat,
  normalizePromoCode,
  previewPromo,
  promoRejection,
  recordCheckoutRedemption,
  redeemPromo,
  resolveCheckoutPromo,
} from "../src/services/promo.js";
import { ensurePlanCredits } from "../src/services/credits.js";
import { AppError } from "../src/utils/errors.js";

/** Promo codes: limits, granting and the in-app vs checkout split. */

const NOW = Date.UTC(2026, 2, 1, 12, 0, 0);

function promo(overrides: Partial<PromoCodeRecord> = {}): PromoCodeRecord {
  return {
    id: randomUUID(),
    code: "LAUNCH500",
    description: "Launch credit grant",
    kind: "credits",
    credits: 500,
    plan: null,
    planDays: 30,
    percentOff: 0,
    maxRedemptions: null,
    maxPerUser: 1,
    redeemedCount: 0,
    expiresAt: null,
    active: true,
    stripeCouponId: null,
    createdAt: NOW,
    ...overrides,
  };
}

async function seedStore(): Promise<{ store: MemoryAuthStore; user: UserRecord }> {
  const store = new MemoryAuthStore();
  await store.init();
  const user = await store.createUser("promo@example.com", "hash");
  return { store, user };
}

test("promo: codes are normalised to uppercase", () => {
  assert.equal(normalizePromoCode("  launch500 "), "LAUNCH500");
  assert.equal(isValidPromoCodeFormat("LAUNCH500"), true);
  assert.equal(isValidPromoCodeFormat("launch-500"), true);
  assert.equal(isValidPromoCodeFormat("ab"), false);
  assert.equal(isValidPromoCodeFormat("has space"), false);
});

test("promo: a credits code grants the balance once", async () => {
  const { store, user } = await seedStore();
  const record = promo();
  await store.createPromoCode(record);

  const outcome = await redeemPromo(store, user, "launch500", NOW);
  assert.equal(outcome.creditsGranted, 500);
  assert.equal(outcome.kind, "credits");

  const fresh = await store.getUserById(user.id);
  assert.equal(fresh?.credits, 500 + 100); // 100 = the free plan's welcome allowance

  // A second redemption by the same account is refused.
  await assert.rejects(
    () => redeemPromo(store, user, "LAUNCH500", NOW),
    (err: unknown) => err instanceof AppError && /already used/i.test(err.safe),
  );
});

test("promo: a plan code upgrades the tier and grants its allowance", async () => {
  const { store, user } = await seedStore();
  await store.createPromoCode(
    promo({ code: "PRO30", kind: "plan", plan: "pro", credits: 0, planDays: 30 }),
  );

  const outcome = await redeemPromo(store, user, "PRO30", NOW);
  assert.equal(outcome.plan, "pro");
  assert.equal(outcome.creditsGranted, 5_000);

  const fresh = await store.getUserById(user.id);
  assert.equal(fresh?.plan, "pro");
  assert.equal(fresh?.credits, 100 + 5_000);
});

test("promo: discount codes cannot be redeemed in the app", async () => {
  const { store, user } = await seedStore();
  await store.createPromoCode(
    promo({ code: "SAVE25", kind: "discount", credits: 0, percentOff: 25 }),
  );

  await assert.rejects(
    () => redeemPromo(store, user, "SAVE25", NOW),
    (err: unknown) => err instanceof AppError && /checkout/i.test(err.safe),
  );
});

test("promo: unknown codes are rejected", async () => {
  const { store, user } = await seedStore();
  await assert.rejects(
    () => redeemPromo(store, user, "NOPE", NOW),
    (err: unknown) => err instanceof AppError && /isn't valid/i.test(err.safe),
  );
});

test("promo: inactive, expired and exhausted codes are rejected", async () => {
  const { store, user } = await seedStore();
  await store.createPromoCode(promo({ code: "OFF", active: false }));
  await store.createPromoCode(promo({ code: "OLD", expiresAt: NOW - 1 }));
  await store.createPromoCode(
    promo({ code: "FULL", maxRedemptions: 1, redeemedCount: 1 }),
  );

  for (const code of ["OFF", "OLD", "FULL"]) {
    await assert.rejects(
      () => redeemPromo(store, user, code, NOW),
      (err: unknown) => err instanceof AppError,
      code,
    );
  }
});

test("promo: the rejection reason is reported without granting anything", async () => {
  const { store, user } = await seedStore();
  await store.createPromoCode(promo({ code: "OFF", active: false }));

  const result = await previewPromo(store, user, "OFF", NOW);
  assert.equal(result.rejection, "inactive");
  assert.equal(result.redemption, null);

  const fresh = await store.getUserById(user.id);
  assert.equal(fresh?.credits, 100);
});

test("promo: a discount code previews as valid but grants nothing in-app", async () => {
  const { store, user } = await seedStore();
  await store.createPromoCode(
    promo({ code: "SAVE25", kind: "discount", credits: 0, percentOff: 25 }),
  );

  const result = await previewPromo(store, user, "SAVE25", NOW);
  assert.equal(result.rejection, null);
  assert.equal(result.redemption, null);
  assert.equal(result.promo.percentOff, 25);
});

test("promo: the per-account cap is enforced independently of the total", async () => {
  const { store, user } = await seedStore();
  const other = await store.createUser("other@example.com", "hash");
  await store.createPromoCode(promo({ code: "SHARED", maxPerUser: 1, maxRedemptions: 2 }));

  await redeemPromo(store, user, "SHARED", NOW);
  await redeemPromo(store, other, "SHARED", NOW);

  const record = await store.getPromoCodeByCode("SHARED");
  assert.equal(record?.redeemedCount, 2);

  const third = await store.createUser("third@example.com", "hash");
  await assert.rejects(
    () => redeemPromo(store, third, "SHARED", NOW),
    (err: unknown) => err instanceof AppError && /fully claimed/i.test(err.safe),
  );
});

test("promo: a credit grant is capped so a typo cannot mint a fortune", () => {
  assert.ok(MAX_PROMO_CREDITS <= 1_000_000);
  assert.equal(promoRejection(promo({ maxRedemptions: 0, redeemedCount: 0 }), 0, NOW), "exhausted");
});

test("promo: a plan code lapses back to free when its days run out", async () => {
  const { store, user } = await seedStore();
  await store.createPromoCode(
    promo({ code: "PRO30", kind: "plan", plan: "pro", credits: 0, planDays: 30 }),
  );

  await redeemPromo(store, user, "PRO30", NOW);

  const upgraded = await store.getUserById(user.id);
  assert.equal(upgraded?.plan, "pro");
  assert.equal(upgraded?.planExpiresAt, NOW + 30 * 24 * 60 * 60 * 1000);

  // Still inside the window: the tier holds and no free allowance is added.
  const during = await ensurePlanCredits(store, upgraded!, NOW + 24 * 60 * 60 * 1000);
  assert.equal(during.plan, "pro");
  assert.equal(during.credits, 100 + 5_000);

  // After the window the tier drops to free and the free allowance is granted.
  const after = await ensurePlanCredits(store, upgraded!, NOW + 31 * 24 * 60 * 60 * 1000);
  assert.equal(after.plan, "free");
  assert.equal(after.planExpiresAt, null);
  assert.equal(after.credits, 100 + 5_000 + 100);
});

test("promo: a checkout discount is only counted once the payment completed", async () => {
  const { store, user } = await seedStore();
  await store.createPromoCode(
    promo({ code: "SAVE25", kind: "discount", credits: 0, percentOff: 25, maxPerUser: 1 }),
  );

  // Resolving it at checkout does not consume the code yet.
  const resolved = await resolveCheckoutPromo(store, user, "SAVE25", NOW);
  assert.equal(resolved.code, "SAVE25");
  assert.equal(await store.countPromoRedemptions(resolved.id, user.id), 0);

  await recordCheckoutRedemption(store, user.id, "SAVE25", NOW);
  assert.equal(await store.countPromoRedemptions(resolved.id, user.id), 1);

  // The webhook and the browser return both fire — the cap is consumed once.
  await recordCheckoutRedemption(store, user.id, "SAVE25", NOW);
  assert.equal(await store.countPromoRedemptions(resolved.id, user.id), 1);

  // The account can no longer use it.
  await assert.rejects(
    () => resolveCheckoutPromo(store, user, "SAVE25", NOW),
    (err: unknown) => err instanceof AppError && /already used/i.test(err.safe),
  );
});

/** Route behaviour: the router mounted in app.ts, driven over real HTTP. */

type Harness = {
  server: Server;
  url: string;
  store: MemoryAuthStore;
  user: UserRecord;
  request: (
    method: string,
    path: string,
    opts?: { userId?: string; body?: unknown },
  ) => Promise<{ status: number; body: any }>;
};

async function startHarness(): Promise<Harness> {
  const store = new MemoryAuthStore();
  await store.init();
  const user = await store.createUser("promo@example.com", "hash");

  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    const userId = req.header("x-test-user");
    if (userId) (req as Request & { authUser?: { id: string } }).authUser = { id: userId };
    next();
  });
  app.use("/api/promo", promoRoutes(store));
  app.use((_req, res) => res.status(404).json({ error: "Not found." }));
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof AppError) {
      res.status(err.status).json({ error: err.safe });
      return;
    }
    res.status(500).json({ error: "boom" });
  });

  const server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  const { port } = server.address() as AddressInfo;
  const url = `http://127.0.0.1:${port}`;

  return {
    server,
    url,
    store,
    user,
    request: async (method, path, opts = {}) => {
      const res = await fetch(`${url}/api/promo${path}`, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(opts.userId ? { "x-test-user": opts.userId } : {}),
        },
        body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      });
      const text = await res.text();
      return { status: res.status, body: text ? JSON.parse(text) : undefined };
    },
  };
}

test("promo route: redeeming requires a signed-in account", async () => {
  const h = await startHarness();
  try {
    const res = await h.request("POST", "/redeem", { body: { code: "LAUNCH500" } });
    assert.equal(res.status, 401);
  } finally {
    await new Promise((r) => h.server.close(r));
  }
});

test("promo route: redeeming a code credits the account", async () => {
  const h = await startHarness();
  try {
    await h.store.createPromoCode(promo({ code: "LAUNCH500", credits: 250 }));
    const res = await h.request("POST", "/redeem", {
      userId: h.user.id,
      body: { code: "launch500" },
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
    assert.equal(res.body.creditsGranted, 250);

    const fresh = await h.store.getUserById(h.user.id);
    assert.equal(fresh?.credits, 100 + 250);
  } finally {
    await new Promise((r) => h.server.close(r));
  }
});

test("promo route: a missing code is rejected", async () => {
  const h = await startHarness();
  try {
    const res = await h.request("POST", "/redeem", { userId: h.user.id, body: {} });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /Enter a promo code/i);
  } finally {
    await new Promise((r) => h.server.close(r));
  }
});

test("promo route: validate previews without granting", async () => {
  const h = await startHarness();
  try {
    await h.store.createPromoCode(promo({ code: "LAUNCH500", credits: 250 }));
    const res = await h.request("POST", "/validate", {
      userId: h.user.id,
      body: { code: "LAUNCH500" },
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.valid, true);
    assert.equal(res.body.redemption.creditsGranted, 250);

    const fresh = await h.store.getUserById(h.user.id);
    assert.equal(fresh?.credits, 100);
  } finally {
    await new Promise((r) => h.server.close(r));
  }
});

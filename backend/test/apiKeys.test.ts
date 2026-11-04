import test from "node:test";
import assert from "node:assert/strict";
import type { Request } from "express";

import { MemoryAuthStore } from "../src/auth/MemoryAuthStore.js";
import {
  API_KEY_PREFIX,
  generateApiKey,
  looksLikeApiKey,
} from "../src/auth/apiKeys.js";
import { hashSessionToken } from "../src/auth/session.js";
import { toPublicApiKey, type ApiKeyRecord } from "../src/auth/AuthStore.js";
import { requireAdmin, requireAuth, resolveAuth } from "../src/middleware/requireAuth.js";

const DAY_MS = 24 * 60 * 60 * 1000;

function bearer(token: string): Request {
  return { headers: { authorization: `Bearer ${token}` } } as unknown as Request;
}

function keyFor(userId: string, overrides: Partial<ApiKeyRecord> = {}): ApiKeyRecord {
  const generated = generateApiKey();
  return {
    id: crypto.randomUUID(),
    userId,
    name: "test key",
    prefix: generated.displayPrefix,
    tokenHash: generated.tokenHash,
    createdAt: Date.now(),
    lastUsedAt: null,
    expiresAt: null,
    ...overrides,
  };
}

test("generateApiKey: well-formed, unique and only persisted as a hash", () => {
  const first = generateApiKey();
  const second = generateApiKey();

  assert.ok(first.token.startsWith(API_KEY_PREFIX));
  assert.match(first.token, /^ptk_[A-Za-z0-9_-]{43}$/);
  assert.equal(first.tokenHash, hashSessionToken(first.token));
  assert.notEqual(first.tokenHash, first.token);
  assert.equal(first.displayPrefix, first.token.slice(0, 12));

  assert.notEqual(first.token, second.token);
  assert.notEqual(first.tokenHash, second.tokenHash);
});

test("looksLikeApiKey: only personal keys, never the shared secret shape", () => {
  assert.equal(looksLikeApiKey(`ptk_${"a".repeat(43)}`), true);
  assert.equal(looksLikeApiKey("deadbeef-cafe-4000-8000-0123456789ab"), false);
  assert.equal(looksLikeApiKey(""), false);
});

test("memory store: API key lifecycle", async () => {
  const store = new MemoryAuthStore();
  const owner = await store.createUser("keys@example.com", "hash");
  const other = await store.createUser("other@example.com", "hash");

  const record = keyFor(owner.id, { expiresAt: Date.now() + DAY_MS });
  await store.createApiKey(record);

  const listed = await store.listApiKeysForUser(owner.id);
  assert.equal(listed.length, 1);
  assert.equal(toPublicApiKey(record).id, record.id);
  assert.ok(!("tokenHash" in toPublicApiKey(record)), "the hash never leaves the API");

  const found = await store.getApiKeyByHash(record.tokenHash);
  assert.ok(found);
  assert.equal(found.userId, owner.id);
  assert.equal(
    await store.getApiKeyByHash(record.tokenHash, Date.now() + 2 * DAY_MS),
    null,
    "gone after expiry",
  );

  const marked = Date.now() - 1000;
  await store.touchApiKey(record.id, marked);
  assert.equal((await store.getApiKeyByHash(record.tokenHash))?.lastUsedAt, marked);

  assert.equal(await store.deleteApiKey(record.id, other.id), false, "scoped to the owner");
  assert.equal(await store.deleteApiKey(record.id, owner.id), true);
  assert.equal((await store.listApiKeysForUser(owner.id)).length, 0);
});

test("memory store: expired keys are rejected and users are isolated", async () => {
  const store = new MemoryAuthStore();
  const alice = await store.createUser("alice@example.com", "hash");
  const bob = await store.createUser("bob@example.com", "hash");

  const live = keyFor(alice.id);
  const expired = keyFor(alice.id, { expiresAt: Date.now() - 60_000 });
  await store.createApiKey(live);
  await store.createApiKey(expired);

  assert.ok(await store.getApiKeyByHash(live.tokenHash));
  assert.equal(await store.getApiKeyByHash(expired.tokenHash), null);
  assert.equal((await store.listApiKeysForUser(alice.id)).length, 2);
  assert.equal((await store.listApiKeysForUser(bob.id)).length, 0);

  await store.deleteApiKeysForUser(alice.id);
  assert.equal((await store.listApiKeysForUser(alice.id)).length, 0);
});

test("resolveAuth: authenticates a caller presenting a personal API key", async () => {
  const store = new MemoryAuthStore();
  const user = await store.createUser("api@example.com", "hash");
  const generated = generateApiKey();
  await store.createApiKey(keyFor(user.id, { tokenHash: generated.tokenHash }));

  const resolved = await resolveAuth(bearer(generated.token), store);
  assert.ok(resolved);
  assert.equal(resolved.user.id, user.id);
  // API keys are long-lived credentials: no access-token expiry is derived.
  assert.equal(resolved.expiresAt, null);

  const stamped = await store.getApiKeyByHash(generated.tokenHash);
  assert.ok(stamped?.lastUsedAt, "usage is stamped on authentication");

  assert.equal(await resolveAuth(bearer(generateApiKey().token), store), null);
  assert.equal(await resolveAuth({ headers: {} } as unknown as Request, store), null);
  // Shared API_KEYS secrets are not personal keys: resolveAuth ignores them.
  assert.equal(await resolveAuth(bearer("some-shared-secret"), store), null);
});

test("security: requireAdmin strictly rejects personal API keys (mitigating key leaks)", async () => {
  const store = new MemoryAuthStore();
  const admin = await store.createUser("superadmin@example.com", "hash", "admin");
  const generated = generateApiKey();
  await store.createApiKey(keyFor(admin.id, { tokenHash: generated.tokenHash }));

  const middleware = requireAdmin(store);
  const req = bearer(generated.token);
  let errorCaught: Error | null = null;
  await middleware(req, {} as never, (err?: unknown) => {
    if (err instanceof Error) errorCaught = err;
  });

  assert.ok(errorCaught, "API key should be rejected by requireAdmin");
  assert.match((errorCaught as Error).message, /API keys cannot be used to access administrative endpoints/);
});

test("security: banned or suspended users are rejected by requireAuth", async () => {
  const store = new MemoryAuthStore();
  const user = await store.createUser("baduser@example.com", "hash", "user");
  await store.updateUserAccount(user.id, { status: "banned", banReason: "Terms violation" });

  const generated = generateApiKey();
  await store.createApiKey(keyFor(user.id, { tokenHash: generated.tokenHash }));

  const middleware = requireAuth(store);
  const req = bearer(generated.token);
  let errorCaught: Error | null = null;
  await middleware(req, {} as never, (err?: unknown) => {
    if (err instanceof Error) errorCaught = err;
  });

  assert.ok(errorCaught, "Banned user must be rejected by requireAuth");
  assert.match((errorCaught as Error).message, /banned: Terms violation/);
});

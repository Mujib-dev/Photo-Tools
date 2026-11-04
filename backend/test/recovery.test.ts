import test from "node:test";
import assert from "node:assert/strict";

import { MemoryAuthStore } from "../src/auth/MemoryAuthStore.js";
import { verifyGoogleIdToken } from "../src/auth/google.js";
import { hashSessionToken } from "../src/auth/session.js";
import { AppError } from "../src/utils/errors.js";

/** base64url-encode a JSON object, as it appears in a JWT segment. */
function segment(value: object): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

const isBadCredential = (err: unknown): boolean =>
  err instanceof AppError && err.status === 400;

test("memory store: password-reset lifecycle", async () => {
  const store = new MemoryAuthStore();
  const user = await store.createUser("alice@example.com", "hash", "user", "Alice", "+15550001111");
  const tokenHash = hashSessionToken("123456");

  await store.createPasswordReset(tokenHash, user.id, Date.now() + 60_000);
  const found = await store.getPasswordResetUser(tokenHash);
  assert.equal(found?.id, user.id);

  await store.deletePasswordReset(tokenHash);
  assert.equal(await store.getPasswordResetUser(tokenHash), null);
});

test("memory store: expired password resets are rejected", async () => {
  const store = new MemoryAuthStore();
  const user = await store.createUser("bob@example.com", "hash");
  const tokenHash = hashSessionToken("000000");

  await store.createPasswordReset(tokenHash, user.id, Date.now() - 1);
  assert.equal(await store.getPasswordResetUser(tokenHash), null);
});

test("memory store: a new reset supersedes the user's previous one", async () => {
  const store = new MemoryAuthStore();
  const user = await store.createUser("carol@example.com", "hash");
  const first = hashSessionToken("111111");
  const second = hashSessionToken("222222");

  await store.createPasswordReset(first, user.id, Date.now() + 60_000);
  await store.createPasswordReset(second, user.id, Date.now() + 60_000);
  assert.equal(await store.getPasswordResetUser(first), null);
  assert.ok(await store.getPasswordResetUser(second));

  await store.deletePasswordResetsForUser(user.id);
  assert.equal(await store.getPasswordResetUser(second), null);
});

test("memory store: listUsersByPhone matches only the exact number", async () => {
  const store = new MemoryAuthStore();
  await store.createUser("p1@example.com", "hash", "user", "One", "+15550000001");
  await store.createUser("p2@example.com", "hash", "user", "Two", "+15550000002");
  await store.createUser("p3@example.com", "hash", "user", "Three", "+15550000001");

  const matches = await store.listUsersByPhone("+15550000001");
  assert.deepEqual(
    matches.map((u) => u.email).sort(),
    ["p1@example.com", "p3@example.com"],
  );
  assert.deepEqual(await store.listUsersByPhone("+19999999999"), []);
});

test("session token hashing is deterministic and input-sensitive", () => {
  assert.equal(hashSessionToken("123456"), hashSessionToken("123456"));
  assert.notEqual(hashSessionToken("123456"), hashSessionToken("654321"));
});

test("google verification rejects malformed credentials without a network call", async () => {
  await assert.rejects(() => verifyGoogleIdToken("not-a-jwt"), isBadCredential);
  await assert.rejects(() => verifyGoogleIdToken("a.b.c"), isBadCredential);
});

test("google verification rejects non-RS256 algorithms", async () => {
  const token = `${segment({ alg: "HS256", kid: "abc" })}.${segment({ sub: "1", email: "a@b.com" })}.sig`;
  await assert.rejects(() => verifyGoogleIdToken(token), isBadCredential);
});

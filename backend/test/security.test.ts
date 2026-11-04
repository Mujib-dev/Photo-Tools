import test from "node:test";
import assert from "node:assert/strict";

import { checkPassword } from "../src/security/passwordPolicy.js";
import {
  hasForbiddenKey,
  isAllowedOrigin,
  isSupportedContentType,
  isUnsafeMethod,
  originOf,
  requestOrigin,
} from "../src/middleware/security.js";
import { signAccessToken, signRefreshToken, verifyAccessToken, verifyRefreshToken } from "../src/auth/jwt.js";

test("password policy rejects short, common and low-complexity passwords", () => {
  assert.equal(checkPassword("short").ok, false);
  assert.equal(checkPassword("password123").ok, false);
  assert.equal(checkPassword("abcdefgh").ok, false);
  assert.equal(checkPassword("12345678").ok, false);
  assert.equal(checkPassword("Str0ng-enough-pass").ok, true);
});

test("password policy blocks the email local-part inside the password", () => {
  assert.equal(checkPassword("alicepassword1", "alice@example.com").ok, false);
  assert.equal(checkPassword("unrelated-pass1", "alice@example.com").ok, true);
});

test("hasForbiddenKey detects prototype-polluting keys at any depth", () => {
  assert.equal(hasForbiddenKey({ a: 1, b: { c: "ok" } }), false);
  assert.equal(hasForbiddenKey(JSON.parse('{"__proto__":{"polluted":true}}')), true);
  assert.equal(hasForbiddenKey({ list: [{ constructor: {} }] }), true);
  assert.equal(hasForbiddenKey(JSON.parse('{"a":{"prototype":{"x":1}}}')), true);
  assert.equal(hasForbiddenKey(null), false);
});

test("origin helpers normalise and compare origins", () => {
  assert.equal(originOf("http://localhost:3000/path?x=1"), "http://localhost:3000");
  assert.equal(originOf("not a url"), null);
  assert.equal(originOf(null), null);

  const allowed = ["http://localhost:3000", "https://app.example.com"];
  assert.equal(isAllowedOrigin("http://localhost:3000", allowed), true);
  assert.equal(isAllowedOrigin("http://localhost:3000/deep/path", allowed), true);
  assert.equal(isAllowedOrigin("https://app.example.com", allowed), true);
  assert.equal(isAllowedOrigin("http://localhost:3001", allowed), false);
  assert.equal(isAllowedOrigin("https://evil.example.com", allowed), false);
  assert.equal(isAllowedOrigin(null, allowed), false);
});

test("requestOrigin resolves the origin a proxied request was addressed to", () => {
  const req = {
    headers: {
      host: "localhost:4000",
      "x-forwarded-host": "192.168.1.20:3000",
      "x-forwarded-proto": "http",
    },
    protocol: "http",
  };
  assert.equal(requestOrigin(req as never), "http://192.168.1.20:3000");
});

test("content-type and method helpers classify requests", () => {
  assert.equal(isSupportedContentType("application/json; charset=utf-8"), true);
  assert.equal(isSupportedContentType("multipart/form-data; boundary=x"), true);
  assert.equal(isSupportedContentType("text/plain"), false);
  assert.equal(isSupportedContentType(undefined), false);

  assert.equal(isUnsafeMethod("GET"), false);
  assert.equal(isUnsafeMethod("options"), false);
  assert.equal(isUnsafeMethod("POST"), true);
  assert.equal(isUnsafeMethod("delete"), true);
});

test("access tokens verify, reject tampering and refuse refresh tokens", () => {
  const user = { id: "user-1", email: "user@example.com" };
  const { token } = signAccessToken(user, 60_000);
  const claims = verifyAccessToken(token);
  assert.ok(claims);
  assert.equal(claims.sub, "user-1");
  assert.equal(claims.email, "user@example.com");

  const tampered = token.slice(0, -2) + (token.endsWith("aa") ? "bb" : "aa");
  assert.equal(verifyAccessToken(tampered), null);

  const refresh = signRefreshToken("user-1", 60_000);
  assert.equal(verifyAccessToken(refresh.token), null);
});

test("expired tokens are rejected", () => {
  const { token } = signAccessToken({ id: "u", email: "u@example.com" }, 1);
  assert.equal(verifyAccessToken(token), null);
});

test("refresh tokens verify with their jti and refuse access tokens", () => {
  const refresh = signRefreshToken("user-9", 60_000);
  const claims = verifyRefreshToken(refresh.token);
  assert.ok(claims);
  assert.equal(claims.sub, "user-9");
  assert.equal(claims.jti, refresh.jti);

  const access = signAccessToken({ id: "user-9", email: "u@example.com" }, 60_000);
  assert.equal(verifyRefreshToken(access.token), null);
});

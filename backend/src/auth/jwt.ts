import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

import { config } from "../config.js";

/**
 * Minimal dependency-free HS256 JWT implementation for access + refresh
 * tokens. Access tokens carry the user identity for a short window; refresh
 * tokens carry a `jti` that is stored hashed server-side so every refresh can
 * be rotated and any single token revoked.
 */

export interface AccessClaims {
  sub: string;
  email: string;
  typ: "access";
  iat: number;
  exp: number;
}

export interface RefreshClaims {
  sub: string;
  jti: string;
  typ: "refresh";
  iat: number;
  exp: number;
}

function base64UrlEncode(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function hmac(data: string): string {
  return createHmac("sha256", config.jwtSecret).update(data).digest("base64url");
}

function sign(payload: Record<string, unknown>): string {
  const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64UrlEncode(JSON.stringify(payload));
  const data = `${header}.${body}`;
  return `${data}.${hmac(data)}`;
}

function verifySignature(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, body, signature] = parts;
  const expected = hmac(`${header}.${body}`);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    // The header is validated too — only HS256 tokens we minted are accepted.
    const headerClaim = JSON.parse(Buffer.from(header, "base64url").toString("utf8")) as {
      alg?: unknown;
      typ?: unknown;
    };
    if (headerClaim.alg !== "HS256" || headerClaim.typ !== "JWT") return null;
    return JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function isExpired(claims: Record<string, unknown>, now: number): boolean {
  const exp = typeof claims.exp === "number" ? claims.exp : 0;
  return exp * 1000 <= now;
}

/** Sign a short-lived access token for a user. */
export function signAccessToken(
  user: { id: string; email: string },
  ttlMs: number,
): { token: string; expiresAt: number } {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + Math.floor(ttlMs / 1000);
  const token = sign({ sub: user.id, email: user.email, typ: "access", iat: now, exp });
  return { token, expiresAt: exp * 1000 };
}

/** Verify an access token's signature, type and expiry. */
export function verifyAccessToken(token: string): AccessClaims | null {
  const claims = verifySignature(token);
  if (!claims || claims.typ !== "access" || isExpired(claims, Date.now())) return null;
  if (typeof claims.sub !== "string" || typeof claims.email !== "string") return null;
  if (typeof claims.iat !== "number" || typeof claims.exp !== "number") return null;
  return claims as unknown as AccessClaims;
}

/** Sign a long-lived refresh token with a fresh `jti` for server-side tracking. */
export function signRefreshToken(userId: string, ttlMs: number): {
  token: string;
  jti: string;
  expiresAt: number;
} {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + Math.floor(ttlMs / 1000);
  const jti = randomUUID();
  const token = sign({ sub: userId, jti, typ: "refresh", iat: now, exp });
  return { token, jti, expiresAt: exp * 1000 };
}

/** Verify a refresh token's signature, type and expiry. */
export function verifyRefreshToken(token: string): RefreshClaims | null {
  const claims = verifySignature(token);
  if (!claims || claims.typ !== "refresh" || isExpired(claims, Date.now())) return null;
  if (typeof claims.sub !== "string" || typeof claims.jti !== "string") return null;
  if (typeof claims.iat !== "number" || typeof claims.exp !== "number") return null;
  return claims as unknown as RefreshClaims;
}

export interface SudoClaims {
  sub: string;
  typ: "sudo";
  iat: number;
  exp: number;
}

/** Mint a short-lived sudo authorization token for high-risk administrator actions. */
export function signSudoToken(
  userId: string,
  ttlMs = 15 * 60 * 1000,
): { token: string; expiresAt: number } {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + Math.floor(ttlMs / 1000);
  const token = sign({ sub: userId, typ: "sudo", iat: now, exp });
  return { token, expiresAt: exp * 1000 };
}

/** Verify a sudo token's cryptographic signature, type, expiry and actor identity. */
export function verifySudoToken(token: string, expectedUserId: string): boolean {
  if (!token || typeof token !== "string") return false;
  const claims = verifySignature(token);
  if (!claims || claims.typ !== "sudo" || isExpired(claims, Date.now())) return false;
  if (claims.sub !== expectedUserId) return false;
  return true;
}

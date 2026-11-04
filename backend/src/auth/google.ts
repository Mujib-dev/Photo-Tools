import { createPublicKey, createVerify, type JsonWebKey } from "node:crypto";

import { config } from "../config.js";
import { AppError } from "../utils/errors.js";

/**
 * Dependency-free verification of Google ID tokens (the `credential` returned
 * by Google Identity Services). We fetch Google's rotating JWKS, verify the
 * RS256 signature with node:crypto and check the audience, issuer and expiry.
 * The JWKS response is cached for as long as its Cache-Control allows (capped).
 */

const JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const ISSUERS = new Set(["accounts.google.com", "https://accounts.google.com"]);
const MAX_CACHE_SECONDS = 3600;

export interface GoogleClaims {
  sub: string;
  email: string;
  email_verified?: boolean | string;
  name?: string;
  aud: string;
  iss: string;
  exp: number;
}

let cache: { keys: Map<string, JsonWebKey>; expiresAt: number } | null = null;

type GoogleJwk = JsonWebKey & { kid: string };

async function jwks(): Promise<Map<string, JsonWebKey>> {
  if (cache && cache.expiresAt > Date.now()) return cache.keys;
  const res = await fetch(JWKS_URL);
  if (!res.ok) throw new AppError(503, "Could not verify the Google sign-in. Please try again.");
  const body = (await res.json()) as { keys?: GoogleJwk[] };
  const maxAge = Number(/max-age=(\d+)/.exec(res.headers.get("cache-control") ?? "")?.[1] ?? MAX_CACHE_SECONDS);
  const keys = new Map<string, JsonWebKey>();
  for (const key of body.keys ?? []) {
    if (key.kid) keys.set(key.kid, key);
  }
  cache = { keys, expiresAt: Date.now() + Math.min(maxAge, MAX_CACHE_SECONDS) * 1000 };
  return keys;
}

export async function verifyGoogleIdToken(token: string): Promise<GoogleClaims> {
  const parts = token.split(".");
  if (parts.length !== 3) throw new AppError(400, "The Google credential is invalid.");
  const [headerB64, payloadB64, signatureB64] = parts;

  let header: { alg?: string; kid?: string };
  try {
    header = JSON.parse(Buffer.from(headerB64, "base64url").toString("utf8")) as typeof header;
  } catch {
    throw new AppError(400, "The Google credential is invalid.");
  }
  if (header.alg !== "RS256" || !header.kid) throw new AppError(400, "The Google credential is invalid.");

  const jwk = (await jwks()).get(header.kid);
  if (!jwk) throw new AppError(400, "The Google credential is invalid.");

  const key = createPublicKey({ key: jwk, format: "jwk" });
  const verifier = createVerify("RSA-SHA256");
  verifier.update(`${headerB64}.${payloadB64}`);
  verifier.end();
  if (!verifier.verify(key, Buffer.from(signatureB64, "base64url"))) {
    throw new AppError(400, "The Google credential is invalid.");
  }

  const claims = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8")) as GoogleClaims;
  const now = Math.floor(Date.now() / 1000);
  if (typeof claims.exp !== "number" || claims.exp <= now) {
    throw new AppError(400, "The Google sign-in has expired. Please try again.");
  }
  if (!ISSUERS.has(claims.iss)) throw new AppError(400, "The Google credential is invalid.");
  if (!config.googleClientIds.includes(claims.aud)) {
    throw new AppError(400, "The Google credential is invalid.");
  }
  if (!claims.email || (claims.email_verified !== true && claims.email_verified !== "true")) {
    throw new AppError(400, "Your Google account email is not verified.");
  }
  return claims;
}

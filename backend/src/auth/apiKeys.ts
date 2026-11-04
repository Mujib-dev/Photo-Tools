import { randomBytes } from "node:crypto";

import { hashSessionToken } from "./session.js";

/**
 * Personal API keys for programmatic access. A key is shown to its owner once,
 * at creation; only a SHA-256 hash is persisted (the same treatment as session
 * and refresh tokens), so a database leak cannot be replayed against the API.
 *
 * Format: `ptk_<43-char base64url secret>`. The `ptk_` prefix lets the auth
 * layer tell personal keys apart from the optional shared `API_KEYS` secret.
 */

export const API_KEY_PREFIX = "ptk_";
const SECRET_BYTES = 32;
/** Length of the non-secret fragment stored for display, e.g. "ptk_a1b2c3d4". */
const DISPLAY_PREFIX_LENGTH = 12;

export interface GeneratedApiKey {
  /** Full secret — returned to the user once and never stored in plaintext. */
  token: string;
  /** SHA-256 hash of the token, stored in the database. */
  tokenHash: string;
  /** Non-secret leading fragment used to identify the key in listings. */
  displayPrefix: string;
}

export function generateApiKey(): GeneratedApiKey {
  const token = `${API_KEY_PREFIX}${randomBytes(SECRET_BYTES).toString("base64url")}`;
  return {
    token,
    tokenHash: hashSessionToken(token),
    displayPrefix: token.slice(0, DISPLAY_PREFIX_LENGTH),
  };
}

/** True when a bearer token is a personal API key (as opposed to a shared secret). */
export function looksLikeApiKey(token: string): boolean {
  return token.startsWith(API_KEY_PREFIX);
}

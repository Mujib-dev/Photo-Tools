import { randomBytes } from "node:crypto";

/**
 * Referral (invite) codes: short, URL-safe, human-readable. The alphabet drops
 * ambiguous characters (0/O, 1/I/L) so codes survive being typed aloud.
 */

const ALPHABET = "ABCDEFGHJKMNPQRSTVWXYZ23456789";
const CODE_LENGTH = 8;

export function generateReferralCode(): string {
  const bytes = randomBytes(CODE_LENGTH);
  let out = "";
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}

/** Canonical form used for lookups and URLs. */
export function normalizeReferralCode(raw: string): string {
  return raw.trim().toUpperCase();
}

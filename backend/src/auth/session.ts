import { createHash, randomBytes } from "node:crypto";

/** Generate an opaque session token sent to the client (stored hashed in the DB). */
export function generateSessionToken(): string {
  return randomBytes(32).toString("hex");
}

/** Hash a session token before it is stored, so a leaked DB is not a leak of sessions. */
export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

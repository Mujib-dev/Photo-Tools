import { errorFrom, request } from "./auth";
import type { ApiKeyRecord } from "./types";

/**
 * Client for personal API keys. The full secret is returned only by
 * createApiKey — the server stores a hash, so a key can never be re-shown.
 */

let keysCached: { at: number; keys: ApiKeyRecord[] } | null = null;
let keysInFlight: Promise<ApiKeyRecord[]> | null = null;
const KEYS_CACHE_TTL_MS = 60_000;

export async function listApiKeys(): Promise<ApiKeyRecord[]> {
  const res = await request("/api/backend/keys");
  if (!res.ok) throw await errorFrom(res);
  const body = (await res.json()) as { keys: ApiKeyRecord[] };
  keysCached = { at: Date.now(), keys: body.keys };
  return body.keys;
}

export function listApiKeysCached(): Promise<ApiKeyRecord[]> {
  if (keysCached && Date.now() - keysCached.at < KEYS_CACHE_TTL_MS) {
    return Promise.resolve(keysCached.keys);
  }
  if (keysInFlight) return keysInFlight;
  keysInFlight = listApiKeys().finally(() => {
    keysInFlight = null;
  });
  return keysInFlight;
}

/** Create a key. `expiresInDays` of null means it never expires. */
export async function createApiKey(
  name: string,
  expiresInDays: number | null,
): Promise<{ key: ApiKeyRecord; token: string }> {
  const res = await request("/api/backend/keys", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, expiresInDays }),
  });
  if (!res.ok) throw await errorFrom(res);
  return (await res.json()) as { key: ApiKeyRecord; token: string };
}

export async function revokeApiKey(id: string): Promise<void> {
  const res = await request(`/api/backend/keys/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!res.ok) throw await errorFrom(res);
}

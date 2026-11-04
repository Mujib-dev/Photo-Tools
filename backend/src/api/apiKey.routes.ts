import { randomUUID } from "node:crypto";
import { Router, type Request, type Response } from "express";

import { generateApiKey } from "../auth/apiKeys.js";
import { toPublicApiKey, type ApiKeyRecord, type AuthStore } from "../auth/AuthStore.js";
import { resolveAuth } from "../middleware/requireAuth.js";
import { AppError, Errors } from "../utils/errors.js";

/**
 * Personal API keys: create, list and revoke credentials used to call the API
 * from scripts or other software. Only the SHA-256 hash of a key is stored, so
 * the full secret is returned exactly once — at creation — and cannot be
 * recovered afterwards.
 */

const MAX_KEYS_PER_USER = 25;
const MAX_NAME_LENGTH = 60;
const MIN_EXPIRY_DAYS = 1;
const MAX_EXPIRY_DAYS = 3650;
const DAY_MS = 24 * 60 * 60 * 1000;

function normalizeName(raw: unknown): string {
  if (typeof raw !== "string" || !raw.trim()) return "API key";
  return raw.trim().replace(/\s+/g, " ").slice(0, MAX_NAME_LENGTH);
}

function parseExpiryDays(raw: unknown): number | null {
  if (raw === undefined || raw === null || raw === "") return null;
  const days = Number(raw);
  if (!Number.isFinite(days) || days % 1 !== 0) {
    throw new AppError(400, "Expiry must be a whole number of days.");
  }
  if (days < MIN_EXPIRY_DAYS || days > MAX_EXPIRY_DAYS) {
    throw new AppError(400, `Choose an expiry between ${MIN_EXPIRY_DAYS} and ${MAX_EXPIRY_DAYS} days.`);
  }
  return days;
}

async function requireUser(req: Request, authStore: AuthStore) {
  const resolved = await resolveAuth(req, authStore);
  if (!resolved) throw Errors.unauthorized();
  return resolved.user;
}

export function apiKeyRoutes(authStore: AuthStore): Router {
  const router = Router();

  router.use((_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });

  router.get("/", async (req: Request, res: Response, next) => {
    try {
      const user = await requireUser(req, authStore);
      const keys = await authStore.listApiKeysForUser(user.id);
      res.json({ keys: keys.map(toPublicApiKey) });
    } catch (err) {
      next(err);
    }
  });

  router.post("/", async (req: Request, res: Response, next) => {
    try {
      const user = await requireUser(req, authStore);
      const body = (req.body ?? {}) as { name?: unknown; expiresInDays?: unknown };

      const existing = await authStore.listApiKeysForUser(user.id);
      if (existing.length >= MAX_KEYS_PER_USER) {
        throw new AppError(409, `You already have ${MAX_KEYS_PER_USER} API keys. Revoke one before creating another.`);
      }
      const days = parseExpiryDays(body.expiresInDays);
      const generated = generateApiKey();
      const record: ApiKeyRecord = {
        id: randomUUID(),
        userId: user.id,
        name: normalizeName(body.name),
        prefix: generated.displayPrefix,
        tokenHash: generated.tokenHash,
        createdAt: Date.now(),
        lastUsedAt: null,
        expiresAt: days === null ? null : Date.now() + days * DAY_MS,
      };
      await authStore.createApiKey(record);

      res.status(201).json({
        // The full secret is only available in this response; the server keeps
        // a hash and cannot show it again.
        token: generated.token,
        key: toPublicApiKey(record),
      });
    } catch (err) {
      next(err);
    }
  });

  router.delete("/:id", async (req: Request, res: Response, next) => {
    try {
      const user = await requireUser(req, authStore);
      const removed = await authStore.deleteApiKey(req.params.id, user.id);
      if (!removed) throw Errors.apiKeyNotFound();
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

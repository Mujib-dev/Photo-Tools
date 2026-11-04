import { randomUUID } from "node:crypto";
import { Router, type Request, type Response } from "express";

import type { AuthStore, PresetRecord } from "../auth/AuthStore.js";
import { hasForbiddenKey } from "../middleware/security.js";
import { AppError, Errors } from "../utils/errors.js";

/**
 * Saved tool-settings presets. Each preset belongs to one signed-in user and
 * one operation ("resize", "convert", …); saving under an existing name for
 * that operation replaces it. Settings are stored as a JSON blob — the server
 * treats it as opaque and never executes it.
 */

const MAX_PRESETS_PER_USER = 50;
const MAX_NAME_LENGTH = 40;
const MAX_SETTINGS_BYTES = 8 * 1024;
const OPERATION_RE = /^[a-z][a-z0-9-]{0,39}$/;

function requireUserId(req: Request): string {
  const userId = req.authUser?.id;
  if (!userId) throw Errors.unauthorized();
  return userId;
}

function normalizeName(raw: unknown): string {
  if (typeof raw !== "string" || !raw.trim()) {
    throw new AppError(400, "Give the preset a name.");
  }
  const name = raw.trim().replace(/\s+/g, " ").slice(0, MAX_NAME_LENGTH);
  if (!name) throw new AppError(400, "Give the preset a name.");
  return name;
}

function normalizeOperation(raw: unknown): string {
  if (typeof raw !== "string" || !OPERATION_RE.test(raw)) {
    throw new AppError(400, "Unknown tool operation for this preset.");
  }
  return raw;
}

function normalizeSettings(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new AppError(400, "Preset settings must be an object.");
  }
  if (hasForbiddenKey(raw)) {
    throw new AppError(400, "Preset settings contain disallowed keys.");
  }
  const json = JSON.stringify(raw);
  if (json.length > MAX_SETTINGS_BYTES) {
    throw new AppError(400, "Preset settings are too large (max 8 KB).");
  }
  return JSON.parse(json) as Record<string, unknown>;
}

export function presetRoutes(authStore: AuthStore): Router {
  const router = Router();

  router.use((_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });

  router.get("/", async (req: Request, res: Response, next) => {
    try {
      const userId = requireUserId(req);
      const operationRaw = req.query.operation;
      const operation =
        typeof operationRaw === "string" && OPERATION_RE.test(operationRaw) ? operationRaw : undefined;
      const presets = await authStore.listPresets(userId, operation);
      res.json({ presets });
    } catch (err) {
      next(err);
    }
  });

  router.post("/", async (req: Request, res: Response, next) => {
    try {
      const userId = requireUserId(req);
      const body = (req.body ?? {}) as { operation?: unknown; name?: unknown; settings?: unknown };
      const operation = normalizeOperation(body.operation);
      const name = normalizeName(body.name);
      const settings = normalizeSettings(body.settings);

      const existing = await authStore.listPresets(userId);
      const sameName = existing.find(
        (p) => p.operation === operation && p.name.toLowerCase() === name.toLowerCase(),
      );
      if (!sameName && existing.length >= MAX_PRESETS_PER_USER) {
        throw new AppError(
          409,
          `You already have ${MAX_PRESETS_PER_USER} presets. Delete one before saving another.`,
        );
      }

      const now = Date.now();
      if (sameName) {
        // Same name for the same tool → replace the stored settings.
        await authStore.deletePreset(sameName.id, userId);
      }
      const record: PresetRecord = {
        id: sameName?.id ?? randomUUID(),
        userId,
        operation,
        name,
        settings,
        createdAt: sameName?.createdAt ?? now,
        updatedAt: now,
      };
      await authStore.createPreset(record);
      res.status(sameName ? 200 : 201).json({ preset: record });
    } catch (err) {
      next(err);
    }
  });

  router.delete("/:id", async (req: Request, res: Response, next) => {
    try {
      const userId = requireUserId(req);
      const removed = await authStore.deletePreset(req.params.id, userId);
      if (!removed) {
        res.status(404).json({ error: "Preset not found." });
        return;
      }
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

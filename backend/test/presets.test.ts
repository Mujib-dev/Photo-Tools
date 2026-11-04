import test from "node:test";
import assert from "node:assert/strict";
import express, { type NextFunction, type Request, type Response } from "express";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";

import { MemoryAuthStore } from "../src/auth/MemoryAuthStore.js";
import type { PresetRecord } from "../src/auth/AuthStore.js";
import { presetRoutes } from "../src/api/preset.routes.js";
import { AppError } from "../src/utils/errors.js";

/** Preset store lifecycle (Memory), mirroring apiKeys.test.ts. */

function presetFor(userId: string, overrides: Partial<PresetRecord> = {}): PresetRecord {
  return {
    id: crypto.randomUUID(),
    userId,
    operation: "resize",
    name: "social square",
    settings: { width: 1080, height: 1080, format: "webp" },
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

test("memory store: preset lifecycle", async () => {
  const store = new MemoryAuthStore();
  const owner = await store.createUser("presets@example.com", "hash");
  const other = await store.createUser("other@example.com", "hash");

  const record = presetFor(owner.id);
  await store.createPreset(record);

  const all = await store.listPresets(owner.id);
  assert.equal(all.length, 1);
  assert.equal(all[0]?.name, "social square");
  assert.deepEqual(all[0]?.settings, { width: 1080, height: 1080, format: "webp" });

  await store.createPreset(presetFor(owner.id, { operation: "convert", name: "png out" }));
  assert.equal((await store.listPresets(owner.id)).length, 2);
  assert.equal((await store.listPresets(owner.id, "convert")).length, 1);
  assert.equal((await store.listPresets(owner.id, "resize"))[0]?.name, "social square");
  assert.equal((await store.listPresets(owner.id, "watermark")).length, 0);

  // Presets are per-user: another account sees none and can't delete them.
  assert.equal((await store.listPresets(other.id)).length, 0);
  assert.equal(await store.deletePreset(record.id, other.id), false);
  assert.equal(await store.deletePreset(record.id, owner.id), true);
  assert.equal((await store.listPresets(owner.id)).length, 1);

  await store.deletePresetsForUser(owner.id);
  assert.equal((await store.listPresets(owner.id)).length, 0);
});

test("memory store: re-saving an upserted preset replaces it in place", async () => {
  const store = new MemoryAuthStore();
  const owner = await store.createUser("upsert@example.com", "hash");

  const first = presetFor(owner.id, { settings: { width: 512 } });
  await store.createPreset(first);
  await store.deletePreset(first.id, owner.id);

  const second = presetFor(owner.id, { id: first.id, settings: { width: 2048 }, createdAt: first.createdAt });
  await store.createPreset(second);

  const listed = await store.listPresets(owner.id);
  assert.equal(listed.length, 1);
  assert.equal(listed[0]?.id, first.id);
  assert.deepEqual(listed[0]?.settings, { width: 2048 });
});

/** Route behaviour: the router mounted in app.ts, driven over real HTTP. */

type Harness = {
  server: Server;
  url: string;
  store: MemoryAuthStore;
  request: (
    method: string,
    path: string,
    opts?: { userId?: string; body?: unknown },
  ) => Promise<{ status: number; body: any }>;
};

async function startHarness(): Promise<Harness> {
  const store = new MemoryAuthStore();
  const app = express();
  app.use(express.json());
  // Stand-in for requireAuth: the caller is identified by a test-only header.
  app.use((req, _res, next) => {
    const userId = req.header("x-test-user");
    if (userId) (req as Request & { authUser?: { id: string } }).authUser = { id: userId };
    next();
  });
  app.use("/api/presets", presetRoutes(store));
  app.use((_req, res) => res.status(404).json({ error: "Not found." }));
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof AppError) {
      res.status(err.status).json({ error: err.safe });
      return;
    }
    res.status(500).json({ error: "boom" });
  });

  const server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  const { port } = server.address() as AddressInfo;
  const url = `http://127.0.0.1:${port}`;

  return {
    server,
    url,
    store,
    request: async (method, path, opts = {}) => {
      const res = await fetch(`${url}/api/presets${path}`, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(opts.userId ? { "x-test-user": opts.userId } : {}),
        },
        body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      });
      const text = await res.text();
      return { status: res.status, body: text ? JSON.parse(text) : undefined };
    },
  };
}

test("preset routes: create, replace by name, list filter, delete", async () => {
  const h = await startHarness();
  try {
    const alice = (await h.store.createUser("alice@example.com", "hash")).id;
    const bob = (await h.store.createUser("bob@example.com", "hash")).id;

    const created = await h.request("POST", "/", {
      userId: alice,
      body: { operation: "resize", name: "  Social   Square  ", settings: { width: 1080 } },
    });
    assert.equal(created.status, 201);
    assert.equal(created.body.preset.name, "Social Square", "whitespace collapses + trims");
    const id = created.body.preset.id as string;

    // Same name + operation → replace (200, same id).
    const replaced = await h.request("POST", "/", {
      userId: alice,
      body: { operation: "resize", name: "Social Square", settings: { width: 2048 } },
    });
    assert.equal(replaced.status, 200);
    assert.equal(replaced.body.preset.id, id);
    assert.equal(replaced.body.preset.settings.width, 2048);
    assert.equal((await h.request("GET", "/", { userId: alice })).body.presets.length, 1);

    // Same name, different operation → distinct preset.
    const otherOp = await h.request("POST", "/", {
      userId: alice,
      body: { operation: "convert", name: "Social Square", settings: { format: "png" } },
    });
    assert.equal(otherOp.status, 201);
    assert.equal((await h.request("GET", "/", { userId: alice })).body.presets.length, 2);
    assert.equal(
      (await h.request("GET", "/?operation=convert", { userId: alice })).body.presets.length,
      1,
    );

    // Delete is owner-scoped: bob gets 404, alice's delete works.
    assert.equal((await h.request("DELETE", `/${id}`, { userId: bob })).status, 404);
    assert.equal((await h.request("DELETE", `/${id}`, { userId: alice })).status, 200);
    assert.equal((await h.request("DELETE", `/${id}`, { userId: alice })).status, 404, "gone");
  } finally {
    await new Promise((r) => h.server.close(r));
  }
});

test("preset routes: validation and per-user cap", async () => {
  const h = await startHarness();
  try {
    const user = (await h.store.createUser("valid@example.com", "hash")).id;
    const anon = undefined;

    assert.equal(
      (await h.request("POST", "/", { userId: anon, body: { operation: "resize", name: "x", settings: {} } })).status,
      401,
      "signed-out callers are rejected",
    );
    assert.equal(
      (await h.request("POST", "/", { userId: user, body: { operation: "resize", name: "  ", settings: {} } })).status,
      400,
      "blank name",
    );
    assert.equal(
      (await h.request("POST", "/", { userId: user, body: { operation: "Resize!", name: "x", settings: {} } })).status,
      400,
      "bad operation",
    );
    assert.equal(
      (await h.request("POST", "/", { userId: user, body: { operation: "resize", name: "x" } })).status,
      400,
      "settings required",
    );
    assert.equal(
      (
        await h.request("POST", "/", {
          userId: user,
          body: {
            operation: "resize",
            name: "evil",
            // JSON.parse creates an own "__proto__" key that would survive
            // JSON.stringify — exactly what hasForbiddenKey must reject.
            settings: JSON.parse('{"__proto__": {"polluted": true}}'),
          },
        })
      ).status,
      400,
      "forbidden keys are rejected",
    );
    assert.equal(
      (
        await h.request("POST", "/", {
          userId: user,
          body: { operation: "resize", name: "huge", settings: { blob: "a".repeat(9 * 1024) } },
        })
      ).status,
      400,
      "oversized settings",
    );

    // 50 distinct presets are fine; the 51st name is refused — but an
    // existing name still upserts instead of hitting the cap.
    for (let i = 0; i < 50; i++) {
      const res = await h.request("POST", "/", {
        userId: user,
        body: { operation: "resize", name: `preset ${i}`, settings: { i } },
      });
      assert.equal(res.status, 201, `preset ${i}`);
    }
    const full = await h.request("POST", "/", {
      userId: user,
      body: { operation: "resize", name: "one too many", settings: {} },
    });
    assert.equal(full.status, 409);
    const upsertAtCap = await h.request("POST", "/", {
      userId: user,
      body: { operation: "resize", name: "preset 0", settings: { i: "replaced" } },
    });
    assert.equal(upsertAtCap.status, 200, "upserting an existing name is allowed at the cap");
  } finally {
    await new Promise((r) => h.server.close(r));
  }
});

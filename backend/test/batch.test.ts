import test from "node:test";
import assert from "node:assert/strict";
import express, { type NextFunction, type Request, type Response } from "express";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";

import type { JobManager } from "../src/jobs/JobManager.js";
import type { JobRecord } from "../src/jobs/JobTypes.js";
import { batchRoutes, applyRenameTemplate } from "../src/api/batch.routes.js";
import { AppError } from "../src/utils/errors.js";

/**
 * Route behaviour for the batch endpoint: validation, auth scoping and the
 * multi-file fan-out, driven over real HTTP with a stubbed JobManager so no
 * queue or processing service is required.
 */

type Harness = {
  server: Server;
  url: string;
  created: {
    operation: string;
    userId: string | null;
    filename: string;
    outputBaseName: string;
  }[];
  request: (
    operation: string,
    opts?: {
      userId?: string;
      files?: { name: string; content: Buffer }[];
      settings?: unknown;
      renameTemplate?: string;
    },
  ) => Promise<{ status: number; body: any }>;
};

async function startHarness(): Promise<Harness> {
  const created: {
    operation: string;
    userId: string | null;
    filename: string;
    outputBaseName: string;
  }[] = [];

  const stub = {
    async createJob(input: {
      id: string;
      operation: string;
      userId?: string | null;
      inputFilename: string;
      outputBaseName?: string;
    }): Promise<JobRecord> {
      created.push({
        operation: input.operation,
        userId: input.userId ?? null,
        filename: input.inputFilename,
        outputBaseName: input.outputBaseName ?? "",
      });
      return { id: input.id, state: "queued" } as JobRecord;
    },
  } as unknown as JobManager;

  const app = express();
  app.use((req, _res, next) => {
    const userId = req.header("x-test-user");
    if (userId) (req as Request & { authUser?: { id: string } }).authUser = { id: userId };
    next();
  });
  app.use("/api/batch", batchRoutes(stub));
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
    created,
    request: async (operation, opts = {}) => {
      const fd = new FormData();
      for (const file of opts.files ?? []) {
        fd.append("files", new Blob([file.content]), file.name);
      }
      fd.append("settings", JSON.stringify(opts.settings ?? {}));
      if (opts.renameTemplate) fd.append("renameTemplate", opts.renameTemplate);
      const res = await fetch(`${url}/api/batch/${operation}`, {
        method: "POST",
        headers: opts.userId ? { "x-test-user": opts.userId } : {},
        body: opts.files && opts.files.length ? fd : undefined,
      });
      const text = await res.text();
      return { status: res.status, body: text ? JSON.parse(text) : undefined };
    },
  };
}

// A tiny PNG (signature + minimal bytes) so detectImageFormat succeeds.
const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(64),
]);

test("batch: rejects an unknown operation", async () => {
  const h = await startHarness();
  try {
    const res = await h.request("frobnicate", { files: [{ name: "a.png", content: PNG }] });
    assert.equal(res.status, 400);
    assert.equal(h.created.length, 0);
  } finally {
    h.server.close();
  }
});

test("batch: rejects a request with no files", async () => {
  const h = await startHarness();
  try {
    const res = await h.request("resize", { userId: "user-1" });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /No image file/i);
    assert.equal(h.created.length, 0);
  } finally {
    h.server.close();
  }
});

test("batch: queues one job per file and attributes them to the caller", async () => {
  const h = await startHarness();
  try {
    const res = await h.request("resize", {
      userId: "user-1",
      files: [
        { name: "one.png", content: PNG },
        { name: "two.png", content: PNG },
        { name: "three.png", content: PNG },
      ],
      settings: { mode: "px", width: 100, height: 100, dpi: 72, format: "png" },
    });

    assert.equal(res.status, 202);
    assert.equal(res.body.jobIds.length, 3);
    assert.equal(new Set(res.body.jobIds).size, 3);
    assert.equal(h.created.length, 3);
    for (const job of h.created) {
      assert.equal(job.operation, "resize");
      assert.equal(job.userId, "user-1");
    }
  } finally {
    h.server.close();
  }
});

test("batch: jobs with no signed-in user are unscoped", async () => {
  const h = await startHarness();
  try {
    const res = await h.request("convert", {
      files: [{ name: "a.png", content: PNG }],
      settings: { format: "webp" },
    });
    assert.equal(res.status, 202);
    assert.equal(h.created.length, 1);
    assert.equal(h.created[0]?.userId, null);
  } finally {
    h.server.close();
  }
});

test("batch: rejects an operation that needs a URL rather than an upload", async () => {
  const h = await startHarness();
  try {
    const res = await h.request("fetch", { files: [{ name: "a.png", content: PNG }] });
    assert.equal(res.status, 400);
    assert.equal(h.created.length, 0);
  } finally {
    h.server.close();
  }
});

test("batch: expands the rename template into the output base name", async () => {
  const h = await startHarness();
  try {
    const res = await h.request("resize", {
      userId: "user-1",
      files: [
        { name: "sunset.png", content: PNG },
        { name: "beach.png", content: PNG },
      ],
      settings: { mode: "px", width: 100, height: 100, dpi: 72, format: "png" },
      renameTemplate: "{index}-{name}",
    });

    assert.equal(res.status, 202);
    assert.equal(h.created.length, 2);
    // Files are queued concurrently, so compare the set of names.
    const names = h.created.map((c) => c.outputBaseName).sort();
    assert.deepEqual(names, ["1-sunset", "2-beach"]);
  } finally {
    h.server.close();
  }
});

test("batch: appends the operation suffix when no template is given", async () => {
  const h = await startHarness();
  try {
    await h.request("resize", {
      files: [{ name: "sunset.png", content: PNG }],
      settings: { mode: "px", width: 100, height: 100, dpi: 72, format: "png" },
    });
    assert.equal(h.created[0]?.outputBaseName, "sunset-resized");
  } finally {
    h.server.close();
  }
});

test("batch: one unreadable file does not sink the rest of the batch", async () => {
  const h = await startHarness();
  try {
    const res = await h.request("resize", {
      userId: "user-1",
      files: [
        { name: "good.png", content: PNG },
        { name: "notes.txt", content: Buffer.from("not an image") },
        { name: "also-good.png", content: PNG },
      ],
      settings: { mode: "px", width: 100, height: 100, dpi: 72, format: "png" },
    });

    assert.equal(res.status, 202);
    assert.equal(h.created.length, 2);
    assert.equal(res.body.jobs.length, 3);

    const failed = res.body.jobs.find((j: any) => j.filename === "notes.txt");
    assert.ok(failed, "the bad file is reported");
    assert.equal(failed.jobId, null);
    assert.equal(failed.status, "failed");
    assert.ok(failed.error, "the bad file carries a reason");

    const queued = res.body.jobs.filter((j: any) => j.jobId);
    assert.equal(queued.length, 2);
  } finally {
    h.server.close();
  }
});

test("applyRenameTemplate: expands name, index and ext tokens", () => {
  assert.equal(applyRenameTemplate("{name}-{index}", "photo.png", 3), "photo-3");
  assert.equal(applyRenameTemplate("{index}.{ext}", "photo.png", 1), "1.png");
  assert.equal(applyRenameTemplate("{name}", "my holiday photo.png", 1), "my holiday photo");
});

test("applyRenameTemplate: sanitizes the expanded result", () => {
  assert.equal(applyRenameTemplate("{name}", "a/b:c.png", 1), "b_c");
  // A template can never escape into a directory.
  assert.equal(applyRenameTemplate("../{name}", "photo.png", 1), "photo");
  assert.equal(applyRenameTemplate("{name}", "photo.png", 1), "photo");
});

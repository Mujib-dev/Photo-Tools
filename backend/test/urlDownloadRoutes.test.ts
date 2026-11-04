import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";

import type { JobManager } from "../src/jobs/JobManager.js";
import type { JobRecord } from "../src/jobs/JobTypes.js";
import { urlDownloadRoutes } from "../src/api/urldownload.routes.js";
import { AppError } from "../src/utils/errors.js";

type Harness = {
  server: Server;
  url: string;
  created: {
    operation: string;
    userId: string | null;
    filename: string;
    outputBaseName: string;
    settings: any;
  }[];
  postDownload: (body: unknown, userId?: string) => Promise<{ status: number; body: any }>;
};

async function startHarness(): Promise<Harness> {
  const created: Harness["created"] = [];

  const stub = {
    async createJob(input: {
      id: string;
      operation: string;
      userId?: string | null;
      inputFilename: string;
      outputBaseName?: string;
      settings?: any;
    }): Promise<JobRecord> {
      created.push({
        operation: input.operation,
        userId: input.userId ?? null,
        filename: input.inputFilename,
        outputBaseName: input.outputBaseName ?? "",
        settings: input.settings,
      });
      return { id: input.id, state: "queued", operation: input.operation } as JobRecord;
    },
  } as unknown as JobManager;

  const app = express();
  app.use(express.json());

  // Attach mock auth user if header provided
  app.use((req, _res, next) => {
    const uid = req.headers["x-test-user"];
    if (typeof uid === "string") {
      (req as any).authUser = { id: uid, email: "test@example.com" };
    }
    next();
  });

  app.use("/api/url-download", urlDownloadRoutes(stub));

  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err instanceof AppError) {
      res.status(err.status).json({ error: err.safe });
      return;
    }
    res.status(500).json({ error: "Internal error" });
  });

  const server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const port = (server.address() as AddressInfo).port;
  const url = `http://127.0.0.1:${port}`;

  return {
    server,
    url,
    created,
    postDownload: async (body, userId) => {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (userId) headers["x-test-user"] = userId;
      const res = await fetch(`${url}/api/url-download`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
      return { status: res.status, body: await res.json() };
    },
  };
}

test("urlDownloadRoutes: POST / creates job immediately without blocking", async (t) => {
  const harness = await startHarness();
  t.after(() => harness.server.close());

  const res = await harness.postDownload(
    {
      url: "https://www.youtube.com/watch?v=PYlkM3jKCHk",
      quality: "1080",
      format: "mp4",
      title: "Zoya Afghan | Dab Dab Rozi Shab | New Version Part 2",
      kind: "stream",
      threads: 8,
    },
    "user-123",
  );

  assert.equal(res.status, 202);
  assert.equal(typeof res.body.jobId, "string");
  assert.equal(res.body.status, "queued");
  assert.equal(res.body.operation, "fetch");

  assert.equal(harness.created.length, 1);
  const created = harness.created[0];
  assert.equal(created.userId, "user-123");
  assert.equal(created.operation, "fetch");
  assert.equal(created.filename, "Zoya Afghan | Dab Dab Rozi Shab | New Version Part 2");
  assert.equal(created.outputBaseName, "Zoya Afghan _ Dab Dab Rozi Shab _ New Version Part 2");
  assert.equal(created.settings.quality, "1080");
  assert.equal(created.settings.format, "mp4");
  assert.equal(created.settings.threads, 8);
});

test("urlDownloadRoutes: rejects invalid URLs and unsupported formats", async (t) => {
  const harness = await startHarness();
  t.after(() => harness.server.close());

  const invalidUrl = await harness.postDownload({
    url: "ftp://example.com/movie.mp4",
  });
  assert.equal(invalidUrl.status, 400);

  const invalidFormat = await harness.postDownload({
    url: "https://example.com/video.mp4",
    format: "invalid",
  });
  assert.equal(invalidFormat.status, 400);
});

test("urlDownloadRoutes: unwraps Google redirect URLs to destination video URL", async (t) => {
  const harness = await startHarness();
  t.after(() => harness.server.close());

  const googleRedirectUrl =
    "https://www.google.com/url?sa=t&url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3DLI5oro00qtE&ved=2ahUKEwi";

  const res = await harness.postDownload(
    {
      url: googleRedirectUrl,
      quality: "720",
      format: "mp4",
      title: "Sample Video",
      kind: "stream",
    },
    "user-google",
  );

  assert.equal(res.status, 202);
  assert.equal(harness.created.length, 1);
  const created = harness.created[0];
  assert.equal(created.settings.url, "https://www.youtube.com/watch?v=LI5oro00qtE");
});

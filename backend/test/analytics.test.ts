import test from "node:test";
import assert from "node:assert/strict";

import { computeJobAnalytics } from "../src/services/analytics.js";
import type { JobRecord } from "../src/jobs/JobTypes.js";

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 0, 10, 12, 0, 0);

function job(overrides: Partial<JobRecord> & Pick<JobRecord, "id" | "operation" | "state">): JobRecord {
  return {
    inputFilename: "photo.jpg",
    inputSize: 1_000,
    inputFormat: "jpg",
    outputFilename: null,
    outputSize: null,
    outputFormat: null,
    stage: "",
    error: null,
    createdAt: NOW,
    updatedAt: NOW,
    processedAt: null,
    ...overrides,
  };
}

test("analytics: counts states, success rate and throughput", () => {
  const records: JobRecord[] = [
    job({ id: "1", operation: "resize", state: "completed", inputSize: 2_000, outputSize: 500, processedAt: NOW + 1000 }),
    job({ id: "2", operation: "resize", state: "failed" }),
    job({ id: "3", operation: "convert", state: "queued", inputSize: 4_000 }),
  ];
  const result = computeJobAnalytics(records, { sinceMs: NOW - 7 * DAY, now: NOW, windowDays: 7 });

  assert.equal(result.totals.jobs, 3);
  assert.equal(result.totals.completed, 1);
  assert.equal(result.totals.failed, 1);
  assert.equal(result.totals.active, 1);
  assert.equal(result.totals.successRate, 0.5);
  assert.equal(result.totals.inputBytes, 7_000);
  assert.equal(result.totals.outputBytes, 500);
  assert.equal(result.totals.avgProcessingMs, 1000);
});

test("analytics: excludes records before the window", () => {
  const records = [
    job({ id: "old", operation: "resize", state: "completed", createdAt: NOW - 30 * DAY }),
    job({ id: "recent", operation: "resize", state: "completed", createdAt: NOW - 1 * DAY }),
  ];
  const result = computeJobAnalytics(records, { sinceMs: NOW - 7 * DAY, now: NOW, windowDays: 7 });
  assert.equal(result.totals.jobs, 1);
});

test("analytics: groups by operation and format, newest format sorted by count", () => {
  const records = [
    job({ id: "1", operation: "resize", state: "completed", inputFormat: "PNG" }),
    job({ id: "2", operation: "resize", state: "failed", inputFormat: "png" }),
    job({ id: "3", operation: "watermark", state: "completed", inputFormat: "jpg" }),
  ];
  const result = computeJobAnalytics(records, { sinceMs: NOW - 1 * DAY, now: NOW, windowDays: 1 });

  assert.deepEqual(result.byOperation[0], {
    operation: "resize",
    total: 2,
    completed: 1,
    failed: 1,
    inputBytes: 2_000,
  });
  assert.equal(result.byOperation[1].operation, "watermark");
  assert.deepEqual(result.byInputFormat[0], { format: "png", count: 2 });
  assert.deepEqual(result.byInputFormat[1], { format: "jpg", count: 1 });
});

test("analytics: fills every day in the window with no gaps", () => {
  const records = [job({ id: "1", operation: "resize", state: "completed", createdAt: NOW })];
  const result = computeJobAnalytics(records, { sinceMs: NOW - 2 * DAY, now: NOW, windowDays: 3 });
  assert.equal(result.byDay.length, 3);
  assert.deepEqual(result.byDay.at(-1), { date: "2026-01-10", total: 1, completed: 1, failed: 0 });
  assert.equal(result.byDay[0].total, 0);
});

test("analytics: reports null average processing time when nothing completed", () => {
  const records = [job({ id: "1", operation: "resize", state: "queued" })];
  const result = computeJobAnalytics(records, { sinceMs: NOW - DAY, now: NOW, windowDays: 1 });
  assert.equal(result.totals.avgProcessingMs, null);
  assert.equal(result.totals.successRate, 0);
});

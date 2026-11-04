import test from "node:test";
import assert from "node:assert/strict";

import { computeUserUsage, creditCost, operationCategory } from "../src/services/usage.js";
import type { JobRecord } from "../src/jobs/JobTypes.js";

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 0, 10, 12, 0, 0);

function job(overrides: Partial<JobRecord> & Pick<JobRecord, "id" | "operation" | "state">): JobRecord {
  return {
    userId: "user-1",
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

test("usage: failed jobs are refunded and consume no credits", () => {
  const records = [
    job({ id: "1", operation: "removebg", state: "completed" }),
    job({ id: "2", operation: "removebg", state: "failed" }),
  ];
  const result = computeUserUsage(records, { sinceMs: NOW - 7 * DAY, now: NOW, windowDays: 7 });

  assert.equal(result.totals.jobs, 2);
  assert.equal(result.totals.completed, 1);
  assert.equal(result.totals.failed, 1);
  assert.equal(result.totals.creditsUsed, 5);
  assert.equal(result.totals.creditsRefunded, 5);
  assert.equal(result.totals.creditsCharged, 5);
});

test("usage: in-flight jobs are charged but not yet consumed", () => {
  const records = [
    job({ id: "1", operation: "resize", state: "completed" }),
    job({ id: "2", operation: "resize", state: "queued" }),
    job({ id: "3", operation: "resize", state: "processing" }),
  ];
  const result = computeUserUsage(records, { sinceMs: NOW - 7 * DAY, now: NOW, windowDays: 7 });

  assert.equal(result.totals.active, 2);
  assert.equal(result.totals.creditsUsed, 1);
  assert.equal(result.totals.creditsPending, 2);
  assert.equal(result.totals.creditsCharged, 3);
  assert.equal(result.totals.avgCreditsPerJob, 1);
});

test("usage: excludes records outside the window", () => {
  const records = [
    job({ id: "old", operation: "resize", state: "completed", createdAt: NOW - 30 * DAY }),
    job({ id: "recent", operation: "resize", state: "completed", createdAt: NOW - 1 * DAY }),
  ];
  const result = computeUserUsage(records, { sinceMs: NOW - 7 * DAY, now: NOW, windowDays: 7 });
  assert.equal(result.totals.jobs, 1);
});

test("usage: breaks down by operation, sorted by credits consumed", () => {
  const records = [
    job({ id: "1", operation: "resize", state: "completed" }),
    job({ id: "2", operation: "resize", state: "completed" }),
    job({ id: "3", operation: "removebg", state: "completed" }),
    job({ id: "4", operation: "removebg", state: "failed" }),
  ];
  const result = computeUserUsage(records, { sinceMs: NOW - 7 * DAY, now: NOW, windowDays: 7 });

  assert.equal(result.byOperation[0].operation, "removebg");
  assert.equal(result.byOperation[0].credits, 5);
  assert.equal(result.byOperation[0].jobs, 2);
  assert.equal(result.byOperation[0].completed, 1);
  assert.equal(result.byOperation[0].failed, 1);
  assert.equal(result.byOperation[0].unitCost, 5);
  assert.equal(result.byOperation[0].category, "image");

  assert.equal(result.byOperation[1].operation, "resize");
  assert.equal(result.byOperation[1].credits, 2);
});

test("usage: groups operations into categories", () => {
  const records = [
    job({ id: "1", operation: "resize", state: "completed" }),
    job({ id: "2", operation: "pdf", state: "completed" }),
    job({ id: "3", operation: "video", state: "completed" }),
  ];
  const result = computeUserUsage(records, { sinceMs: NOW - 7 * DAY, now: NOW, windowDays: 7 });

  const byCategory = Object.fromEntries(
    result.byCategory.map((entry) => [entry.category, entry]),
  );
  assert.equal(byCategory.image.jobs, 1);
  assert.equal(byCategory.image.credits, 1);
  assert.equal(byCategory.document.jobs, 1);
  assert.equal(byCategory.document.credits, 1);
  assert.equal(byCategory.media.jobs, 1);
  assert.equal(byCategory.media.credits, 3);
});

test("usage: fills every day in the window with no gaps", () => {
  const records = [job({ id: "1", operation: "resize", state: "completed", createdAt: NOW })];
  const result = computeUserUsage(records, { sinceMs: NOW - 2 * DAY, now: NOW, windowDays: 3 });

  assert.equal(result.byDay.length, 3);
  assert.deepEqual(result.byDay.at(-1), {
    date: "2026-01-10",
    jobs: 1,
    completed: 1,
    failed: 0,
    credits: 1,
  });
  assert.equal(result.byDay[0].credits, 0);
});

test("usage: success rate is completed over finished jobs", () => {
  const records = [
    job({ id: "1", operation: "resize", state: "completed" }),
    job({ id: "2", operation: "resize", state: "failed" }),
    job({ id: "3", operation: "resize", state: "failed" }),
    job({ id: "4", operation: "resize", state: "queued" }),
  ];
  const result = computeUserUsage(records, { sinceMs: NOW - 7 * DAY, now: NOW, windowDays: 7 });
  assert.equal(result.totals.successRate, 1 / 3);
});

test("usage: credit cost and category helpers", () => {
  assert.equal(creditCost("removebg"), 5);
  assert.equal(creditCost("resize"), 1);
  assert.equal(creditCost("not-a-real-operation"), 1);
  assert.equal(operationCategory("ocr"), "document");
  assert.equal(operationCategory("video"), "media");
  assert.equal(operationCategory("unknown"), "media");
});

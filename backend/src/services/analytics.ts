import type { JobRecord } from "../jobs/JobTypes.js";

/**
 * Usage analytics derived from the job store. Pure and side-effect free so it
 * can be unit-tested without a store, queue or network. All bucketing is UTC.
 */

export interface OperationStat {
  operation: string;
  total: number;
  completed: number;
  failed: number;
  inputBytes: number;
}

export interface DayStat {
  /** Local UTC calendar day, `YYYY-MM-DD`. */
  date: string;
  total: number;
  completed: number;
  failed: number;
}

export interface FormatStat {
  format: string;
  count: number;
}

export interface JobAnalytics {
  windowDays: number;
  since: number;
  generatedAt: number;
  totals: {
    jobs: number;
    completed: number;
    failed: number;
    active: number;
    /** Completed ÷ finished jobs (0–1); 0 when nothing has finished. */
    successRate: number;
    inputBytes: number;
    outputBytes: number;
    avgInputBytes: number;
    /** Mean wall-clock ms from creation to completion; null when unknown. */
    avgProcessingMs: number | null;
  };
  byOperation: OperationStat[];
  byDay: DayStat[];
  byInputFormat: FormatStat[];
}

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_FORMATS = 12;

function dayKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function computeJobAnalytics(
  records: JobRecord[],
  { sinceMs, now = Date.now(), windowDays }: { sinceMs: number; now?: number; windowDays: number },
): JobAnalytics {
  const within = records.filter((record) => record.createdAt >= sinceMs && record.createdAt <= now);

  let completed = 0;
  let failed = 0;
  let active = 0;
  let inputBytes = 0;
  let outputBytes = 0;
  let processingMsTotal = 0;
  let processingSamples = 0;

  const operations = new Map<string, OperationStat>();
  const days = new Map<string, DayStat>();
  const formats = new Map<string, number>();

  for (const record of within) {
    if (record.state === "completed") completed += 1;
    else if (record.state === "failed") failed += 1;
    else active += 1;

    inputBytes += record.inputSize || 0;
    outputBytes += record.outputSize || 0;

    if (record.state === "completed" && record.processedAt != null) {
      const duration = record.processedAt - record.createdAt;
      if (duration >= 0) {
        processingMsTotal += duration;
        processingSamples += 1;
      }
    }

    const op =
      operations.get(record.operation) ??
      { operation: record.operation, total: 0, completed: 0, failed: 0, inputBytes: 0 };
    op.total += 1;
    if (record.state === "completed") op.completed += 1;
    else if (record.state === "failed") op.failed += 1;
    op.inputBytes += record.inputSize || 0;
    operations.set(record.operation, op);

    const key = dayKey(record.createdAt);
    const day = days.get(key) ?? { date: key, total: 0, completed: 0, failed: 0 };
    day.total += 1;
    if (record.state === "completed") day.completed += 1;
    else if (record.state === "failed") day.failed += 1;
    days.set(key, day);

    const format = (record.inputFormat || "unknown").toLowerCase();
    formats.set(format, (formats.get(format) ?? 0) + 1);
  }

  // Emit an entry for every day in the window so charts have no gaps.
  const byDay: DayStat[] = [];
  const start = new Date(sinceMs);
  const startOfDay = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
  for (let t = startOfDay; t <= now; t += DAY_MS) {
    const key = dayKey(t);
    byDay.push(days.get(key) ?? { date: key, total: 0, completed: 0, failed: 0 });
  }

  const finished = completed + failed;
  return {
    windowDays,
    since: sinceMs,
    generatedAt: now,
    totals: {
      jobs: within.length,
      completed,
      failed,
      active,
      successRate: finished > 0 ? completed / finished : 0,
      inputBytes,
      outputBytes,
      avgInputBytes: within.length > 0 ? Math.round(inputBytes / within.length) : 0,
      avgProcessingMs: processingSamples > 0 ? Math.round(processingMsTotal / processingSamples) : null,
    },
    byOperation: [...operations.values()].sort((a, b) => b.total - a.total || a.operation.localeCompare(b.operation)),
    byDay,
    byInputFormat: [...formats.entries()]
      .map(([format, count]) => ({ format, count }))
      .sort((a, b) => b.count - a.count || a.format.localeCompare(b.format))
      .slice(0, MAX_FORMATS),
  };
}

import { errorFrom, request } from "@/lib/auth";
import type { JobState } from "@/lib/types";

export type UsageCategory = "image" | "document" | "media";

export interface UsageOperationStat {
  operation: string;
  category: UsageCategory;
  jobs: number;
  completed: number;
  failed: number;
  active: number;
  /** Credits consumed by this operation in the window (failed jobs excluded). */
  credits: number;
  /** Credit price of a single run of this operation. */
  unitCost: number;
}

export interface UsageCategoryStat {
  category: UsageCategory;
  label: string;
  jobs: number;
  credits: number;
}

export interface UsageDayStat {
  /** UTC calendar day, `YYYY-MM-DD`. */
  date: string;
  jobs: number;
  completed: number;
  failed: number;
  credits: number;
}

export interface UsageTotals {
  jobs: number;
  completed: number;
  failed: number;
  active: number;
  successRate: number;
  creditsUsed: number;
  creditsPending: number;
  creditsCharged: number;
  creditsRefunded: number;
  avgCreditsPerJob: number;
}

export interface UsageHistoryEntry {
  id: string;
  operation: string;
  category: UsageCategory;
  state: JobState;
  inputFilename: string;
  inputSize: number;
  inputFormat: string;
  outputSize: number | null;
  outputFormat: string | null;
  createdAt: number;
  /** Credit price of this job's operation. */
  creditCost: number;
  /** Credits actually kept (0 for failed jobs, which are refunded). */
  creditsCharged: number;
  /** True when the job failed and its credits were returned. */
  refunded: boolean;
}

export interface UsageMonthSummary {
  label: string;
  since: number;
  jobs: number;
  creditsUsed: number;
  creditsCharged: number;
  previous: {
    label: string;
    jobs: number;
    creditsUsed: number;
  };
}

export interface UsageState {
  windowDays: number;
  since: number;
  generatedAt: number;
  plan: { key: string; label: string; monthlyCredits: number };
  credits: {
    balance: number;
    monthlyAllowance: number;
    remaining: number;
    nextGrantAt: number | null;
  };
  totals: UsageTotals;
  byOperation: UsageOperationStat[];
  byCategory: UsageCategoryStat[];
  byDay: UsageDayStat[];
  month: UsageMonthSummary;
  recentJobs: UsageHistoryEntry[];
}

/** Time windows the dashboard offers. */
export const USAGE_WINDOWS = [7, 14, 30, 90, 365] as const;

export type UsageWindow = (typeof USAGE_WINDOWS)[number];

/** Display names for every billable operation. */
export const OPERATION_LABELS: Record<string, string> = {
  resize: "Resize",
  convert: "Convert",
  compress: "Compress",
  enhance: "AI enhance",
  removebg: "Background removal",
  watermark: "Watermark",
  scan: "Scan",
  ocr: "OCR",
  audio: "Audio",
  tts: "Text to speech",
  stt: "Speech to text",
  video: "Video",
  pdf: "PDF",
  fetch: "URL download",
};

/** Display names for the tool families. */
export const USAGE_CATEGORY_LABELS: Record<UsageCategory, string> = {
  image: "Image tools",
  document: "Documents",
  media: "Media",
};

/** Chart colours, one per tool family. */
export const USAGE_CATEGORY_COLORS: Record<UsageCategory, string> = {
  image: "#2563eb",
  document: "#8b5cf6",
  media: "#f59e0b",
};

export function operationLabel(operation: string): string {
  return OPERATION_LABELS[operation] ?? operation.charAt(0).toUpperCase() + operation.slice(1);
}

/** Load the signed-in account's usage history for a time window. */
export async function fetchUsage(days: number): Promise<UsageState> {
  const res = await request(`/api/backend/usage?days=${days}`);
  if (!res.ok) throw await errorFrom(res);
  return (await res.json()) as UsageState;
}

export const usageKeys = {
  all: ["usage"] as const,
  usage: (days: number) => ["usage", days] as const,
};

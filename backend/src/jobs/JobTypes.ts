import type { ProcessingSettings } from "../services/ProcessingService.js";

export type JobOperation = "resize" | "convert" | "enhance" | "scan" | "pdf" | "removebg" | "compress" | "watermark" | "video" | "fetch" | "audio" | "ocr";

export type JobState = "queued" | "processing" | "completed" | "failed";

export interface JobRecord {
  id: string;
  operation: JobOperation;
  /** The billed account, or null for anonymous work (auth disabled). */
  userId: string | null;
  inputFilename: string;
  inputSize: number;
  inputFormat: string;
  outputFilename: string | null;
  outputSize: number | null;
  outputFormat: string | null;
  state: JobState;
  stage: string;
  error: string | null;
  createdAt: number;
  updatedAt: number;
  processedAt: number | null;
}

export type NewJobRecord = Omit<JobRecord, "createdAt" | "updatedAt" | "error">;

export interface JobPayload {
  jobId: string;
  operation: JobOperation;
  /** Billed account, carried through so failures can be refunded. */
  userId: string | null;
  inputPath: string;
  outputDir: string;
  outputBaseName: string;
  settings: ProcessingSettings;
  inputDir: string;
  logsDir: string;
}

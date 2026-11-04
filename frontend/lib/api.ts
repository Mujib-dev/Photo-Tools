import type {
  AudioSettings,
  CompressSettings,
  ConvertSettings,
  EnhanceSettings,
  JobRecord,
  PdfEditPlan,
  PdfOp,
  PdfPreview,
  RemoveBgSettings,
  ResizeSettings,
  ScanSettings,
  OcrAnalysisResult,
  OcrLanguage,
  OcrSettings,
  SubmitResponse,
  UrlDownloadAnalysis,
  UrlDownloadSettings,
  VideoSettings,
  WatermarkSettings,
} from "./types";
import { errorFrom, request as authRequest } from "./auth";

async function request(path: string, init?: RequestInit): Promise<Response> {
  const res = await authRequest(path, init);
  if (!res.ok) throw await errorFrom(res);
  return res;
}

async function submit(
  file: File,
  settings:
    | ResizeSettings
    | ConvertSettings
    | EnhanceSettings
    | RemoveBgSettings
    | CompressSettings
    | WatermarkSettings
    | VideoSettings
    | AudioSettings
    | OcrSettings,
  path: string,
): Promise<SubmitResponse> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("settings", JSON.stringify(settings));
  const res = await request(path, { method: "POST", body: fd });
  return (await res.json()) as SubmitResponse;
}

export function submitResize(file: File, settings: ResizeSettings): Promise<SubmitResponse> {
  return submit(file, settings, "/api/backend/resize");
}

export function submitConvert(file: File, settings: ConvertSettings): Promise<SubmitResponse> {
  return submit(file, settings, "/api/backend/convert");
}

export function submitEnhance(file: File, settings: EnhanceSettings): Promise<SubmitResponse> {
  return submit(file, settings, "/api/backend/enhance");
}

export function submitRemoveBg(file: File, settings: RemoveBgSettings): Promise<SubmitResponse> {
  return submit(file, settings, "/api/backend/remove-bg");
}

export function submitCompress(file: File, settings: CompressSettings): Promise<SubmitResponse> {
  return submit(file, settings, "/api/backend/compress");
}

export async function submitWatermark(
  file: File,
  settings: WatermarkSettings,
  watermarkImage?: File | null,
): Promise<SubmitResponse> {
  const fd = new FormData();
  fd.append("file", file);
  if (watermarkImage) {
    fd.append("watermark", watermarkImage);
  }
  fd.append("settings", JSON.stringify(settings));
  const res = await request("/api/backend/watermark", { method: "POST", body: fd });
  return (await res.json()) as SubmitResponse;
}

export function submitAudio(file: File, settings: AudioSettings): Promise<SubmitResponse> {
  return submit(file, settings, "/api/backend/audio");
}

export function submitVideo(file: File, settings: VideoSettings): Promise<SubmitResponse> {
  return submit(file, settings, "/api/backend/video");
}

/** Inspect a media URL and return its quality/format options. */
export async function analyzeUrlDownload(url: string): Promise<UrlDownloadAnalysis> {
  const res = await request("/api/backend/url-download/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  return (await res.json()) as UrlDownloadAnalysis;
}

/** Queue a URL fetch/convert job. */
export async function submitUrlDownload(settings: UrlDownloadSettings): Promise<SubmitResponse> {
  const res = await request("/api/backend/url-download", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(settings),
  });
  return (await res.json()) as SubmitResponse;
}

export async function getJob(id: string): Promise<JobRecord> {
  const res = await request(`/api/backend/jobs/${encodeURIComponent(id)}`);
  return (await res.json()) as JobRecord;
}

/**
 * Stream real-time job updates via Server-Sent Events (SSE).
 * Returns an unsubscribe function to abort the stream.
 */
export function subscribeJob(
  id: string,
  onUpdate: (record: JobRecord) => void,
  onError?: () => void,
): () => void {
  if (typeof EventSource === "undefined") {
    onError?.();
    return () => {};
  }

  const url = `/api/backend/jobs/${encodeURIComponent(id)}/events`;
  const es = new EventSource(url);

  es.onmessage = (event) => {
    try {
      const record = JSON.parse(event.data) as JobRecord;
      onUpdate(record);
      if (record.state === "completed" || record.state === "failed") {
        es.close();
      }
    } catch {
      // ignore malformed payloads
    }
  };

  es.onerror = () => {
    es.close();
    onError?.();
  };

  return () => {
    es.close();
  };
}

/** The signed-in account's recent jobs, newest first (My Files). */
export async function listJobs(limit = 100): Promise<JobRecord[]> {
  const res = await request(`/api/backend/jobs?limit=${limit}`);
  const body = (await res.json()) as { jobs: JobRecord[] };
  return body.jobs;
}

export async function deleteJob(id: string): Promise<void> {
  await request(`/api/backend/jobs/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export function downloadUrl(id: string): string {
  return `/api/backend/download/${encodeURIComponent(id)}`;
}

export function downloadAllUrl(ids: string[]): string {
  return `/api/backend/download-all?ids=${ids.map((id) => encodeURIComponent(id)).join(",")}`;
}

export function scanDownloadUrl(id: string, file: string): string {
  return `/api/backend/download/${encodeURIComponent(id)}?file=${encodeURIComponent(file)}`;
}

export interface ScanDetection {
  corners: [number, number][] | null;
}

/**
 * Submit every page of a scan as a single multi-page job. Files are appended
 * in page order — the backend maps files[i] to pages[i].
 */
export async function submitScan(files: File[], settings: ScanSettings): Promise<SubmitResponse> {
  const fd = new FormData();
  for (const file of files) fd.append("files", file);
  fd.append("settings", JSON.stringify(settings));
  const res = await request("/api/backend/scan", { method: "POST", body: fd });
  return (await res.json()) as SubmitResponse;
}

/** Submit one or more PDFs for an offline PDF operation. */
export async function submitPdf(
  files: File[],
  op: PdfOp,
  plan?: PdfEditPlan,
  extraSettings?: {
    userPassword?: string;
    ownerPassword?: string;
    permissions?: {
      print?: boolean;
      copy?: boolean;
      edit?: boolean;
      annotate?: boolean;
    };
    password?: string;
  },
): Promise<SubmitResponse> {
  const fd = new FormData();
  for (const file of files) fd.append("files", file);
  // For "edit" the first file must be the PDF; overlay images follow it.
  const payload = plan ? { op, plan, ...extraSettings } : { op, ...extraSettings };
  fd.append("settings", JSON.stringify(payload));
  const res = await request("/api/backend/pdf", { method: "POST", body: fd });
  return (await res.json()) as SubmitResponse;
}

/** Render page previews so the editor can show the document before editing. */
export async function previewPdf(file: File): Promise<PdfPreview> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await request("/api/backend/pdf/preview", { method: "POST", body: fd });
  return (await res.json()) as PdfPreview;
}

/** URL of one rendered preview page (1-based, as the engine numbers them). */
export function pdfPreviewUrl(preview: PdfPreview, pageNumber: number): string {
  return `/api/backend/pdf/preview/${preview.token}/page-${pageNumber}.jpg`;
}

/** Synchronous edge detection for one page. `rotate` matches the page rotation. */
export async function submitScanDetect(file: File, rotate: number): Promise<ScanDetection> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("rotate", String(rotate));
  const res = await request("/api/backend/scan/detect", { method: "POST", body: fd });
  return (await res.json()) as ScanDetection;
}

export interface ContactSubmitResponse {
  ok: boolean;
  message: string;
}

/** Submit a contact form. */
export async function submitContact(data: {
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
}): Promise<ContactSubmitResponse> {
  const res = await request("/api/backend/contact", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return (await res.json()) as ContactSubmitResponse;
}

export async function getOcrLanguages(): Promise<OcrLanguage[]> {
  const res = await request("/api/backend/ocr/languages");
  return (await res.json()) as OcrLanguage[];
}

export async function analyzeOcr(file: File, language?: string): Promise<OcrAnalysisResult> {
  const fd = new FormData();
  fd.append("file", file);
  if (language) fd.append("language", language);
  const res = await request("/api/backend/ocr/analyze", { method: "POST", body: fd });
  return (await res.json()) as OcrAnalysisResult;
}

export function submitOcr(file: File, settings: OcrSettings): Promise<SubmitResponse> {
  return submit(file, settings, "/api/backend/ocr");
}

export interface BatchJobResult {
  /** Position in the batch, 0-based. */
  index: number;
  filename: string;
  /** The queued job id, or null when the file could not be queued. */
  jobId: string | null;
  status: string;
  /** Why the file was rejected, when it was. */
  error: string | null;
}

export async function submitBatch(
  operation: string,
  files: File[],
  settings: unknown,
  renameTemplate?: string,
): Promise<{ jobIds: string[]; jobs: BatchJobResult[] }> {
  const fd = new FormData();
  for (const file of files) fd.append("files", file);
  fd.append("settings", JSON.stringify(settings ?? {}));
  if (renameTemplate) fd.append("renameTemplate", renameTemplate);
  const res = await request(`/api/backend/batch/${operation}`, { method: "POST", body: fd });
  return (await res.json()) as { jobIds: string[]; jobs: BatchJobResult[] };
}

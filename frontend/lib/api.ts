import type {
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
  SubmitResponse,
  VideoSettings,
  WatermarkSettings,
} from "./types";

async function request(path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(path, init);
  if (!res.ok) {
    let message = "Something went wrong. Please try again.";
    try {
      const body = (await res.json()) as { error?: string };
      if (body?.error) message = body.error;
    } catch {
      // ignore non-JSON error bodies
    }
    throw new Error(message);
  }
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
    | VideoSettings,
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

export function submitWatermark(file: File, settings: WatermarkSettings): Promise<SubmitResponse> {
  return submit(file, settings, "/api/backend/watermark");
}

export function submitVideo(file: File, settings: VideoSettings): Promise<SubmitResponse> {
  return submit(file, settings, "/api/backend/video");
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
): Promise<SubmitResponse> {
  const fd = new FormData();
  for (const file of files) fd.append("files", file);
  // For "edit" the first file must be the PDF; overlay images follow it.
  fd.append("settings", JSON.stringify(plan ? { op, plan } : { op }));
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

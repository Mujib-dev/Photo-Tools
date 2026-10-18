/**
 * Client-side screen-capture helpers and a dependency-free PDF writer.
 *
 * Everything here runs in the browser: the display stream never leaves the
 * machine and the PDF is assembled from JPEG-encoded screenshots locally.
 */

export interface CaptureShot {
  id: string;
  /** PNG blob of the capture, used for individual downloads. */
  blob: Blob;
  /** PNG data URL, used for the gallery preview and region cropping. */
  dataUrl: string;
  width: number;
  height: number;
  label: string;
  createdAt: number;
}

export type PdfPageSize = "fit" | "a4" | "letter";
export type PdfOrientation = "auto" | "portrait" | "landscape";

export interface PdfExportOptions {
  pageSize: PdfPageSize;
  orientation: PdfOrientation;
  /** Margin around the image in PDF points (ignored when pageSize is "fit"). */
  margin: number;
  /** JPEG quality, 0.4 – 1. */
  quality: number;
}

export const DEFAULT_PDF_OPTIONS: PdfExportOptions = {
  pageSize: "a4",
  orientation: "auto",
  margin: 18,
  quality: 0.9,
};

export const PDF_PAGE_SIZES: { value: PdfPageSize; label: string }[] = [
  { value: "a4", label: "A4" },
  { value: "letter", label: "Letter" },
  { value: "fit", label: "Match image" },
];

export const PDF_ORIENTATIONS: { value: PdfOrientation; label: string }[] = [
  { value: "auto", label: "Auto" },
  { value: "portrait", label: "Portrait" },
  { value: "landscape", label: "Landscape" },
];

function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

/** True when this browser exposes the screen-capture API. */
export function canCaptureScreen(): boolean {
  return typeof navigator !== "undefined" && !!navigator.mediaDevices?.getDisplayMedia;
}

/** Ask the user to pick a screen, window or tab to share. */
export async function requestDisplayStream(): Promise<MediaStream> {
  if (!canCaptureScreen()) {
    throw new Error("Screen capture is not supported in this browser.");
  }
  return navigator.mediaDevices.getDisplayMedia({
    video: { frameRate: 30 },
    audio: false,
  });
}

export function stopStream(stream: MediaStream | null): void {
  stream?.getTracks().forEach((track) => track.stop());
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not read the captured image."));
    img.src = src;
  });
}

/** Wrap a rendered canvas as a capture ready for the gallery and PDF export. */
export async function shotFromCanvas(canvas: HTMLCanvasElement, label: string): Promise<CaptureShot> {
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Failed to encode the capture."))),
      "image/png",
    );
  });
  return {
    id: uid(),
    blob,
    dataUrl: canvas.toDataURL("image/png"),
    width: canvas.width,
    height: canvas.height,
    label,
    createdAt: Date.now(),
  };
}

/** Wait until the attached stream reports real frame dimensions. */
async function waitForVideo(video: HTMLVideoElement): Promise<void> {
  if (video.readyState < 2 && video.videoWidth === 0) {
    await new Promise<void>((resolve) => {
      const done = () => resolve();
      video.addEventListener("loadeddata", done, { once: true });
      setTimeout(done, 3000);
    });
  }
}

/** Grab a single frame from a video element that already has a live stream. */
export async function grabShotFromVideo(video: HTMLVideoElement, label: string): Promise<CaptureShot> {
  await waitForVideo(video);
  const width = video.videoWidth;
  const height = video.videoHeight;
  if (!width || !height) throw new Error("The capture came back empty. Please try again.");

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is unavailable in this browser.");
  ctx.drawImage(video, 0, 0, width, height);
  return shotFromCanvas(canvas, label);
}

/** Crop a region (in natural pixels) out of an existing capture. */
export async function cropShot(
  shot: CaptureShot,
  rect: { x: number; y: number; width: number; height: number },
  label: string,
): Promise<CaptureShot> {
  const img = await loadImage(shot.dataUrl);
  const x = Math.max(0, Math.min(shot.width - 1, Math.round(rect.x)));
  const y = Math.max(0, Math.min(shot.height - 1, Math.round(rect.y)));
  const w = Math.max(1, Math.min(shot.width - x, Math.round(rect.width)));
  const h = Math.max(1, Math.min(shot.height - y, Math.round(rect.height)));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is unavailable in this browser.");
  ctx.drawImage(img, x, y, w, h, 0, 0, w, h);
  return shotFromCanvas(canvas, label);
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

// --- PDF writer ----------------------------------------------------------

function encodeLatin1(text: string): Uint8Array {
  const out = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i += 1) out[i] = text.charCodeAt(i) & 0xff;
  return out;
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

interface EncodedImage {
  bytes: Uint8Array;
  width: number;
  height: number;
}

/** Flatten a capture onto a white canvas and re-encode it as baseline JPEG. */
async function encodeShotAsJpeg(shot: CaptureShot, quality: number): Promise<EncodedImage> {
  const img = await loadImage(shot.dataUrl);
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth || shot.width;
  canvas.height = img.naturalHeight || shot.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is unavailable in this browser.");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL("image/jpeg", quality);
  const comma = dataUrl.indexOf(",");
  return { bytes: base64ToBytes(dataUrl.slice(comma + 1)), width: canvas.width, height: canvas.height };
}

interface PageLayout {
  pageW: number;
  pageH: number;
  drawW: number;
  drawH: number;
  tx: number;
  ty: number;
}

function layoutPage(imgW: number, imgH: number, options: PdfExportOptions): PageLayout {
  if (options.pageSize === "fit") {
    return { pageW: imgW, pageH: imgH, drawW: imgW, drawH: imgH, tx: 0, ty: 0 };
  }
  const [short, long] = options.pageSize === "letter" ? [612, 792] : [595.28, 841.89];
  const landscape =
    options.orientation === "auto" ? imgW > imgH : options.orientation === "landscape";
  const pageW = landscape ? long : short;
  const pageH = landscape ? short : long;

  const margin = Math.max(0, options.margin);
  const contentW = Math.max(1, pageW - margin * 2);
  const contentH = Math.max(1, pageH - margin * 2);
  const scale = Math.min(contentW / imgW, contentH / imgH);
  const drawW = imgW * scale;
  const drawH = imgH * scale;
  return { pageW, pageH, drawW, drawH, tx: (pageW - drawW) / 2, ty: (pageH - drawH) / 2 };
}

/** Combine captured screenshots into a single multi-page PDF. */
export async function imagesToPdf(shots: CaptureShot[], options: PdfExportOptions): Promise<Blob> {
  if (shots.length === 0) throw new Error("Capture at least one screenshot first.");
  const quality = Math.min(1, Math.max(0.4, options.quality));
  const images = await Promise.all(shots.map((shot) => encodeShotAsJpeg(shot, quality)));

  const n = images.length;
  const objectCount = 2 + n * 3;
  const offsets = new Array<number>(objectCount).fill(0);
  const chunks: Uint8Array[] = [];
  let offset = 0;

  const push = (chunk: Uint8Array | string) => {
    const bytes = typeof chunk === "string" ? encodeLatin1(chunk) : chunk;
    chunks.push(bytes);
    offset += bytes.length;
  };
  const beginObj = (id: number) => {
    offsets[id] = offset;
    push(`${id} 0 obj\n`);
  };
  const endObj = () => push("endobj\n");

  push("%PDF-1.4\n");
  push(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));

  beginObj(1);
  push("<< /Type /Catalog /Pages 2 0 R >>\n");
  endObj();

  const kids = images.map((_, i) => `${3 + i * 3} 0 R`).join(" ");
  beginObj(2);
  push(`<< /Type /Pages /Kids [ ${kids} ] /Count ${n} >>\n`);
  endObj();

  images.forEach((img, i) => {
    const pageId = 3 + i * 3;
    const contentId = 4 + i * 3;
    const imageId = 5 + i * 3;
    const { pageW, pageH, drawW, drawH, tx, ty } = layoutPage(img.width, img.height, options);

    const content = `q ${fmt(drawW)} 0 0 ${fmt(drawH)} ${fmt(tx)} ${fmt(ty)} cm /Im0 Do Q\n`;
    const contentBytes = encodeLatin1(content);
    beginObj(contentId);
    push(`<< /Length ${contentBytes.length} >>\nstream\n`);
    push(contentBytes);
    push("\nendstream\n");
    endObj();

    beginObj(imageId);
    push(
      `<< /Type /XObject /Subtype /Image /Width ${img.width} /Height ${img.height}` +
        ` /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${img.bytes.length} >>\nstream\n`,
    );
    push(img.bytes);
    push("\nendstream\n");
    endObj();

    beginObj(pageId);
    push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${fmt(pageW)} ${fmt(pageH)}]` +
        ` /Resources << /XObject << /Im0 ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>\n`,
    );
    endObj();
  });

  const xrefOffset = offset;
  push(`xref\n0 ${objectCount}\n`);
  push("0000000000 65535 f \n");
  for (let id = 1; id < objectCount; id += 1) {
    push(`${String(offsets[id]).padStart(10, "0")} 00000 n \n`);
  }
  push(`trailer\n<< /Size ${objectCount} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);

  return new Blob(chunks as BlobPart[], { type: "application/pdf" });
}

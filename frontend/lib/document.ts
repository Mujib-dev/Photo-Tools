/**
 * Client-side document import for the Screenshot Studio.
 *
 * Turns an uploaded PDF, Word document, plain-text file or image into a list of
 * page captures that can be reordered, downloaded and combined into a PDF.
 * Everything runs in the browser — the libraries are imported lazily so the
 * initial bundle stays small and nothing is ever uploaded.
 */

import { shotFromCanvas, type CaptureShot } from "./screenshot";

export type DocumentKind = "pdf" | "word" | "text" | "image";

export interface PageRange {
  from: number;
  to: number;
}

export interface DocumentImportOptions {
  /** Render resolution. PDFs use it as DPI; HTML pages scale relative to 96 dpi. */
  dpi: number;
  /** Keep only these 1-based pages; `null` keeps every page. */
  range: PageRange | null;
}

export interface DocumentImportResult {
  shots: CaptureShot[];
  totalPages: number;
  kind: DocumentKind;
}

/** `accept` value that matches every format the importer understands. */
export const DOCUMENT_ACCEPT =
  "application/pdf,.pdf," +
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx," +
  "application/msword,.doc," +
  "text/plain,.txt,.md,.markdown,.csv,.log,.rtf," +
  "image/*";

const WORD_EXT = [".docx", ".doc"];
const TEXT_EXT = [".txt", ".md", ".markdown", ".csv", ".log", ".rtf"];

/** Identify which renderer a file needs, or null when it is unsupported. */
export function detectDocumentKind(file: File): DocumentKind | null {
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  if (type.startsWith("image/") || /\.(png|jpe?g|gif|webp|bmp|tiff?)$/.test(name)) return "image";
  if (type === "application/pdf" || name.endsWith(".pdf")) return "pdf";
  if (
    type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    type === "application/msword" ||
    WORD_EXT.some((ext) => name.endsWith(ext))
  ) {
    return "word";
  }
  if (type.startsWith("text/") || TEXT_EXT.some((ext) => name.endsWith(ext))) return "text";
  return null;
}

function baseName(name: string): string {
  return name.replace(/\.[a-z0-9]+$/i, "") || name;
}

/** Lazily load pdf.js once and point its worker at the bundled worker file. */
let pdfjsPromise: Promise<typeof import("pdfjs-dist")> | null = null;
function loadPdfJs(): Promise<typeof import("pdfjs-dist")> {
  if (!pdfjsPromise) {
    pdfjsPromise = import("pdfjs-dist").then((pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url,
      ).toString();
      return pdfjs;
    });
  }
  return pdfjsPromise;
}

/** Clamp the requested page window against the number of pages available. */
function clampRange(range: PageRange | null, total: number): { from: number; to: number } {
  if (total <= 0) return { from: 1, to: 0 };
  if (!range) return { from: 1, to: total };
  const from = Math.min(total, Math.max(1, Math.floor(range.from) || 1));
  const to = Math.min(total, Math.max(from, Math.floor(range.to) || from));
  return { from, to };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not read that image."));
    img.src = src;
  });
}

/** Longest edge allowed for an imported page so a huge photo cannot blow up memory. */
const MAX_IMPORT_DIM = 4000;

async function imageFileToShot(file: File): Promise<CaptureShot> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    let width = img.naturalWidth;
    let height = img.naturalHeight;
    const scale = Math.min(1, MAX_IMPORT_DIM / Math.max(width, height));
    width = Math.max(1, Math.round(width * scale));
    height = Math.max(1, Math.round(height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas is unavailable in this browser.");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    return shotFromCanvas(canvas, baseName(file.name));
  } finally {
    URL.revokeObjectURL(url);
  }
}

// --- PDF -------------------------------------------------------------------

async function renderPdf(
  file: File,
  options: DocumentImportOptions,
): Promise<{ shots: CaptureShot[]; totalPages: number; kind: DocumentKind }> {
  const pdfjs = await loadPdfJs();

  const data = new Uint8Array(await file.arrayBuffer());
  const task = pdfjs.getDocument({ data });
  const doc = await task.promise;
  try {
    const totalPages = doc.numPages;
    const { from, to } = clampRange(options.range, totalPages);
    const scale = Math.max(0.5, options.dpi / 72);
    const label = baseName(file.name);
    const shots: CaptureShot[] = [];
    for (let n = from; n <= to; n += 1) {
      const page = await doc.getPage(n);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.ceil(viewport.width));
      canvas.height = Math.max(1, Math.ceil(viewport.height));
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas is unavailable in this browser.");
      await page.render({ canvas: null, canvasContext: ctx, viewport }).promise;
      shots.push(await shotFromCanvas(canvas, `${label} — p${n}`));
      page.cleanup();
    }
    return { shots, totalPages, kind: "pdf" };
  } finally {
    await task.destroy();
  }
}

// --- Word / text -----------------------------------------------------------

/** Strip the most common RTF control noise so the text is at least readable. */
function rtfToText(rtf: string): string {
  return rtf
    .replace(/\\'([0-9a-f]{2})/gi, (_m, hex: string) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\u(-?\d+)\??/g, (_m, code: string) => String.fromCharCode(((Number(code) % 65536) + 65536) % 65536))
    .replace(/\\par[d]?\b/g, "\n")
    .replace(/\\[a-z]+-?\d* ?/gi, "")
    .replace(/[{}]/g, "")
    .replace(/\n{3,}/g, "\n\n");
}

/** A4 portrait at 96 dpi: 210mm x 297mm. */
const PAGE_WIDTH = 794;
const PAGE_HEIGHT = Math.round(PAGE_WIDTH * (297 / 210));
const PAGE_MARGIN = 48;

const DOC_STYLE = [
  "img{max-width:100%;height:auto;}",
  "table{max-width:100%;border-collapse:collapse;}",
  "td,th{border:1px solid #cccccc;padding:4px 6px;}",
  "h1{font-size:26px;}h2{font-size:22px;}h3{font-size:18px;}",
  "h1,h2,h3{margin:0.6em 0 0.3em;}p{margin:0.5em 0;}",
  "pre{white-space:pre-wrap;word-break:break-word;margin:0;font-family:'Courier New',monospace;}",
  "ul,ol{margin:0.4em 0;padding-left:1.4em;}",
].join("");

/** Render a block of HTML and slice it into A4-proportioned page canvases. */
async function htmlToPageShots(html: string, dpi: number, label: string): Promise<CaptureShot[]> {
  const html2canvas = (await import("html2canvas")).default;
  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.style.cssText = [
    "position:fixed",
    "left:-100000px",
    "top:0",
    `width:${PAGE_WIDTH}px`,
    "background:#ffffff",
    "color:#111111",
    `padding:${PAGE_MARGIN}px`,
    "box-sizing:border-box",
    "font-family:Georgia,'Times New Roman',serif",
    "font-size:16px",
    "line-height:1.5",
    "word-wrap:break-word",
  ].join(";");
  host.innerHTML = `<style>${DOC_STYLE}</style>${html}`;
  document.body.appendChild(host);

  try {
    if (typeof document.fonts?.ready?.then === "function") {
      await document.fonts.ready.catch(() => undefined);
    }
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    const scale = Math.max(1, dpi / 96);
    const contentHeight = Math.max(1, host.scrollHeight);
    const full = await html2canvas(host, {
      scale,
      width: PAGE_WIDTH,
      height: contentHeight,
      windowWidth: PAGE_WIDTH,
      backgroundColor: "#ffffff",
      logging: false,
      useCORS: true,
    });

    const pageW = Math.round(PAGE_WIDTH * scale);
    const pageH = Math.round(PAGE_HEIGHT * scale);
    const total = Math.max(1, Math.ceil(full.height / pageH));
    const shots: CaptureShot[] = [];
    for (let i = 0; i < total; i += 1) {
      const canvas = document.createElement("canvas");
      canvas.width = pageW;
      canvas.height = pageH;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas is unavailable in this browser.");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, pageW, pageH);
      const sy = i * pageH;
      const sh = Math.min(pageH, full.height - sy);
      if (sh > 0) ctx.drawImage(full, 0, sy, full.width, sh, 0, 0, pageW, sh);
      shots.push(await shotFromCanvas(canvas, `${label} — p${i + 1}`));
    }
    return shots;
  } finally {
    host.remove();
  }
}

async function renderWord(file: File, dpi: number): Promise<CaptureShot[]> {
  let html: string;
  try {
    const mod = (await import("mammoth")) as unknown as {
      default?: { convertToHtml(input: { arrayBuffer: ArrayBuffer }): Promise<{ value: string }> };
      convertToHtml?: (input: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }>;
    };
    const mammoth = mod.default ?? mod;
    const convert = mammoth.convertToHtml;
    if (!convert) throw new Error("Word conversion is unavailable.");
    const result = await convert.call(mammoth, { arrayBuffer: await file.arrayBuffer() });
    html = result.value;
  } catch (err) {
    if (file.name.toLowerCase().endsWith(".doc")) {
      throw new Error("Legacy .doc files are not supported — save it as .docx and try again.");
    }
    throw err instanceof Error ? err : new Error("Could not read that Word document.");
  }
  if (!html.trim()) html = "<p>(This document appears to be empty.)</p>";
  return htmlToPageShots(html, dpi, baseName(file.name));
}

async function renderText(file: File, dpi: number): Promise<CaptureShot[]> {
  const raw = await file.text();
  const text = file.name.toLowerCase().endsWith(".rtf") ? rtfToText(raw) : raw;
  const html = `<pre>${escapeHtml(text)}</pre>`;
  return htmlToPageShots(html, dpi, baseName(file.name));
}

// --- Entry point -----------------------------------------------------------

/**
 * Render one or more uploaded files into page captures.
 *
 * Images become one page each. A PDF is rendered page by page and a Word or
 * text file is paginated automatically. Only the first document (non-image)
 * file is used; the requested page range is applied to whatever is produced.
 */
export async function importDocumentFiles(
  files: File[],
  options: DocumentImportOptions,
): Promise<DocumentImportResult> {
  if (files.length === 0) throw new Error("Choose a file to import.");

  const images = files.filter((f) => detectDocumentKind(f) === "image");
  const document = files.find((f) => detectDocumentKind(f) !== "image");
  const supported = images.length + (document ? 1 : 0);
  if (supported === 0) throw new Error("That file type is not supported.");

  if (document) {
    const kind = detectDocumentKind(document);
    if (kind === "pdf") {
      return renderPdf(document, options);
    }
    const shots = kind === "word" ? await renderWord(document, options.dpi) : await renderText(document, options.dpi);
    const { from, to } = clampRange(options.range, shots.length);
    return { shots: shots.slice(from - 1, to), totalPages: shots.length, kind: kind ?? "text" };
  }

  // Images only: every image is its own page.
  const shots = await Promise.all(images.map((file) => imageFileToShot(file)));
  const { from, to } = clampRange(options.range, shots.length);
  return { shots: shots.slice(from - 1, to), totalPages: shots.length, kind: "image" };
}

/**
 * Best-effort page count for the range controls. PDFs are probed and images
 * count one page each; Word and text documents only know their page count once
 * they have been rendered, so this returns null for them.
 */
export async function probePageCount(file: File): Promise<number | null> {
  const kind = detectDocumentKind(file);
  if (kind === "image") return 1;
  if (kind !== "pdf") return null;

  const pdfjs = await loadPdfJs();
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  const doc = await task.promise;
  const count = doc.numPages;
  await task.destroy();
  return count;
}

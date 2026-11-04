/**
 * Interactive PDF Form Fill & Sign Engine
 *
 * Renders PDF pages using pdfjs-dist and overlays interactive text,
 * date stamps, checkmarks, crosses, and vector digital signatures.
 * Flattens everything into a clean downloadable PDF.
 */

import { imagesToPdf, shotFromCanvas } from "./screenshot";

export type FillFieldType = "text" | "check" | "cross" | "date" | "signature";

export interface FillElement {
  id: string;
  pageIndex: number; // 0-based
  type: FillFieldType;
  xPercent: number; // 0 to 100% of page width
  yPercent: number; // 0 to 100% of page height
  text?: string;
  fontSize?: number; // e.g. 14, 16, 20
  color?: string; // e.g. '#000000', '#002B49', '#D32F2F'
  signatureDataUrl?: string; // transparent PNG data URL of drawn signature
  widthPercent?: number; // for signature scaling
  heightPercent?: number;
}

let pdfjsPromise: Promise<typeof import("pdfjs-dist")> | null = null;

export async function getPdfJs(): Promise<typeof import("pdfjs-dist")> {
  if (!pdfjsPromise) {
    pdfjsPromise = import("pdfjs-dist").then((pdfjs) => {
      if (typeof window !== "undefined") {
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      }
      return pdfjs;
    });
  }
  return pdfjsPromise;
}

/**
 * Load PDF file into a PDFDocumentProxy
 */
export async function loadPdfDocument(file: File) {
  const pdfjs = await getPdfJs();
  const buffer = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    cMapUrl: "https://unpkg.com/pdfjs-dist@4.10.38/cmaps/",
    cMapPacked: true,
  });
  return await loadingTask.promise;
}

/**
 * Render a specific PDF page onto a canvas
 */
export async function renderPdfPage(
  pdfDoc: any,
  pageIndex: number,
  canvas: HTMLCanvasElement,
  scale = 1.5
): Promise<{ width: number; height: number }> {
  const page = await pdfDoc.getPage(pageIndex + 1);
  const viewport = page.getViewport({ scale });

  canvas.width = viewport.width;
  canvas.height = viewport.height;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get 2D canvas context.");

  // Clear canvas with white background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const renderContext = {
    canvasContext: ctx,
    viewport: viewport,
  };

  await page.render(renderContext).promise;

  return { width: viewport.width, height: viewport.height };
}

/**
 * Draw all interactive fill/sign elements onto an overlay or export canvas
 */
export async function drawElementsOnCanvas(
  ctx: CanvasRenderingContext2D,
  elements: FillElement[],
  canvasWidth: number,
  canvasHeight: number
) {
  for (const el of elements) {
    const x = (el.xPercent / 100) * canvasWidth;
    const y = (el.yPercent / 100) * canvasHeight;

    ctx.save();

    if (el.type === "text" || el.type === "date") {
      const fontSize = el.fontSize || 16;
      ctx.font = `${fontSize}px "Segoe UI", Arial, sans-serif`;
      ctx.fillStyle = el.color || "#000000";
      ctx.textBaseline = "top";
      ctx.fillText(el.text || "", x, y);
    } else if (el.type === "check") {
      ctx.font = `bold 22px Arial, sans-serif`;
      ctx.fillStyle = el.color || "#002B49";
      ctx.textBaseline = "top";
      ctx.fillText("✓", x, y);
    } else if (el.type === "cross") {
      ctx.font = `bold 22px Arial, sans-serif`;
      ctx.fillStyle = el.color || "#D32F2F";
      ctx.textBaseline = "top";
      ctx.fillText("✗", x, y);
    } else if (el.type === "signature" && el.signatureDataUrl) {
      await new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = () => {
          const sigW = ((el.widthPercent || 25) / 100) * canvasWidth;
          const sigH = (sigW * img.height) / img.width;
          ctx.drawImage(img, x, y, sigW, sigH);
          resolve();
        };
        img.onerror = () => resolve();
        img.src = el.signatureDataUrl!;
      });
    }

    ctx.restore();
  }
}

/**
 * Generate a flattened multi-page PDF from the rendered pages and placed elements
 */
export async function exportFlattenedPdf(
  renderedPages: { canvas: HTMLCanvasElement; elements: FillElement[] }[]
): Promise<Blob> {
  const shots = [];

  for (let i = 0; i < renderedPages.length; i++) {
    const { canvas: baseCanvas, elements } = renderedPages[i];

    // Create high-res composite export canvas
    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = baseCanvas.width;
    exportCanvas.height = baseCanvas.height;
    const ctx = exportCanvas.getContext("2d");
    if (!ctx) continue;

    // Draw base PDF page
    ctx.drawImage(baseCanvas, 0, 0);

    // Draw all placed elements
    await drawElementsOnCanvas(ctx, elements, exportCanvas.width, exportCanvas.height);

    const shot = await shotFromCanvas(exportCanvas, `Page ${i + 1}`);
    shots.push(shot);
  }

  return await imagesToPdf(shots, {
    pageSize: "fit",
    orientation: "auto",
    margin: 0,
    quality: 0.95,
  });
}

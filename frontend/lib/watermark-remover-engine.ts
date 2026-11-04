/**
 * Smart Watermark & Object Eraser Engine
 *
 * Provides:
 * 1. Edge-contrast & high-frequency variance watermark detector
 * 2. High-speed content-aware inpainting using Fast Marching Telea reconstruction
 * 3. Dynamic bounding box calculation
 */

import { inpaintImageData } from "./inpainting";

export interface WatermarkDetectRegion {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
  label: string;
}

/**
 * Edge-contrast & high-frequency variance scanner.
 * Scans corners, bottom boundary, and center diagonal for high-contrast watermark text or logos.
 * Only returns regions that exhibit real edge variance above the image baseline.
 */
export function detectWatermarkRegions(sourceData: ImageData): WatermarkDetectRegion[] {
  const w = sourceData.width;
  const h = sourceData.height;
  const d = sourceData.data;
  const regions: WatermarkDetectRegion[] = [];

  // Helper to compute average edge gradient magnitude in a rectangle
  function measureEdgeDensity(rx: number, ry: number, rw: number, rh: number): number {
    let edgeSum = 0;
    let count = 0;
    const step = Math.max(2, Math.floor(Math.min(rw, rh) / 40));

    for (let y = ry + 1; y < ry + rh - 1; y += step) {
      for (let x = rx + 1; x < rx + rw - 1; x += step) {
        const idx = (y * w + x) * 4;
        const lum = 0.299 * d[idx] + 0.587 * d[idx + 1] + 0.114 * d[idx + 2];

        // Horizontal gradient
        const idxR = (y * w + (x + 1)) * 4;
        const lumR = 0.299 * d[idxR] + 0.587 * d[idxR + 1] + 0.114 * d[idxR + 2];

        // Vertical gradient
        const idxB = ((y + 1) * w + x) * 4;
        const lumB = 0.299 * d[idxB] + 0.587 * d[idxB + 1] + 0.114 * d[idxB + 2];

        const grad = Math.abs(lum - lumR) + Math.abs(lum - lumB);
        if (grad > 28) {
          edgeSum += grad;
        }
        count++;
      }
    }
    return count > 0 ? edgeSum / count : 0;
  }

  // Baseline variance across center neutral area
  const baseVariance = measureEdgeDensity(
    Math.round(w * 0.2),
    Math.round(h * 0.2),
    Math.round(w * 0.6),
    Math.round(h * 0.6)
  );

  // 1. Bottom-Right Date Stamp / Logo Zone
  const brW = Math.round(w * 0.28);
  const brH = Math.round(h * 0.12);
  const brX = w - brW - Math.round(w * 0.02);
  const brY = h - brH - Math.round(h * 0.02);
  const brDensity = measureEdgeDensity(brX, brY, brW, brH);

  if (brDensity > 14 && brDensity > baseVariance * 1.15) {
    const confidence = Math.min(0.96, 0.6 + (brDensity / 80) * 0.36);
    regions.push({
      x: brX,
      y: brY,
      width: brW,
      height: brH,
      confidence: Math.round(confidence * 100) / 100,
      label: "Bottom-Right Watermark / Stamp",
    });
  }

  // 2. Bottom-Left Camera Brand / Timestamp Zone
  const blW = Math.round(w * 0.25);
  const blH = Math.round(h * 0.1);
  const blX = Math.round(w * 0.02);
  const blY = h - blH - Math.round(h * 0.02);
  const blDensity = measureEdgeDensity(blX, blY, blW, blH);

  if (blDensity > 14 && blDensity > baseVariance * 1.15) {
    const confidence = Math.min(0.92, 0.55 + (blDensity / 80) * 0.35);
    regions.push({
      x: blX,
      y: blY,
      width: blW,
      height: blH,
      confidence: Math.round(confidence * 100) / 100,
      label: "Bottom-Left Timestamp / Logo",
    });
  }

  // 3. Center Diagonal Watermark
  const cW = Math.round(w * 0.45);
  const cH = Math.round(h * 0.22);
  const cX = Math.round((w - cW) / 2);
  const cY = Math.round((h - cH) / 2);
  const cDensity = measureEdgeDensity(cX, cY, cW, cH);

  if (cDensity > 22 && cDensity > baseVariance * 1.35) {
    const confidence = Math.min(0.94, 0.6 + (cDensity / 90) * 0.34);
    regions.push({
      x: cX,
      y: cY,
      width: cW,
      height: cH,
      confidence: Math.round(confidence * 100) / 100,
      label: "Center Overlay Watermark",
    });
  }

  return regions;
}

/**
 * Executes clean inpainting removal on the masked areas.
 */
export async function removeWatermark(
  sourceCanvas: HTMLCanvasElement,
  maskCanvas: HTMLCanvasElement,
  onProgress?: (percent: number) => void
): Promise<ImageData> {
  const ctx = sourceCanvas.getContext("2d");
  const maskCtx = maskCanvas.getContext("2d");
  if (!ctx || !maskCtx) throw new Error("Could not acquire 2D canvas context");

  const w = sourceCanvas.width;
  const h = sourceCanvas.height;

  const srcData = ctx.getImageData(0, 0, w, h);
  const maskData = maskCtx.getImageData(0, 0, w, h);

  const result = await inpaintImageData(srcData, maskData, {
    radius: 6,
    blendTexture: true,
    onProgress,
  });

  return result;
}

/**
 * Social Carousel Slicer & Grid Splitter Engine
 * Slices panoramic photos into seamless swipe carousels (1:1, 4:5, 9:16)
 * and profile grid tiles (3x1, 3x2, 3x3) with sequential numbering and ZIP export.
 */

import { createZip, type ZipEntry } from "./zip";

export type SplitMode = "carousel" | "grid";
export type AspectRatioPreset = "1:1" | "4:5" | "16:9" | "9:16" | "original";

export interface CarouselOptions {
  slides: number; // 2 to 10
  aspectRatio: AspectRatioPreset;
  format: "jpeg" | "png" | "webp";
  quality: number; // 0.1 to 1.0
  smartFocalCrop?: boolean; // AI shifts cutlines to avoid slicing through faces/people
}

export interface GridOptions {
  rows: number; // 1 to 6
  cols: number; // 1 to 6 (default 3 for Instagram)
  format: "jpeg" | "png" | "webp";
  quality: number; // 0.1 to 1.0
  instagramOrder: boolean; // number bottom-to-top, right-to-left for chronological feed upload
}

export interface SlicedTile {
  index: number;
  filename: string;
  blob: Blob;
  previewUrl: string;
  width: number;
  height: number;
  cropRect: { x: number; y: number; width: number; height: number }; // normalized 0 to 1
}

/** Get width/height ratio from preset */
export function getAspectRatioMultiplier(preset: AspectRatioPreset): number | null {
  switch (preset) {
    case "1:1":
      return 1.0;
    case "4:5":
      return 4 / 5; // 0.8
    case "16:9":
      return 16 / 9; // 1.777
    case "9:16":
      return 9 / 16; // 0.5625
    case "original":
    default:
      return null;
  }
}

/**
 * Detect horizontal focal subject zones (faces & people) to protect against cutline bisection.
 */
export function detectFocalZones(img: HTMLImageElement): { minX: number; maxX: number }[] {
  const canvas = document.createElement("canvas");
  const sampleW = 200;
  const sampleH = Math.round((img.naturalHeight / img.naturalWidth) * sampleW);
  canvas.width = sampleW;
  canvas.height = sampleH;
  const ctx = canvas.getContext("2d");
  if (!ctx) return [];

  ctx.drawImage(img, 0, 0, sampleW, sampleH);
  const data = ctx.getImageData(0, 0, sampleW, sampleH).data;

  // Compute column energy & skin presence
  const colScores = new Float32Array(sampleW);
  for (let x = 0; x < sampleW; x++) {
    let score = 0;
    for (let y = Math.floor(sampleH * 0.15); y < Math.floor(sampleH * 0.85); y++) {
      const idx = (y * sampleW + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];

      // Skin detection
      if (r > 95 && g > 40 && b > 20 && r > g && r > b && (r - g) > 15) {
        score += 2.0;
      }
      // Edge contrast
      if (x < sampleW - 1) {
        const nextIdx = (y * sampleW + x + 1) * 4;
        score += (Math.abs(r - data[nextIdx]) + Math.abs(g - data[nextIdx + 1])) * 0.05;
      }
    }
    colScores[x] = score;
  }

  // Find high-density regions (focal zones)
  const zones: { minX: number; maxX: number }[] = [];
  const threshold = (colScores.reduce((a, b) => a + b, 0) / sampleW) * 1.35;
  let inZone = false;
  let startX = 0;

  for (let x = 0; x < sampleW; x++) {
    if (colScores[x] > threshold && !inZone) {
      inZone = true;
      startX = x;
    } else if (colScores[x] <= threshold && inZone) {
      inZone = false;
      if (x - startX > 6) {
        zones.push({
          minX: (startX / sampleW) * img.naturalWidth,
          maxX: (x / sampleW) * img.naturalWidth,
        });
      }
    }
  }

  return zones;
}

/**
 * Slice an image horizontally into N seamless carousel slides.
 */
export async function sliceCarousel(
  img: HTMLImageElement,
  options: CarouselOptions,
  baseFilename = "carousel",
): Promise<SlicedTile[]> {
  const imgW = img.naturalWidth;
  const imgH = img.naturalHeight;
  const n = Math.max(2, Math.min(10, options.slides));

  const ratio = getAspectRatioMultiplier(options.aspectRatio);
  let sliceW = Math.floor(imgW / n);
  let sliceH = imgH;

  let startY = 0;
  let cropH = imgH;

  if (ratio !== null) {
    // Height determined by aspect ratio: W / H = ratio => H = W / ratio
    const targetH = Math.round(sliceW / ratio);
    if (targetH <= imgH) {
      cropH = targetH;
      startY = Math.floor((imgH - targetH) / 2); // vertically centered
      sliceH = targetH;
    } else {
      // Image is not tall enough, constrain slice width instead
      sliceH = imgH;
      sliceW = Math.round(imgH * ratio);
    }
  }

  // Calculate cutline positions
  const cutlines: number[] = [];
  for (let i = 0; i < n; i++) {
    cutlines.push(Math.floor(i * (imgW / n)));
  }

  // If Smart Focal Crop enabled, shift cutlines that bisect focal zones
  if (options.smartFocalCrop) {
    const focalZones = detectFocalZones(img);
    for (let i = 1; i < n; i++) {
      const cut = cutlines[i];
      for (const zone of focalZones) {
        // If cutline slices through a focal subject with margin
        const margin = (zone.maxX - zone.minX) * 0.15;
        if (cut > zone.minX - margin && cut < zone.maxX + margin) {
          // Nudge cutline to nearest boundary outside subject
          const distToLeft = Math.abs(cut - zone.minX);
          const distToRight = Math.abs(cut - zone.maxX);
          if (distToLeft < distToRight) {
            cutlines[i] = Math.max(cutlines[i - 1] + 50, Math.floor(zone.minX - margin));
          } else {
            cutlines[i] = Math.min(imgW - 50, Math.ceil(zone.maxX + margin));
          }
        }
      }
    }
  }

  const mime =
    options.format === "png"
      ? "image/png"
      : options.format === "webp"
        ? "image/webp"
        : "image/jpeg";
  const ext = options.format === "jpeg" ? "jpg" : options.format;

  const tiles: SlicedTile[] = [];

  for (let i = 0; i < n; i++) {
    const startX = cutlines[i];
    const canvas = document.createElement("canvas");
    canvas.width = sliceW;
    canvas.height = sliceH;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not create canvas context");

    ctx.drawImage(img, startX, startY, sliceW, sliceH, 0, 0, sliceW, sliceH);

    const pad = String(i + 1).padStart(2, "0");
    const filename = `${baseFilename}-slide-${pad}.${ext}`;

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Failed to export tile"))),
        mime,
        options.quality,
      );
    });

    tiles.push({
      index: i + 1,
      filename,
      blob,
      previewUrl: URL.createObjectURL(blob),
      width: sliceW,
      height: sliceH,
      cropRect: {
        x: startX / imgW,
        y: startY / imgH,
        width: sliceW / imgW,
        height: sliceH / imgH,
      },
    });
  }

  return tiles;
}

/**
 * Slice an image into a Rows x Cols profile grid.
 */
export async function sliceGrid(
  img: HTMLImageElement,
  options: GridOptions,
  baseFilename = "grid",
): Promise<SlicedTile[]> {
  const imgW = img.naturalWidth;
  const imgH = img.naturalHeight;
  const rows = Math.max(1, Math.min(6, options.rows));
  const cols = Math.max(1, Math.min(6, options.cols));

  const tileW = Math.floor(imgW / cols);
  const tileH = Math.floor(imgH / rows);

  const mime =
    options.format === "png"
      ? "image/png"
      : options.format === "webp"
        ? "image/webp"
        : "image/jpeg";
  const ext = options.format === "jpeg" ? "jpg" : options.format;

  const rawTiles: {
    r: number;
    c: number;
    blob: Blob;
    previewUrl: string;
    width: number;
    height: number;
    cropRect: { x: number; y: number; width: number; height: number };
  }[] = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const startX = c * tileW;
      const startY = r * tileH;

      const canvas = document.createElement("canvas");
      canvas.width = tileW;
      canvas.height = tileH;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Could not create canvas context");

      ctx.drawImage(img, startX, startY, tileW, tileH, 0, 0, tileW, tileH);

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("Failed to export grid tile"))),
          mime,
          options.quality,
        );
      });

      rawTiles.push({
        r,
        c,
        blob,
        previewUrl: URL.createObjectURL(blob),
        width: tileW,
        height: tileH,
        cropRect: {
          x: startX / imgW,
          y: startY / imgH,
          width: tileW / imgW,
          height: tileH / imgH,
        },
      });
    }
  }

  // Instagram upload order:
  // Post bottom row first (right to left), so top-left ends up newest!
  if (options.instagramOrder) {
    rawTiles.sort((a, b) => {
      if (a.r !== b.r) return b.r - a.r; // higher row index (bottom) first
      return b.c - a.c; // higher column index (right) first
    });
  }

  return rawTiles.map((item, idx) => {
    const pad = String(idx + 1).padStart(2, "0");
    const suffix = options.instagramOrder ? `-post-${pad}` : `-r${item.r + 1}-c${item.c + 1}`;
    return {
      index: idx + 1,
      filename: `${baseFilename}${suffix}.${ext}`,
      blob: item.blob,
      previewUrl: item.previewUrl,
      width: item.width,
      height: item.height,
      cropRect: item.cropRect,
    };
  });
}

/** Bundle sliced tiles into downloadable ZIP */
export async function bundleTilesZip(tiles: SlicedTile[]): Promise<Blob> {
  const entries: ZipEntry[] = tiles.map((t) => ({
    name: t.filename,
    blob: t.blob,
  }));
  return createZip(entries);
}

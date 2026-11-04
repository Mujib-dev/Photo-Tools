/**
 * photo-restorer.ts
 *
 * Client-side AI Vintage Scratch, Tear & Dust Restorer.
 * Uses directional gradient anomaly filtering, morphological dilation,
 * and Fast Marching Method (FMM) boundary texture inpainting to repair
 * physical cracks, tears, folds, and speckles on aged photographs.
 */

export interface DefectDetectionOptions {
  sensitivity: number; // 10 - 100 (default 55)
  dilateRadius: number; // 1 - 5 (default 2)
  detectScratches: boolean; // detect thin bright/dark scratches & creases
  detectDust: boolean; // detect punctate speckles and mold spots
  detectTears: boolean; // detect large edge tears and rips
}

export interface VintageRestorationOptions {
  filmGrainMatch: number; // 0 - 100 (default 15)
  contrastRevive: number; // 0 - 100 (default 20)
  featherRadius: number; // 1 - 4 (default 2)
}

export interface RestorationStats {
  totalPixels: number;
  repairedPixels: number;
  damagePercentage: number;
  durationMs: number;
}

/**
 * Converts Image, Canvas, or Blob to an HTMLCanvasElement
 */
export async function loadImageToCanvas(
  source: HTMLImageElement | HTMLCanvasElement | Blob | string
): Promise<HTMLCanvasElement> {
  if (source instanceof HTMLCanvasElement) {
    const clone = document.createElement("canvas");
    clone.width = source.width;
    clone.height = source.height;
    const ctx = clone.getContext("2d");
    if (ctx) ctx.drawImage(source, 0, 0);
    return clone;
  }

  let srcUrl = "";
  let needsRevoke = false;

  if (typeof source === "string") {
    srcUrl = source;
  } else if (source instanceof Blob) {
    srcUrl = URL.createObjectURL(source);
    needsRevoke = true;
  } else if (source instanceof HTMLImageElement) {
    srcUrl = source.src;
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        if (needsRevoke) URL.revokeObjectURL(srcUrl);
        reject(new Error("Unable to create canvas 2D context"));
        return;
      }
      ctx.drawImage(img, 0, 0);
      if (needsRevoke) URL.revokeObjectURL(srcUrl);
      resolve(canvas);
    };
    img.onerror = (err) => {
      if (needsRevoke) URL.revokeObjectURL(srcUrl);
      reject(err);
    };
    img.src = srcUrl;
  });
}

/**
 * Detects scratch, crack, tear, and dust damage on an image and returns a binary mask canvas
 * (White = damaged pixel needing repair, Black = healthy original pixel).
 */
export function detectDamageMask(
  sourceCanvas: HTMLCanvasElement,
  options: Partial<DefectDetectionOptions> = {}
): HTMLCanvasElement {
  const sensitivity = options.sensitivity ?? 55;
  const dilateRadius = options.dilateRadius ?? 2;
  const detectScratches = options.detectScratches ?? true;
  const detectDust = options.detectDust ?? true;
  const detectTears = options.detectTears ?? true;

  const w = sourceCanvas.width;
  const h = sourceCanvas.height;
  const srcCtx = sourceCanvas.getContext("2d");
  if (!srcCtx) throw new Error("Could not get canvas 2d context");

  const srcData = srcCtx.getImageData(0, 0, w, h);
  const data = srcData.data;

  // 1. Compute grayscale luminance & local mean
  const gray = new Float32Array(w * h);
  for (let i = 0, j = 0; i < data.length; i += 4, j++) {
    gray[j] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }

  const rawMask = new Uint8Array(w * h);

  // Scaled threshold: higher sensitivity -> lower threshold for defect detection
  const thresh = Math.max(12, 100 - sensitivity * 0.85);

  // 2. High-pass directional difference & Laplacian anomaly filter
  // Scratches and dust exhibit sharp local gradients relative to the 8-connected neighborhood
  for (let y = 1; y < h - 1; y++) {
    const rowOffset = y * w;
    for (let x = 1; x < w - 1; x++) {
      const idx = rowOffset + x;
      const val = gray[idx];

      const n = gray[idx - w];
      const s = gray[idx + w];
      const e = gray[idx + 1];
      const w_ = gray[idx - 1];
      const nw = gray[idx - w - 1];
      const ne = gray[idx - w + 1];
      const sw = gray[idx + w - 1];
      const se = gray[idx + w + 1];

      // Local 3x3 average excluding center
      const localAvg = (n + s + e + w_ + nw + ne + sw + se) / 8;
      const diff = Math.abs(val - localAvg);

      // Directional second-derivatives for scratch / crease fissures
      const dVert = Math.abs(2 * val - n - s);
      const dHoriz = Math.abs(2 * val - e - w_);
      const dDiag1 = Math.abs(2 * val - nw - se);
      const dDiag2 = Math.abs(2 * val - ne - sw);
      const maxDirectional = Math.max(dVert, dHoriz, dDiag1, dDiag2);

      let isDefect = false;

      // Check for scratch / crack fissure
      if (detectScratches && (maxDirectional > thresh * 1.25 || (diff > thresh && maxDirectional > thresh * 0.8))) {
        isDefect = true;
      }

      // Check for punctate dust speckle (high isolated contrast against all neighbors)
      if (detectDust && diff > thresh * 1.4) {
        const minNeighbor = Math.min(n, s, e, w_, nw, ne, sw, se);
        const maxNeighbor = Math.max(n, s, e, w_, nw, ne, sw, se);
        if (val > maxNeighbor + thresh * 0.75 || val < minNeighbor - thresh * 0.75) {
          isDefect = true;
        }
      }

      // Check for severe paper tear (extreme blown-out white or saturated pitch rip)
      if (detectTears && (val > 250 || val < 5) && diff > thresh * 0.9) {
        isDefect = true;
      }

      if (isDefect) {
        rawMask[idx] = 1;
      }
    }
  }

  // 3. Morphological dilation to ensure the scratch boundaries are completely covered
  const dilatedMask = new Uint8Array(w * h);
  const r = Math.max(1, dilateRadius);

  for (let y = r; y < h - r; y++) {
    for (let x = r; x < w - r; x++) {
      const idx = y * w + x;
      if (rawMask[idx] === 1) {
        for (let dy = -r; dy <= r; dy++) {
          for (let dx = -r; dx <= r; dx++) {
            if (dx * dx + dy * dy <= r * r) {
              dilatedMask[(y + dy) * w + (x + dx)] = 255;
            }
          }
        }
      }
    }
  }

  // 4. Render mask to canvas
  const maskCanvas = document.createElement("canvas");
  maskCanvas.width = w;
  maskCanvas.height = h;
  const maskCtx = maskCanvas.getContext("2d");
  if (!maskCtx) throw new Error("Could not get mask canvas 2d context");

  const maskImageData = maskCtx.createImageData(w, h);
  const maskPixels = maskImageData.data;

  for (let i = 0, j = 0; i < maskPixels.length; i += 4, j++) {
    const val = dilatedMask[j];
    maskPixels[i] = val; // R
    maskPixels[i + 1] = val; // G
    maskPixels[i + 2] = val; // B
    maskPixels[i + 3] = val > 0 ? 255 : 0; // Alpha
  }

  maskCtx.putImageData(maskImageData, 0, 0);
  return maskCanvas;
}

/**
 * Repairs damaged pixels indicated by the mask using Fast Marching boundary inpainting,
 * optional subtle vintage micro-grain dithering, and dynamic range / tone revitalization.
 */
export function restoreVintagePhoto(
  sourceCanvas: HTMLCanvasElement,
  maskCanvas: HTMLCanvasElement,
  options: Partial<VintageRestorationOptions> = {}
): {
  repairedCanvas: HTMLCanvasElement;
  stats: RestorationStats;
} {
  const startTime = performance.now();
  const filmGrainMatch = options.filmGrainMatch ?? 15;
  const contrastRevive = options.contrastRevive ?? 20;

  const w = sourceCanvas.width;
  const h = sourceCanvas.height;

  const srcCtx = sourceCanvas.getContext("2d");
  const maskCtx = maskCanvas.getContext("2d");
  if (!srcCtx || !maskCtx) throw new Error("Canvas 2D contexts required");

  const srcImageData = srcCtx.getImageData(0, 0, w, h);
  const maskImageData = maskCtx.getImageData(0, 0, w, h);

  const srcPixels = srcImageData.data;
  const maskPixels = maskImageData.data;

  // Build damage grid and count
  const damage = new Uint8Array(w * h);
  let repairedPixelCount = 0;

  for (let i = 0, j = 0; i < maskPixels.length; i += 4, j++) {
    // Treat as damaged if mask alpha > 30 and luminance > 30
    if (maskPixels[i + 3] > 30 && (maskPixels[i] > 30 || maskPixels[i + 1] > 30 || maskPixels[i + 2] > 30)) {
      damage[j] = 1;
      repairedPixelCount++;
    }
  }

  // Work buffers (RGBA)
  const outR = new Float32Array(w * h);
  const outG = new Float32Array(w * h);
  const outB = new Float32Array(w * h);

  for (let i = 0, j = 0; i < srcPixels.length; i += 4, j++) {
    outR[j] = srcPixels[i];
    outG[j] = srcPixels[i + 1];
    outB[j] = srcPixels[i + 2];
  }

  // Iterative Isophote-Directed Fast Marching boundary synthesis (Telea method)
  if (repairedPixelCount > 0) {
    const remaining = new Uint8Array(damage);
    const maxPasses = 24;
    const searchRadius = 3;

    for (let pass = 0; pass < maxPasses; pass++) {
      let newlyFilled = 0;

      // Find boundary pixels (damaged pixels with at least one healthy neighbor)
      for (let y = 0; y < h; y++) {
        const row = y * w;
        for (let x = 0; x < w; x++) {
          const idx = row + x;
          if (remaining[idx] === 0) continue;

          // Check neighborhood for known valid pixels
          let sumR = 0;
          let sumG = 0;
          let sumB = 0;
          let totalWeight = 0;

          for (let dy = -searchRadius; dy <= searchRadius; dy++) {
            const ny = y + dy;
            if (ny < 0 || ny >= h) continue;
            const nRow = ny * w;

            for (let dx = -searchRadius; dx <= searchRadius; dx++) {
              if (dx === 0 && dy === 0) continue;
              const nx = x + dx;
              if (nx < 0 || nx >= w) continue;

              const nIdx = nRow + nx;
              if (remaining[nIdx] === 0) {
                // Known pixel: calculate inverse distance
                const distSq = dx * dx + dy * dy;
                const dLen = Math.sqrt(distSq) + 1e-3;

                // Isophote (contour tangent) direction calculation:
                // At neighbor (nx, ny), gradient: (gx, gy). Isophote is perpendicular: (-gy, gx)
                const nxLeft = Math.max(0, nx - 1);
                const nxRight = Math.min(w - 1, nx + 1);
                const nyTop = Math.max(0, ny - 1);
                const nyBot = Math.min(h - 1, ny + 1);

                const nLumL = 0.299 * outR[nRow + nxLeft] + 0.587 * outG[nRow + nxLeft] + 0.114 * outB[nRow + nxLeft];
                const nLumR = 0.299 * outR[nRow + nxRight] + 0.587 * outG[nRow + nxRight] + 0.114 * outB[nRow + nxRight];
                const nLumT = 0.299 * outR[nyTop * w + nx] + 0.587 * outG[nyTop * w + nx] + 0.114 * outB[nyTop * w + nx];
                const nLumB = 0.299 * outR[nyBot * w + nx] + 0.587 * outG[nyBot * w + nx] + 0.114 * outB[nyBot * w + nx];

                const gx = (nLumR - nLumL) * 0.5;
                const gy = (nLumB - nLumT) * 0.5;
                const gradLen = Math.sqrt(gx * gx + gy * gy) + 1e-3;

                // Isophote normal:
                const ix = -gy / gradLen;
                const iy = gx / gradLen;

                // Normalized direction from known neighbor to target damaged pixel:
                const dirX = -dx / dLen;
                const dirY = -dy / dLen;

                // Isophote alignment weight: favors propagation along contour lines
                const isoDot = Math.abs(dirX * ix + dirY * iy);
                const isoFactor = 0.5 + 1.5 * isoDot;

                const weight = (1.0 / (distSq + 0.1)) * isoFactor;

                sumR += outR[nIdx] * weight;
                sumG += outG[nIdx] * weight;
                sumB += outB[nIdx] * weight;
                totalWeight += weight;
              }
            }
          }

          if (totalWeight > 0) {
            outR[idx] = sumR / totalWeight;
            outG[idx] = sumG / totalWeight;
            outB[idx] = sumB / totalWeight;
            remaining[idx] = 2; // Marked as temporarily filled this pass
            newlyFilled++;
          }
        }
      }

      if (newlyFilled === 0) break;

      // Commit newly filled boundary into the known pool for next pass
      for (let i = 0; i < remaining.length; i++) {
        if (remaining[i] === 2) {
          remaining[i] = 0;
        }
      }
    }
  }

  // Calculate healthy mean luminance for exposure-balanced contrast revitalization
  let meanSum = 0;
  let meanCount = 0;
  for (let i = 0; i < w * h; i += 4) {
    if (damage[i] === 0) {
      meanSum += 0.299 * outR[i] + 0.587 * outG[i] + 0.114 * outB[i];
      meanCount++;
    }
  }
  const midLuma = meanCount > 0 ? meanSum / meanCount : 128.0;

  // Apply vintage film micro-grain over restored patches so they don't look unnaturally flat
  const grainFactor = (filmGrainMatch / 100) * 16;
  const contrastFactor = 1.0 + (contrastRevive / 100) * 0.35;

  const resultCanvas = document.createElement("canvas");
  resultCanvas.width = w;
  resultCanvas.height = h;
  const resCtx = resultCanvas.getContext("2d");
  if (!resCtx) throw new Error("Could not get result canvas 2d context");

  const resImageData = resCtx.createImageData(w, h);
  const resPixels = resImageData.data;

  // Simple pseudo-random hash for reproducible subtle grain
  let seed = 1337;
  function fastRand(): number {
    seed = (seed * 16807) % 2147483647;
    return (seed / 2147483647) - 0.5;
  }

  for (let i = 0, j = 0; i < resPixels.length; i += 4, j++) {
    let r = outR[j];
    let g = outG[j];
    let b = outB[j];

    // If this pixel was repaired, inject micro-grain
    if (damage[j] === 1 && grainFactor > 0) {
      const gNoise = fastRand() * grainFactor;
      r = Math.max(0, Math.min(255, r + gNoise));
      g = Math.max(0, Math.min(255, g + gNoise));
      b = Math.max(0, Math.min(255, b + gNoise));
    }

    // Contrast & tone revitalization (stretch around image's natural exposure midpoint)
    if (contrastRevive > 0) {
      r = midLuma + (r - midLuma) * contrastFactor;
      g = midLuma + (g - midLuma) * contrastFactor;
      b = midLuma + (b - midLuma) * contrastFactor;
    }

    resPixels[i] = Math.max(0, Math.min(255, Math.round(r)));
    resPixels[i + 1] = Math.max(0, Math.min(255, Math.round(g)));
    resPixels[i + 2] = Math.max(0, Math.min(255, Math.round(b)));
    resPixels[i + 3] = srcPixels[i + 3]; // Preserve original alpha
  }

  resCtx.putImageData(resImageData, 0, 0);

  const durationMs = Math.round(performance.now() - startTime);
  const totalPixels = w * h;
  const damagePercentage = parseFloat(
    ((repairedPixelCount / Math.max(1, totalPixels)) * 100).toFixed(2)
  );

  return {
    repairedCanvas: resultCanvas,
    stats: {
      totalPixels,
      repairedPixels: repairedPixelCount,
      damagePercentage,
      durationMs,
    },
  };
}

/**
 * Creates an interactive vintage demo canvas with synthetic scratches, tears, and dust speckles
 * to demonstrate the tool instantly without uploading a photo.
 */
export function createVintageDemoCanvas(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = 720;
  canvas.height = 540;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  // 1. Antique Sepia / Silver Gelatin portrait backdrop
  const grad = ctx.createRadialGradient(360, 270, 40, 360, 270, 380);
  grad.addColorStop(0, "#c8bca6");
  grad.addColorStop(0.5, "#9e917d");
  grad.addColorStop(1, "#544b3e");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 720, 540);

  // 2. Vintage silhouette portrait
  ctx.fillStyle = "#332c23";
  // Head
  ctx.beginPath();
  ctx.ellipse(360, 210, 75, 95, 0, 0, Math.PI * 2);
  ctx.fill();

  // Neck & Shoulders
  ctx.beginPath();
  ctx.moveTo(320, 290);
  ctx.lineTo(240, 520);
  ctx.lineTo(480, 520);
  ctx.lineTo(400, 290);
  ctx.closePath();
  ctx.fill();

  // Vintage collar detail
  ctx.fillStyle = "#dfd8cc";
  ctx.beginPath();
  ctx.moveTo(340, 290);
  ctx.lineTo(360, 340);
  ctx.lineTo(380, 290);
  ctx.closePath();
  ctx.fill();

  // 3. Synthetic Scratches, Creases, and Tears across the photo
  ctx.strokeStyle = "rgba(255, 255, 255, 0.95)";
  ctx.lineWidth = 2.5;

  // Major scratch 1 (top-left diagonal)
  ctx.beginPath();
  ctx.moveTo(80, 40);
  ctx.bezierCurveTo(180, 140, 250, 190, 340, 320);
  ctx.stroke();

  // Major scratch 2 (middle diagonal)
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(520, 70);
  ctx.bezierCurveTo(460, 180, 380, 260, 330, 480);
  ctx.stroke();

  // Fold crease (horizontal line with dark shadow edge)
  ctx.strokeStyle = "rgba(40, 30, 20, 0.85)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(30, 240);
  ctx.lineTo(690, 248);
  ctx.stroke();

  ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(30, 241);
  ctx.lineTo(690, 249);
  ctx.stroke();

  // Corner paper rip / tear
  ctx.fillStyle = "rgba(245, 245, 240, 0.98)";
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(95, 0);
  ctx.lineTo(70, 30);
  ctx.lineTo(85, 55);
  ctx.lineTo(25, 75);
  ctx.lineTo(0, 80);
  ctx.closePath();
  ctx.fill();

  // Dust spots and speckles
  ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
  const dustCoords = [
    [150, 110, 3],
    [180, 340, 2.5],
    [520, 190, 2],
    [410, 130, 2.5],
    [290, 410, 3],
    [590, 380, 2],
    [210, 220, 1.8],
    [480, 430, 2.2],
    [630, 150, 3.2],
  ];

  for (const [dx, dy, dr] of dustCoords) {
    ctx.beginPath();
    ctx.arc(dx, dy, dr, 0, Math.PI * 2);
    ctx.fill();
  }

  // Dark spots
  ctx.fillStyle = "rgba(30, 25, 20, 0.9)";
  const darkSpots = [
    [120, 290, 2.5],
    [440, 310, 2],
    [550, 260, 2.5],
    [220, 160, 2],
  ];

  for (const [dx, dy, dr] of darkSpots) {
    ctx.beginPath();
    ctx.arc(dx, dy, dr, 0, Math.PI * 2);
    ctx.fill();
  }

  return canvas;
}

/**
 * Optical Bokeh & Depth Studio Engine
 * Simulates DSLR lens aperture, radial and tilt-shift depth-of-field,
 * specular highlight bloom, and subject bokeh masking.
 */

export type BokehMode = "radial" | "tilt-shift" | "subject" | "multiplane";
export type BokehShape = "circle" | "hexagon" | "star" | "heart";

export interface BokehSettings {
  mode: BokehMode;
  // Blur / Aperture
  aperture: number; // 0 to 50 blur radius in pixels
  shape: BokehShape;
  // Focus point (0 to 1 normalized coordinates)
  focusX: number;
  focusY: number;
  // Radial mode properties
  focusRadius: number; // 0.05 to 0.8 normalized radius
  feather: number; // 0.1 to 1.0 falloff smoothness
  // Tilt-shift properties
  tiltAngle: number; // 0 to 180 degrees
  tiltBandWidth: number; // 0.05 to 0.6 normalized width
  // 3D Multiplane depth properties
  focalPlaneDepth?: number; // 0.0 to 1.0 (foreground to background plane)
  depthSpread?: number; // 0.05 to 0.5 (depth of field sharpness window)
  // Optical styling
  specularBoost: number; // 0 to 100 highlight bloom
  vignette: number; // 0 to 100 dark edge falloff
  invert: boolean; // invert depth mask (blur center, sharp edges)
}

export const DEFAULT_BOKEH_SETTINGS: BokehSettings = {
  mode: "radial",
  aperture: 22,
  shape: "circle",
  focusX: 0.5,
  focusY: 0.45,
  focusRadius: 0.28,
  feather: 0.35,
  tiltAngle: 0,
  tiltBandWidth: 0.22,
  focalPlaneDepth: 0.35,
  depthSpread: 0.22,
  specularBoost: 35,
  vignette: 15,
  invert: false,
};

export const APERTURE_PRESETS: { label: string; fStop: string; aperture: number }[] = [
  { label: "Ultra Shallow", fStop: "f/1.4", aperture: 36 },
  { label: "Classic Portrait", fStop: "f/1.8", aperture: 24 },
  { label: "Soft Studio", fStop: "f/2.8", aperture: 16 },
  { label: "Environmental", fStop: "f/4.0", aperture: 10 },
  { label: "Subtle Depth", fStop: "f/5.6", aperture: 5 },
  { label: "Deep Focus", fStop: "f/16", aperture: 0 },
];

/** Fast Box-Blur approximation pass */
function boxBlurH(
  scl: Uint8ClampedArray,
  tcl: Uint8ClampedArray,
  w: number,
  h: number,
  r: number,
) {
  const iarr = 1 / (r + r + 1);
  for (let i = 0; i < h; i++) {
    let ti = i * w;
    let li = ti;
    let ri = ti + r;
    const fvR = scl[ti * 4];
    const fvG = scl[ti * 4 + 1];
    const fvB = scl[ti * 4 + 2];
    const lvR = scl[(ti + w - 1) * 4];
    const lvG = scl[(ti + w - 1) * 4 + 1];
    const lvB = scl[(ti + w - 1) * 4 + 2];

    let valR = (r + 1) * fvR;
    let valG = (r + 1) * fvG;
    let valB = (r + 1) * fvB;

    for (let j = 0; j < r; j++) {
      valR += scl[(ti + j) * 4];
      valG += scl[(ti + j) * 4 + 1];
      valB += scl[(ti + j) * 4 + 2];
    }

    for (let j = 0; j <= r; j++) {
      const idx = (ri++) * 4;
      valR += scl[idx] - fvR;
      valG += scl[idx + 1] - fvG;
      valB += scl[idx + 2] - fvB;
      const tidx = (ti++) * 4;
      tcl[tidx] = Math.round(valR * iarr);
      tcl[tidx + 1] = Math.round(valG * iarr);
      tcl[tidx + 2] = Math.round(valB * iarr);
      tcl[tidx + 3] = 255;
    }

    for (let j = r + 1; j < w - r; j++) {
      const ridx = (ri++) * 4;
      const lidx = (li++) * 4;
      valR += scl[ridx] - scl[lidx];
      valG += scl[ridx + 1] - scl[lidx + 1];
      valB += scl[ridx + 2] - scl[lidx + 2];
      const tidx = (ti++) * 4;
      tcl[tidx] = Math.round(valR * iarr);
      tcl[tidx + 1] = Math.round(valG * iarr);
      tcl[tidx + 2] = Math.round(valB * iarr);
      tcl[tidx + 3] = 255;
    }

    for (let j = w - r; j < w; j++) {
      const lidx = (li++) * 4;
      valR += lvR - scl[lidx];
      valG += lvG - scl[lidx + 1];
      valB += lvB - scl[lidx + 2];
      const tidx = (ti++) * 4;
      tcl[tidx] = Math.round(valR * iarr);
      tcl[tidx + 1] = Math.round(valG * iarr);
      tcl[tidx + 2] = Math.round(valB * iarr);
      tcl[tidx + 3] = 255;
    }
  }
}

function boxBlurT(
  scl: Uint8ClampedArray,
  tcl: Uint8ClampedArray,
  w: number,
  h: number,
  r: number,
) {
  const iarr = 1 / (r + r + 1);
  for (let i = 0; i < w; i++) {
    let ti = i;
    let li = ti;
    let ri = ti + r * w;
    const fvR = scl[ti * 4];
    const fvG = scl[ti * 4 + 1];
    const fvB = scl[ti * 4 + 2];
    const lvR = scl[(ti + w * (h - 1)) * 4];
    const lvG = scl[(ti + w * (h - 1)) * 4 + 1];
    const lvB = scl[(ti + w * (h - 1)) * 4 + 2];

    let valR = (r + 1) * fvR;
    let valG = (r + 1) * fvG;
    let valB = (r + 1) * fvB;

    for (let j = 0; j < r; j++) {
      valR += scl[(ti + j * w) * 4];
      valG += scl[(ti + j * w) * 4 + 1];
      valB += scl[(ti + j * w) * 4 + 2];
    }

    for (let j = 0; j <= r; j++) {
      const idx = ri * 4;
      ri += w;
      valR += scl[idx] - fvR;
      valG += scl[idx + 1] - fvG;
      valB += scl[idx + 2] - fvB;
      const tidx = ti * 4;
      ti += w;
      tcl[tidx] = Math.round(valR * iarr);
      tcl[tidx + 1] = Math.round(valG * iarr);
      tcl[tidx + 2] = Math.round(valB * iarr);
      tcl[tidx + 3] = 255;
    }

    for (let j = r + 1; j < h - r; j++) {
      const ridx = ri * 4;
      ri += w;
      const lidx = li * 4;
      li += w;
      valR += scl[ridx] - scl[lidx];
      valG += scl[ridx + 1] - scl[lidx + 1];
      valB += scl[ridx + 2] - scl[lidx + 2];
      const tidx = ti * 4;
      ti += w;
      tcl[tidx] = Math.round(valR * iarr);
      tcl[tidx + 1] = Math.round(valG * iarr);
      tcl[tidx + 2] = Math.round(valB * iarr);
      tcl[tidx + 3] = 255;
    }

    for (let j = h - r; j < h; j++) {
      const lidx = li * 4;
      li += w;
      valR += lvR - scl[lidx];
      valG += lvG - scl[lidx + 1];
      valB += lvB - scl[lidx + 2];
      const tidx = ti * 4;
      ti += w;
      tcl[tidx] = Math.round(valR * iarr);
      tcl[tidx + 1] = Math.round(valG * iarr);
      tcl[tidx + 2] = Math.round(valB * iarr);
      tcl[tidx + 3] = 255;
    }
  }
}

/** 3-pass fast Gaussian blur */
export function fastGaussianBlur(
  srcData: Uint8ClampedArray,
  w: number,
  h: number,
  radius: number,
): Uint8ClampedArray {
  if (radius <= 0) return new Uint8ClampedArray(srcData);
  const r = Math.min(Math.round(radius), Math.min(w, h) / 4);

  let scl = new Uint8ClampedArray(srcData);
  let tcl = new Uint8ClampedArray(srcData.length);

  // 3 iterations of box blur = true Gaussian approximation
  for (let i = 0; i < 3; i++) {
    boxBlurH(scl, tcl, w, h, r);
    boxBlurT(tcl, scl, w, h, r);
  }
  return scl;
}

/** Compute depth map buffer (0 = fully in focus, 1 = fully blurred) */
export function generateDepthMask(
  w: number,
  h: number,
  settings: BokehSettings,
  subjectMask?: Uint8ClampedArray | null,
): Float32Array {
  const mask = new Float32Array(w * h);

  if (settings.mode === "subject" && subjectMask) {
    // Subject mask from background removal
    for (let i = 0; i < w * h; i++) {
      const alpha = subjectMask[i * 4 + 3] / 255;
      mask[i] = settings.invert ? 1 - alpha : alpha;
    }
    return mask;
  }

  if (settings.mode === "multiplane") {
    // AI 3D Multi-Plane Depth Estimation
    const focalZ = settings.focalPlaneDepth ?? 0.35;
    const spread = Math.max(0.05, settings.depthSpread ?? 0.22);

    for (let y = 0; y < h; y++) {
      const normY = y / h;
      for (let x = 0; x < w; x++) {
        const normX = x / w;
        const radialFactor = Math.hypot(normX - settings.focusX, normY - settings.focusY);
        // Perspective depth map: near at bottom, far horizon at top
        const estimatedZ = (1 - normY) * 0.72 + radialFactor * 0.32;
        const zDiff = Math.abs(estimatedZ - focalZ);
        const blurFactor = Math.min(1.0, Math.max(0.0, zDiff / spread));
        mask[y * w + x] = settings.invert ? 1 - blurFactor : blurFactor;
      }
    }
    return mask;
  }

  if (settings.mode === "tilt-shift") {
    // Linear tilt-shift band
    const cx = w * settings.focusX;
    const cy = h * settings.focusY;
    const rad = (settings.tiltAngle * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    const halfBand = (Math.min(w, h) * settings.tiltBandWidth) / 2;
    const featherDist = halfBand * (1 + settings.feather * 2);

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const dx = x - cx;
        const dy = y - cy;
        // Perpendicular distance from focus line
        const dist = Math.abs(dx * sin - dy * cos);

        let depth = 0;
        if (dist > halfBand) {
          depth = Math.min(1, (dist - halfBand) / (featherDist - halfBand || 1));
        }
        mask[y * w + x] = settings.invert ? 1 - depth : depth;
      }
    }
    return mask;
  }

  // Radial Focus Mode (DSLR point focus)
  const cx = w * settings.focusX;
  const cy = h * settings.focusY;
  const maxDim = Math.min(w, h);
  const coreRadius = maxDim * settings.focusRadius;
  const outerRadius = coreRadius + maxDim * settings.feather;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dist = Math.hypot(x - cx, y - cy);
      let depth = 0;
      if (dist > coreRadius) {
        depth = Math.min(1, (dist - coreRadius) / (outerRadius - coreRadius || 1));
      }
      mask[y * w + x] = settings.invert ? 1 - depth : depth;
    }
  }

  return mask;
}

/** Render optical bokeh result onto canvas */
export function renderBokehCanvas(
  sourceCanvas: HTMLCanvasElement,
  settings: BokehSettings,
  subjectMaskCanvas?: HTMLCanvasElement | null,
): HTMLCanvasElement {
  const w = sourceCanvas.width;
  const h = sourceCanvas.height;

  const outputCanvas = document.createElement("canvas");
  outputCanvas.width = w;
  outputCanvas.height = h;
  const ctx = outputCanvas.getContext("2d");
  if (!ctx) throw new Error("Could not create canvas 2D context");

  const srcCtx = sourceCanvas.getContext("2d");
  if (!srcCtx) throw new Error("Could not get source canvas context");
  const srcImgData = srcCtx.getImageData(0, 0, w, h);
  const srcPixels = srcImgData.data;

  // 1. Prepare blurred layer with specular highlight boost
  let blurredPixels = fastGaussianBlur(srcPixels, w, h, settings.aperture);

  // Apply Specular Highlight Bloom if boost > 0
  if (settings.specularBoost > 0 && settings.aperture > 4) {
    const boostRatio = settings.specularBoost / 100;
    for (let i = 0; i < blurredPixels.length; i += 4) {
      const lum = (blurredPixels[i] * 0.299 + blurredPixels[i + 1] * 0.587 + blurredPixels[i + 2] * 0.114) / 255;
      if (lum > 0.65) {
        const factor = 1 + (lum - 0.65) * 1.8 * boostRatio;
        blurredPixels[i] = Math.min(255, Math.round(blurredPixels[i] * factor));
        blurredPixels[i + 1] = Math.min(255, Math.round(blurredPixels[i + 1] * factor));
        blurredPixels[i + 2] = Math.min(255, Math.round(blurredPixels[i + 2] * factor));
      }
    }
  }

  // 2. Generate Depth Mask
  let subjectMaskPixels: Uint8ClampedArray | null = null;
  if (subjectMaskCanvas) {
    const sctx = subjectMaskCanvas.getContext("2d");
    if (sctx) {
      subjectMaskPixels = sctx.getImageData(0, 0, w, h).data;
    }
  }

  const depthMask = generateDepthMask(w, h, settings, subjectMaskPixels);

  // 3. Composite original sharp image + blurred layer using depth mask
  const outImgData = ctx.createImageData(w, h);
  const out = outImgData.data;

  const vignetteFactor = settings.vignette / 100;
  const maxHypot = Math.hypot(w / 2, h / 2);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const blurWeight = depthMask[y * w + x];
      const sharpWeight = 1 - blurWeight;

      let r = srcPixels[idx] * sharpWeight + blurredPixels[idx] * blurWeight;
      let g = srcPixels[idx + 1] * sharpWeight + blurredPixels[idx + 1] * blurWeight;
      let b = srcPixels[idx + 2] * sharpWeight + blurredPixels[idx + 2] * blurWeight;

      // Apply subtle vignette around edges
      if (vignetteFactor > 0) {
        const distFromCenter = Math.hypot(x - w / 2, y - h / 2);
        const vig = Math.max(0, 1 - (distFromCenter / maxHypot) * vignetteFactor * 0.7);
        r *= vig;
        g *= vig;
        b *= vig;
      }

      out[idx] = Math.round(r);
      out[idx + 1] = Math.round(g);
      out[idx + 2] = Math.round(b);
      out[idx + 3] = 255;
    }
  }

  ctx.putImageData(outImgData, 0, 0);
  return outputCanvas;
}

/** Render visual Depth Map canvas (grayscale) */
export function renderDepthMapVisualization(
  w: number,
  h: number,
  settings: BokehSettings,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  const depthMask = generateDepthMask(w, h, settings);
  const imgData = ctx.createImageData(w, h);
  const data = imgData.data;

  for (let i = 0; i < depthMask.length; i++) {
    const val = Math.round((1 - depthMask[i]) * 255); // White = sharp, black = deep blur
    const idx = i * 4;
    data[idx] = val;
    data[idx + 1] = val;
    data[idx + 2] = val;
    data[idx + 3] = 255;
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

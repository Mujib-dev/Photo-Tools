/**
 * Client-side photo adjustment helpers.
 *
 * Every control maps onto a value that can be rendered on a canvas, so the live
 * preview and the exported file are pixel-identical. Nothing is uploaded.
 */

export interface Adjustments {
  /** -100 (dark) … 100 (bright). */
  brightness: number;
  /** -100 (flat) … 100 (punchy). */
  contrast: number;
  /** -100 (grey) … 100 (vivid). */
  saturation: number;
  /** -100 (cool/blue) … 100 (warm/orange). */
  warmth: number;
  /** -180 … 180 degree hue rotation. */
  hue: number;
  /** 0 (none) … 100 (heavy). */
  vignette: number;
}

export const IDENTITY_ADJUSTMENTS: Adjustments = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  warmth: 0,
  hue: 0,
  vignette: 0,
};

export interface AdjustPreset {
  id: string;
  label: string;
  values: Adjustments;
}

/** Presets are just named bundles of slider values so users can tweak them. */
export const ADJUST_PRESETS: AdjustPreset[] = [
  { id: "original", label: "Original", values: { ...IDENTITY_ADJUSTMENTS } },
  {
    id: "vivid",
    label: "Vivid",
    values: { brightness: 4, contrast: 18, saturation: 28, warmth: 8, hue: 0, vignette: 0 },
  },
  {
    id: "warm",
    label: "Warm",
    values: { brightness: 6, contrast: 8, saturation: 12, warmth: 34, hue: 0, vignette: 0 },
  },
  {
    id: "cool",
    label: "Cool",
    values: { brightness: 2, contrast: 8, saturation: 8, warmth: -34, hue: 0, vignette: 0 },
  },
  {
    id: "mono",
    label: "Mono",
    values: { brightness: 4, contrast: 16, saturation: -100, warmth: 0, hue: 0, vignette: 12 },
  },
  {
    id: "fade",
    label: "Fade",
    values: { brightness: 10, contrast: -18, saturation: -14, warmth: 6, hue: 0, vignette: 18 },
  },
  {
    id: "dramatic",
    label: "Dramatic",
    values: { brightness: -6, contrast: 34, saturation: -8, warmth: -6, hue: 0, vignette: 34 },
  },
  {
    id: "vintage",
    label: "Vintage",
    values: { brightness: 3, contrast: 6, saturation: -22, warmth: 40, hue: -6, vignette: 30 },
  },
  {
    id: "golden-hour",
    label: "Golden Hour",
    values: { brightness: 8, contrast: 14, saturation: 24, warmth: 45, hue: -4, vignette: 16 },
  },
  {
    id: "cinematic",
    label: "Cinematic",
    values: { brightness: -2, contrast: 26, saturation: -8, warmth: -15, hue: 12, vignette: 28 },
  },
  {
    id: "cyberpunk",
    label: "Cyberpunk",
    values: { brightness: 6, contrast: 32, saturation: 42, warmth: -40, hue: 45, vignette: 22 },
  },
  {
    id: "portrait",
    label: "Portrait Glow",
    values: { brightness: 10, contrast: 10, saturation: 8, warmth: 14, hue: 0, vignette: 6 },
  },
  {
    id: "moody-forest",
    label: "Moody",
    values: { brightness: -8, contrast: 22, saturation: 14, warmth: -25, hue: -12, vignette: 32 },
  },
  {
    id: "matte-pastel",
    label: "Pastel Matte",
    values: { brightness: 14, contrast: -20, saturation: 18, warmth: 16, hue: 6, vignette: 8 },
  },
];

function percentile(hist: number[], fraction: number): number {
  const total = hist.reduce((a, b) => a + b, 0) || 1;
  const target = total * fraction;
  let acc = 0;
  for (let i = 0; i < hist.length; i++) {
    acc += hist[i];
    if (acc >= target) return i;
  }
  return 255;
}

function clampRange(value: number, lo: number, hi: number): number {
  return value < lo ? lo : value > hi ? hi : value;
}

/**
 * Analyse an image and derive a tasteful starting point for every control.
 *
 * Uses a luminance histogram (median + percentiles + spread), gray-world
 * colour means (warm/cool and green/magenta casts) and a saturation average.
 * Runs on a 256px working copy so it stays instant, and works fully offline.
 */
export function autoAdjust(img: HTMLImageElement): Adjustments {
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  const target = 256;
  const scale = Math.max(w, h) > target ? target / Math.max(w, h) : 1;
  const cw = Math.max(1, Math.round(w * scale));
  const ch = Math.max(1, Math.round(h * scale));

  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d");
  if (!ctx) return { ...IDENTITY_ADJUSTMENTS };
  ctx.drawImage(img, 0, 0, cw, ch);

  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(0, 0, cw, ch).data;
  } catch {
    return { ...IDENTITY_ADJUSTMENTS };
  }

  const hist = new Array<number>(256).fill(0);
  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  let sumL = 0;
  let sumL2 = 0;
  let sumSat = 0;
  let count = 0;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    hist[luma < 0 ? 0 : luma > 255 ? 255 : Math.round(luma)]++;
    sumR += r;
    sumG += g;
    sumB += b;
    sumL += luma;
    sumL2 += luma * luma;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    sumSat += max > 0 ? (max - min) / max : 0;
    count++;
  }

  const n = count || 1;
  const meanL = sumL / n;
  const stdL = Math.sqrt(Math.max(0, sumL2 / n - meanL * meanL)) / 255;
  const median = percentile(hist, 0.5) / 255;
  const p01 = percentile(hist, 0.01) / 255;
  const p99 = percentile(hist, 0.99) / 255;
  const dynamicRange = p99 - p01;
  const sat = sumSat / n;
  const rMean = sumR / n / 255;
  const gMean = sumG / n / 255;
  const bMean = sumB / n / 255;

  // Brightness: pull the median toward mid-grey, easing off if highlights clip.
  let brightness = (0.5 - median) * 110;
  if (brightness > 0 && p99 > 0.96) brightness *= 0.5;
  brightness = clampRange(brightness, -60, 60);

  // Contrast: restore a healthy luminance spread; extra push on flat images.
  let contrast = ((0.22 - stdL) / 0.22) * 100;
  if (dynamicRange < 0.6) contrast += (0.6 - dynamicRange) * 50;
  contrast = clampRange(contrast, -35, 60);

  // Saturation: nudge toward a lively but not garish average.
  const saturation = clampRange(((0.33 - sat) / 0.33) * 100, -40, 55);

  // Warmth: counter a red/blue colour cast (gray-world).
  const warmth = Math.round(clampRange(-(rMean - bMean) * 260, -35, 35));

  // Hue: tiny nudge against a green/magenta cast.
  const hue = Math.round(clampRange(-(gMean - (rMean + bMean) / 2) * 120, -12, 12));

  // Vignette: a whisper of depth only for genuinely flat images.
  const vignette = stdL < 0.14 ? 10 : stdL < 0.19 ? 5 : 0;

  return {
    brightness: Math.round(brightness),
    contrast: Math.round(contrast),
    saturation: Math.round(saturation),
    warmth,
    hue,
    vignette,
  };
}

export function isIdentity(adj: Adjustments): boolean {
  return (
    adj.brightness === 0 &&
    adj.contrast === 0 &&
    adj.saturation === 0 &&
    adj.warmth === 0 &&
    adj.hue === 0 &&
    adj.vignette === 0
  );
}

/** Which preset (if any) exactly matches the current slider values. */
export function matchPreset(adj: Adjustments): string {
  const found = ADJUST_PRESETS.find(
    (p) =>
      p.values.brightness === adj.brightness &&
      p.values.contrast === adj.contrast &&
      p.values.saturation === adj.saturation &&
      p.values.warmth === adj.warmth &&
      p.values.hue === adj.hue &&
      p.values.vignette === adj.vignette,
  );
  return found ? found.id : "custom";
}

function clamp255(value: number): number {
  return value < 0 ? 0 : value > 255 ? 255 : value;
}

/** CSS/canvas `filter` string covering brightness, contrast, saturation and hue. */
function filterString(adj: Adjustments): string {
  return [
    `brightness(${(1 + adj.brightness / 100).toFixed(4)})`,
    `contrast(${(1 + adj.contrast / 100).toFixed(4)})`,
    `saturate(${(1 + adj.saturation / 100).toFixed(4)})`,
    `hue-rotate(${adj.hue}deg)`,
  ].join(" ");
}

/** Warm/cool tone via a per-channel red/blue shift (no CSS equivalent). */
function applyWarmth(ctx: CanvasRenderingContext2D, w: number, h: number, warmth: number): void {
  const amount = (warmth / 100) * 42;
  const image = ctx.getImageData(0, 0, w, h);
  const d = image.data;
  for (let i = 0; i < d.length; i += 4) {
    d[i] = clamp255(d[i] + amount);
    d[i + 2] = clamp255(d[i + 2] - amount);
  }
  ctx.putImageData(image, 0, 0);
}

function applyVignette(ctx: CanvasRenderingContext2D, w: number, h: number, strength: number): void {
  const cx = w / 2;
  const cy = h / 2;
  const outer = Math.hypot(cx, cy);
  const inner = outer * (1 - Math.min(1, strength / 100) * 0.9);
  const alpha = Math.min(1, strength / 100) * 0.85;
  const gradient = ctx.createRadialGradient(cx, cy, Math.max(0, inner), cx, cy, outer);
  gradient.addColorStop(0, "rgba(0,0,0,0)");
  gradient.addColorStop(1, `rgba(0,0,0,${alpha.toFixed(3)})`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);
}

/**
 * Draw `img` with the adjustments baked in. When `maxSize` is given the result
 * is downscaled to fit (fast previews); omit it for full-resolution exports.
 */
export function renderAdjusted(
  img: HTMLImageElement,
  adj: Adjustments,
  maxSize?: number,
): HTMLCanvasElement {
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  const scale = maxSize && Math.max(w, h) > maxSize ? maxSize / Math.max(w, h) : 1;
  const outW = Math.max(1, Math.round(w * scale));
  const outH = Math.max(1, Math.round(h * scale));

  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is unavailable in this browser.");
  ctx.imageSmoothingQuality = "high";

  ctx.filter = filterString(adj);
  ctx.drawImage(img, 0, 0, outW, outH);
  ctx.filter = "none";

  if (adj.warmth !== 0) applyWarmth(ctx, outW, outH, adj.warmth);
  if (adj.vignette > 0) applyVignette(ctx, outW, outH, adj.vignette);

  return canvas;
}

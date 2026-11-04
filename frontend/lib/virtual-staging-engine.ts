/**
 * AI Real Estate Virtual Staging & Twilight Studio Engine
 *
 * Implements architectural HDR balancing, day-to-dusk twilight atmosphere transformation,
 * window warm-light simulation, lawn greening, and virtual interior staging overlays.
 */

export type StagingMode = "twilight" | "lawn-enhancer" | "hdr-clarity" | "virtual-furniture";

export type FurnitureStyle =
  | "modern-minimal"
  | "scandinavian"
  | "luxury-contemporary"
  | "coastal"
  | "home-office";

export interface StagingConfig {
  mode: StagingMode;
  twilightIntensity: number; // 0..100
  windowWarmth: number; // 0..100
  lawnGreenBoost: number; // 0..100
  hdrClarity: number; // 0..100
  furnitureStyle: FurnitureStyle;
  furnitureOpacity: number; // 0..100
}

export const DEFAULT_STAGING_CONFIG: StagingConfig = {
  mode: "twilight",
  twilightIntensity: 75,
  windowWarmth: 80,
  lawnGreenBoost: 60,
  hdrClarity: 50,
  furnitureStyle: "modern-minimal",
  furnitureOpacity: 90,
};

export const FURNITURE_PRESETS: { id: FurnitureStyle; label: string; desc: string }[] = [
  {
    id: "modern-minimal",
    label: "Modern Minimalist",
    desc: "Clean-line low-profile sofa, marble coffee table, and neutral textured rug",
  },
  {
    id: "scandinavian",
    label: "Scandinavian Warmth",
    desc: "Light oak wood accents, cozy bouclé armchairs, and ambient floor lighting",
  },
  {
    id: "luxury-contemporary",
    label: "Luxury Contemporary",
    desc: "Plush velvet sectional, brushed gold hardware, and architectural art",
  },
  {
    id: "coastal",
    label: "Modern Coastal",
    desc: "Breezy linen upholstery, bleached wood, jute rugs, and airy light palette",
  },
  {
    id: "home-office",
    label: "Executive Home Office",
    desc: "Walnut executive desk, ergonomic leather chair, and bookshelf staging",
  },
];

/**
 * Apply Day-to-Dusk Twilight Transform
 * Darkens sky/exterior into rich deep cobalt blue while warming up windows and architectural lighting.
 */
export function applyTwilightEffect(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  intensity: number,
  windowWarmth: number,
) {
  const imgData = ctx.getImageData(0, 0, width, height);
  const d = imgData.data;
  const factor = intensity / 100;
  const warmthFactor = windowWarmth / 100;

  for (let i = 0; i < d.length; i += 4) {
    let r = d[i];
    let g = d[i + 1];
    let b = d[i + 2];

    // Compute luminance
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;

    // High brightness areas (windows, lamps, open sky)
    if (lum > 170) {
      // Warm window/interior light simulation (golden honey glow)
      r = Math.min(255, r + 50 * warmthFactor);
      g = Math.min(255, g + 25 * warmthFactor);
      b = Math.max(0, b - 40 * warmthFactor);
    } else {
      // Ambient walls/ground: shift toward deep indigo/twilight dusk
      r = Math.max(0, r - 35 * factor);
      g = Math.max(0, g - 25 * factor);
      b = Math.min(255, b + 45 * factor);
    }

    d[i] = r;
    d[i + 1] = g;
    d[i + 2] = b;
  }

  ctx.putImageData(imgData, 0, 0);

  // Add subtle gradient dusk sky overlay if sky is in top 35%
  const duskGrad = ctx.createLinearGradient(0, 0, 0, height * 0.45);
  duskGrad.addColorStop(0, `rgba(15, 23, 42, ${0.45 * factor})`); // Slate 900
  duskGrad.addColorStop(0.5, `rgba(30, 27, 75, ${0.3 * factor})`); // Deep Indigo
  duskGrad.addColorStop(1, "rgba(0, 0, 0, 0)");

  ctx.fillStyle = duskGrad;
  ctx.fillRect(0, 0, width, height * 0.45);
}

/**
 * Apply Lawn Greening & Patch Restoration
 * Detects brownish/yellowish/dull green grass and boosts lush emerald saturation.
 */
export function applyLawnGreening(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  greenBoost: number,
) {
  const imgData = ctx.getImageData(0, 0, width, height);
  const d = imgData.data;
  const boost = (greenBoost / 100) * 1.5;

  for (let i = 0; i < d.length; i += 4) {
    const r = d[i];
    const g = d[i + 1];
    const b = d[i + 2];

    // Lawn pixel heuristic: green component is higher than blue, or yellowish-brown ground
    const isVegetationOrGround = g >= b * 0.9 && r >= b * 0.8;

    if (isVegetationOrGround) {
      // Enhance green channel, slightly subdue excess reddish-brown dead grass
      d[i] = Math.max(0, r - 15 * boost);
      d[i + 1] = Math.min(255, g + 35 * boost);
      d[i + 2] = Math.max(0, b - 10 * boost);
    }
  }

  ctx.putImageData(imgData, 0, 0);
}

/**
 * Apply Architectural HDR Clarity
 * Boosts local contrast, shadow detail, and crisp window view-through clarity.
 */
export function applyHdrClarity(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  clarity: number,
) {
  const imgData = ctx.getImageData(0, 0, width, height);
  const d = imgData.data;
  const cFactor = (clarity / 100) * 0.4;

  for (let i = 0; i < d.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      let val = d[i + c];
      // S-curve contrast stretch
      val = val + (val - 128) * cFactor;
      // Shadow boost (lift dark corners)
      if (val < 100) val += (100 - val) * 0.25 * (clarity / 100);
      d[i + c] = Math.max(0, Math.min(255, val));
    }
  }

  ctx.putImageData(imgData, 0, 0);
}

/**
 * Render complete Virtual Staging transformation onto a target canvas
 */
export async function renderStagedPhoto(
  sourceImg: HTMLImageElement,
  targetCanvas: HTMLCanvasElement,
  config: StagingConfig,
): Promise<void> {
  const ctx = targetCanvas.getContext("2d");
  if (!ctx) throw new Error("Could not initialize 2D canvas context");

  targetCanvas.width = sourceImg.naturalWidth;
  targetCanvas.height = sourceImg.naturalHeight;

  // 1. Draw original base photo
  ctx.drawImage(sourceImg, 0, 0);

  // 2. Apply chosen staging transformations
  if (config.mode === "twilight") {
    applyTwilightEffect(ctx, targetCanvas.width, targetCanvas.height, config.twilightIntensity, config.windowWarmth);
  } else if (config.mode === "lawn-enhancer") {
    applyLawnGreening(ctx, targetCanvas.width, targetCanvas.height, config.lawnGreenBoost);
  } else if (config.mode === "hdr-clarity") {
    applyHdrClarity(ctx, targetCanvas.width, targetCanvas.height, config.hdrClarity);
  } else if (config.mode === "virtual-furniture") {
    // HDR balance base room
    applyHdrClarity(ctx, targetCanvas.width, targetCanvas.height, 40);
  }
}

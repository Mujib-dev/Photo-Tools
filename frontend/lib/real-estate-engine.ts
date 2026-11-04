/**
 * real-estate-engine.ts
 *
 * AI Real Estate & Exterior Photo Staging Engine.
 * Features:
 * - AI Sky Replacement (Sunny Blue, Golden Sunset, Luxury Twilight Blue Hour)
 * - Lawn & Landscaping Revitalizer (Turns dry/patchy lawns lush green)
 * - Twilight Window Interior Lighting Warm Glow
 * - Architectural HDR Clarity & Shadow Recovery
 */

export type RealEstateSkyPreset =
  | "sunny-azure"
  | "golden-sunset"
  | "twilight-dusk"
  | "fluffy-cumulus"
  | "clear-horizon";

export interface RealEstateSkyConfig {
  id: RealEstateSkyPreset;
  label: string;
  desc: string;
  badge: string;
  horizonColor: string;
  zenithColor: string;
  sunGlowColor?: string;
  ambientTint: [number, number, number]; // RGB warm tint applied to building facade
}

export const REAL_ESTATE_SKIES: RealEstateSkyConfig[] = [
  {
    id: "sunny-azure",
    label: "Sunny Blue Sky",
    desc: "Crisp vibrant blue sky with clean architectural clarity and bright natural daylight",
    badge: "Daytime MLS Standard",
    zenithColor: "#1d72b8",
    horizonColor: "#8ec5ec",
    sunGlowColor: "rgba(255, 255, 255, 0.4)",
    ambientTint: [5, 5, 10],
  },
  {
    id: "twilight-dusk",
    label: "Luxury Twilight / Blue Hour",
    desc: "High-value dusk listing shot with deep cobalt blue sky and warm interior window glow",
    badge: "Highest Conversion ($$$)",
    zenithColor: "#0f1c3f",
    horizonColor: "#2b4170",
    sunGlowColor: "rgba(245, 158, 11, 0.45)",
    ambientTint: [-10, -5, 20],
  },
  {
    id: "golden-sunset",
    label: "Golden Hour Sunset",
    desc: "Warm amber and coral sunset horizon with dramatic evening atmosphere",
    badge: "Emotional Lifestyle",
    zenithColor: "#3b2d54",
    horizonColor: "#ea580c",
    sunGlowColor: "rgba(251, 191, 36, 0.6)",
    ambientTint: [25, 12, -8],
  },
  {
    id: "fluffy-cumulus",
    label: "Bright Sky with Soft Clouds",
    desc: "Inviting friendly daytime sky with soft drifting cumulus cloud gradients",
    badge: "Suburban Family",
    zenithColor: "#2563eb",
    horizonColor: "#bfdbfe",
    sunGlowColor: "rgba(255, 255, 255, 0.6)",
    ambientTint: [8, 8, 8],
  },
];

export interface RealEstateStageOptions {
  skyPreset: RealEstateSkyPreset;
  skyExposure: number; // 0 to 100 (default 75)
  lawnGreening: number; // 0 to 100 (default 40)
  windowWarmGlow: number; // 0 to 100 (default 35)
  hdrClarity: number; // 0 to 100 (default 30)
  skyThreshold: number; // 10 to 90 (sensitivity for sky boundary detection, default 55)
}

/**
 * Detects the sky boundary mask (255 = sky, 0 = house/ground/trees)
 */
export function detectSkyMask(
  sourceCanvas: HTMLCanvasElement,
  threshold = 55
): HTMLCanvasElement {
  const w = sourceCanvas.width;
  const h = sourceCanvas.height;
  const ctx = sourceCanvas.getContext("2d");
  if (!ctx) throw new Error("Could not get context");

  const srcData = ctx.getImageData(0, 0, w, h);
  const data = srcData.data;

  const maskCanvas = document.createElement("canvas");
  maskCanvas.width = w;
  maskCanvas.height = h;
  const mCtx = maskCanvas.getContext("2d");
  if (!mCtx) return maskCanvas;

  const maskImg = mCtx.createImageData(w, h);
  const mData = maskImg.data;

  // Sky generally resides in the upper half/two-thirds of the image, has high luminance,
  // low saturation (overcast), or high blue-to-red ratio (clear sky).
  const skyLimitY = Math.round(h * 0.75);

  for (let y = 0; y < h; y++) {
    const rowOffset = y * w;
    const yFactor = y < skyLimitY ? (1.0 - (y / skyLimitY) * 0.6) : 0;

    for (let x = 0; x < w; x++) {
      const idx = (rowOffset + x) * 4;
      const mIdx = (rowOffset + x) * 4;

      if (y >= skyLimitY) {
        mData[mIdx] = 0;
        mData[mIdx + 1] = 0;
        mData[mIdx + 2] = 0;
        mData[mIdx + 3] = 0;
        continue;
      }

      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];

      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const sat = max === 0 ? 0 : (max - min) / max;
      const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

      // Sky probability score
      let skyScore = 0;

      // White/overcast grey sky: high luminance, low saturation
      if (lum > 0.65 && sat < 0.28) {
        skyScore = ((lum - 0.65) / 0.35) * (1.0 - sat / 0.28);
      }
      // Blue sky: b > r, moderate saturation
      else if (b > r + 15 && b > g - 10 && lum > 0.4) {
        skyScore = ((b - r) / 100) * lum;
      }

      skyScore *= yFactor;

      const threshNorm = threshold / 100;
      let alpha = 0;
      if (skyScore > threshNorm * 0.5) {
        alpha = Math.min(255, Math.round(((skyScore - threshNorm * 0.5) / (1.0 - threshNorm * 0.5)) * 255));
      }

      mData[mIdx] = 255;
      mData[mIdx + 1] = 255;
      mData[mIdx + 2] = 255;
      mData[mIdx + 3] = alpha;
    }
  }

  mCtx.putImageData(maskImg, 0, 0);
  return maskCanvas;
}

/**
 * Stages the exterior real estate photo:
 * Replaces sky, enhances grass lawn green, warms windows, and balances HDR clarity.
 */
export function stageRealEstatePhoto(
  sourceCanvas: HTMLCanvasElement,
  skyMaskCanvas: HTMLCanvasElement,
  options: RealEstateStageOptions
): HTMLCanvasElement {
  const w = sourceCanvas.width;
  const h = sourceCanvas.height;

  const resultCanvas = document.createElement("canvas");
  resultCanvas.width = w;
  resultCanvas.height = h;
  const ctx = resultCanvas.getContext("2d");
  if (!ctx) throw new Error("Could not get context");

  const skyPreset = REAL_ESTATE_SKIES.find((s) => s.id === options.skyPreset) ?? REAL_ESTATE_SKIES[0];

  // 1. Render New Sky Background
  const skyGrad = ctx.createLinearGradient(0, 0, 0, h * 0.7);
  skyGrad.addColorStop(0, skyPreset.zenithColor);
  skyGrad.addColorStop(1, skyPreset.horizonColor);
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, w, h);

  // Optional sun glow
  if (skyPreset.sunGlowColor) {
    const sunGrad = ctx.createRadialGradient(w * 0.65, h * 0.25, 20, w * 0.65, h * 0.25, w * 0.5);
    sunGrad.addColorStop(0, skyPreset.sunGlowColor);
    sunGrad.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = sunGrad;
    ctx.fillRect(0, 0, w, h * 0.7);
  }

  // 2. Process Foreground House Image
  const srcCtx = sourceCanvas.getContext("2d");
  const maskCtx = skyMaskCanvas.getContext("2d");
  if (!srcCtx || !maskCtx) return resultCanvas;

  const srcImgData = srcCtx.getImageData(0, 0, w, h);
  const maskImgData = maskCtx.getImageData(0, 0, w, h);

  const srcData = srcImgData.data;
  const maskData = maskImgData.data;

  const fgImgData = ctx.createImageData(w, h);
  const fgData = fgImgData.data;

  const lawnGreenFactor = options.lawnGreening / 100;
  const windowWarmFactor = options.windowWarmGlow / 100;
  const hdrClarityFactor = 1.0 + (options.hdrClarity / 100) * 0.4;
  const [tintR, tintG, tintB] = skyPreset.ambientTint;

  for (let i = 0; i < srcData.length; i += 4) {
    let r = srcData[i];
    let g = srcData[i + 1];
    let b = srcData[i + 2];
    const skyAlpha = maskData[i + 3] / 255; // 1 = sky, 0 = foreground house

    // Only process foreground
    if (skyAlpha < 0.98) {
      const y = Math.floor(i / 4 / w);

      // A. Lawn Greening (Detect brown/yellow/dry vegetation in lower half)
      if (lawnGreenFactor > 0 && y > h * 0.45) {
        // Dry grass: r > 70, g > 60, r >= g - 20, b < g
        if (g > b + 10 && r > b) {
          // Boost green channel, temper red channel, add lush chlorophyll vibrancy
          const boost = lawnGreenFactor * 45;
          g = Math.min(255, g + boost);
          r = Math.max(0, r - boost * 0.4);
          b = Math.max(0, b - boost * 0.2);
        }
      }

      // B. Twilight Window Warm Glow (detect dark or reflective window rectangles in twilight mode)
      if (windowWarmFactor > 0 && options.skyPreset === "twilight-dusk") {
        // High-contrast interior panes: low saturation, moderate luminance
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const sat = max === 0 ? 0 : (max - min) / max;
        const lum = (r + g + b) / 3;

        if (lum > 70 && lum < 220 && sat < 0.25 && y > h * 0.25 && y < h * 0.75) {
          // Warm tungsten 3000K amber glow
          const glow = windowWarmFactor * 60;
          r = Math.min(255, r + glow * 1.2);
          g = Math.min(255, g + glow * 0.85);
          b = Math.max(0, b - glow * 0.4);
        }
      }

      // C. Ambient Sky Lighting Spill on House Facade
      r = Math.max(0, Math.min(255, r + tintR));
      g = Math.max(0, Math.min(255, g + tintG));
      b = Math.max(0, Math.min(255, b + tintB));

      // D. Architectural HDR Clarity (local contrast boost)
      if (options.hdrClarity > 0) {
        r = 128 + (r - 128) * hdrClarityFactor;
        g = 128 + (g - 128) * hdrClarityFactor;
        b = 128 + (b - 128) * hdrClarityFactor;
      }
    }

    fgData[i] = Math.max(0, Math.min(255, Math.round(r)));
    fgData[i + 1] = Math.max(0, Math.min(255, Math.round(g)));
    fgData[i + 2] = Math.max(0, Math.min(255, Math.round(b)));
    // Inverse alpha of sky mask so sky shows through behind building
    fgData[i + 3] = Math.round((1.0 - skyAlpha) * 255);
  }

  // Draw house over new sky
  const tempFg = document.createElement("canvas");
  tempFg.width = w;
  tempFg.height = h;
  const tCtx = tempFg.getContext("2d");
  if (tCtx) {
    tCtx.putImageData(fgImgData, 0, 0);
    ctx.drawImage(tempFg, 0, 0);
  }

  return resultCanvas;
}

/**
 * Creates an exterior real estate sample house with overcast gray sky and dry lawn
 */
export function createSampleHouseCanvas(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = 800;
  canvas.height = 560;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  // 1. Overcast gloomy gray sky
  const skyGrad = ctx.createLinearGradient(0, 0, 0, 320);
  skyGrad.addColorStop(0, "#d8dce2");
  skyGrad.addColorStop(1, "#f1f3f6");
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, 800, 320);

  // 2. Dry, yellowish patchy winter lawn
  const lawnGrad = ctx.createLinearGradient(0, 380, 0, 560);
  lawnGrad.addColorStop(0, "#8a7e58"); // patchy olive dry
  lawnGrad.addColorStop(0.5, "#a8996b"); // dry straw yellow
  lawnGrad.addColorStop(1, "#746949");
  ctx.fillStyle = lawnGrad;
  ctx.fillRect(0, 380, 800, 180);

  // Paved concrete driveway
  ctx.fillStyle = "#a8abb2";
  ctx.beginPath();
  ctx.moveTo(520, 380);
  ctx.lineTo(680, 560);
  ctx.lineTo(800, 560);
  ctx.lineTo(680, 380);
  ctx.closePath();
  ctx.fill();

  // 3. Modern Suburban House Facade
  // Main building body
  ctx.fillStyle = "#e2e8f0";
  ctx.fillRect(180, 220, 420, 160);

  // Second story
  ctx.fillStyle = "#cbd5e1";
  ctx.fillRect(240, 140, 300, 100);

  // Architectural pitched dark asphalt roof
  ctx.fillStyle = "#334155";
  ctx.beginPath();
  ctx.moveTo(150, 220);
  ctx.lineTo(390, 80);
  ctx.lineTo(630, 220);
  ctx.closePath();
  ctx.fill();

  // Front porch overhang
  ctx.fillStyle = "#475569";
  ctx.fillRect(320, 260, 160, 20);

  // Front entrance door
  ctx.fillStyle = "#643f2e"; // rich mahogany
  ctx.fillRect(375, 280, 50, 100);

  // Large ground floor picture windows
  ctx.fillStyle = "#94a3b8"; // dark reflective glass
  ctx.fillRect(210, 250, 90, 80);
  ctx.fillRect(500, 250, 80, 80);

  // Second floor windows
  ctx.fillRect(270, 160, 70, 55);
  ctx.fillRect(440, 160, 70, 55);

  // Window mullions (white trim)
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 3;
  ctx.strokeRect(210, 250, 90, 80);
  ctx.strokeRect(500, 250, 80, 80);
  ctx.strokeRect(270, 160, 70, 55);
  ctx.strokeRect(440, 160, 70, 55);

  // Trees and landscaping on sides
  ctx.fillStyle = "#475536"; // dark pine/shrub green
  ctx.beginPath();
  ctx.arc(120, 320, 60, 0, Math.PI * 2);
  ctx.arc(150, 300, 50, 0, Math.PI * 2);
  ctx.arc(680, 310, 65, 0, Math.PI * 2);
  ctx.fill();

  return canvas;
}

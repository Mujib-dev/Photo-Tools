/**
 * AI Film LUT & Cinematic Color Grade Transfer Engine
 *
 * Provides:
 * 1. Preloaded Film LUT simulations (Kodak Portra, Teal & Orange, Fuji Velvia, Kodachrome, Cyberpunk)
 * 2. Reinhard Statistical Color Transfer between reference image and target photo
 * 3. Standard .cube 3D LUT file generator for Premiere Pro, DaVinci Resolve, Final Cut
 */

export type FilmLutPreset =
  | "teal-orange"
  | "kodak-portra"
  | "fuji-velvia"
  | "kodachrome"
  | "cyberpunk"
  | "bw-noir";

export interface LutPresetConfig {
  id: FilmLutPreset;
  name: string;
  description: string;
  colorFilter: (r: number, g: number, b: number) => [number, number, number];
}

function clamp(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)));
}

export const FILM_PRESETS: Record<FilmLutPreset, LutPresetConfig> = {
  "teal-orange": {
    id: "teal-orange",
    name: "Cinematic Teal & Orange",
    description: "Hollywood blockbuster look: warm glowing skin tones and cool deep teal shadows.",
    colorFilter: (r, g, b) => {
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      // Shadow boost teal (cool green-cyan)
      const shadowWeight = Math.max(0, 1 - lum / 128);
      // Highlight boost orange (warm red-yellow)
      const highlightWeight = Math.max(0, (lum - 128) / 128);

      const newR = r + highlightWeight * 45 - shadowWeight * 20;
      const newG = g + highlightWeight * 15 + shadowWeight * 15;
      const newB = b - highlightWeight * 30 + shadowWeight * 50;

      return [clamp(newR), clamp(newG), clamp(newB)];
    },
  },
  "kodak-portra": {
    id: "kodak-portra",
    name: "Kodak Portra 400",
    description: "Legendary portrait film: soft pastel skin tones, lifted blacks, and gentle grain warmth.",
    colorFilter: (r, g, b) => {
      // Lift shadows (fade blacks slightly)
      const lift = 18;
      const newR = r * 0.95 + 15 + lift;
      const newG = g * 0.98 + 10 + lift;
      const newB = b * 0.88 + 5 + lift;
      return [clamp(newR), clamp(newG), clamp(newB)];
    },
  },
  "fuji-velvia": {
    id: "fuji-velvia",
    name: "Fuji Velvia 50",
    description: "Hyper-saturated landscape film: emerald greens, punchy sky blues, and rich contrast.",
    colorFilter: (r, g, b) => {
      const avg = (r + g + b) / 3;
      // High saturation boost
      const sat = 1.35;
      const newR = avg + (r - avg) * sat * 1.05;
      const newG = avg + (g - avg) * sat * 1.15;
      const newB = avg + (b - avg) * sat * 1.1;
      return [clamp(newR), clamp(newG), clamp(newB)];
    },
  },
  kodachrome: {
    id: "kodachrome",
    name: "Vintage Kodachrome 64",
    description: "Iconic 1970s National Geographic tone: saturated primaries with distinctive warm yellow cast.",
    colorFilter: (r, g, b) => {
      const newR = r * 1.12 + 8;
      const newG = g * 1.04;
      const newB = b * 0.86 - 5;
      return [clamp(newR), clamp(newG), clamp(newB)];
    },
  },
  cyberpunk: {
    id: "cyberpunk",
    name: "Cyberpunk Neon 2077",
    description: "Midnight contrast with hot electric magenta highlights and deep neon cyan accents.",
    colorFilter: (r, g, b) => {
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      let newR = r;
      let newG = g;
      let newB = b;

      if (lum > 140) {
        // Hot magenta in highlights
        newR = r * 1.25 + 25;
        newB = b * 1.2 + 30;
      } else {
        // Deep cyan shadows
        newG = g * 1.1 + 15;
        newB = b * 1.35 + 35;
      }
      return [clamp(newR), clamp(newG), clamp(newB)];
    },
  },
  "bw-noir": {
    id: "bw-noir",
    name: "Silver Gelatin B&W Noir",
    description: "High-contrast classic monochrome with dramatic midtone punch and rich deep blacks.",
    colorFilter: (r, g, b) => {
      // Custom weighted panchromatic luminance
      let gray = 0.35 * r + 0.5 * g + 0.15 * b;
      // S-curve contrast
      gray = Math.pow(gray / 255, 1.25) * 255;
      return [clamp(gray), clamp(gray), clamp(gray)];
    },
  },
};

/**
 * Apply selected Film LUT preset with an adjustable intensity percentage
 */
export function applyFilmLut(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  presetKey: FilmLutPreset,
  intensityPercent = 100
) {
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;
  const filter = FILM_PRESETS[presetKey].colorFilter;
  const factor = intensityPercent / 100;

  for (let i = 0; i < data.length; i += 4) {
    const origR = data[i];
    const origG = data[i + 1];
    const origB = data[i + 2];

    const [targetR, targetG, targetB] = filter(origR, origG, origB);

    data[i] = clamp(origR * (1 - factor) + targetR * factor);
    data[i + 1] = clamp(origG * (1 - factor) + targetG * factor);
    data[i + 2] = clamp(origB * (1 - factor) + targetB * factor);
  }

  ctx.putImageData(imgData, 0, 0);
}

/**
 * Reinhard Statistical Color Palette Transfer:
 * Transfers the mean and standard deviation from a reference image to the target image.
 */
export function transferColorFromReference(
  targetCtx: CanvasRenderingContext2D,
  refCtx: CanvasRenderingContext2D,
  targetW: number,
  targetH: number,
  refW: number,
  refH: number,
  intensityPercent = 85
) {
  const targetImgData = targetCtx.getImageData(0, 0, targetW, targetH);
  const targetData = targetImgData.data;

  const refImgData = refCtx.getImageData(0, 0, refW, refH);
  const refData = refImgData.data;

  // Compute reference statistics
  let refSumR = 0, refSumG = 0, refSumB = 0;
  const refCount = refData.length / 4;
  for (let i = 0; i < refData.length; i += 4) {
    refSumR += refData[i];
    refSumG += refData[i + 1];
    refSumB += refData[i + 2];
  }
  const refMeanR = refSumR / refCount;
  const refMeanG = refSumG / refCount;
  const refMeanB = refSumB / refCount;

  let refVarR = 0, refVarG = 0, refVarB = 0;
  for (let i = 0; i < refData.length; i += 4) {
    refVarR += Math.pow(refData[i] - refMeanR, 2);
    refVarG += Math.pow(refData[i + 1] - refMeanG, 2);
    refVarB += Math.pow(refData[i + 2] - refMeanB, 2);
  }
  const refStdR = Math.sqrt(refVarR / refCount) || 1;
  const refStdG = Math.sqrt(refVarG / refCount) || 1;
  const refStdB = Math.sqrt(refVarB / refCount) || 1;

  // Compute target statistics
  let tarSumR = 0, tarSumG = 0, tarSumB = 0;
  const tarCount = targetData.length / 4;
  for (let i = 0; i < targetData.length; i += 4) {
    tarSumR += targetData[i];
    tarSumG += targetData[i + 1];
    tarSumB += targetData[i + 2];
  }
  const tarMeanR = tarSumR / tarCount;
  const tarMeanG = tarSumG / tarCount;
  const tarMeanB = tarSumB / tarCount;

  let tarVarR = 0, tarVarG = 0, tarVarB = 0;
  for (let i = 0; i < targetData.length; i += 4) {
    tarVarR += Math.pow(targetData[i] - tarMeanR, 2);
    tarVarG += Math.pow(targetData[i + 1] - tarMeanG, 2);
    tarVarB += Math.pow(targetData[i + 2] - tarMeanB, 2);
  }
  const tarStdR = Math.sqrt(tarVarR / tarCount) || 1;
  const tarStdG = Math.sqrt(tarVarG / tarCount) || 1;
  const tarStdB = Math.sqrt(tarVarB / tarCount) || 1;

  const factor = intensityPercent / 100;

  // Apply Reinhard transfer
  for (let i = 0; i < targetData.length; i += 4) {
    const origR = targetData[i];
    const origG = targetData[i + 1];
    const origB = targetData[i + 2];

    const shiftedR = ((origR - tarMeanR) * (refStdR / tarStdR)) + refMeanR;
    const shiftedG = ((origG - tarMeanG) * (refStdG / tarStdG)) + refMeanG;
    const shiftedB = ((origB - tarMeanB) * (refStdB / tarStdB)) + refMeanB;

    targetData[i] = clamp(origR * (1 - factor) + shiftedR * factor);
    targetData[i + 1] = clamp(origG * (1 - factor) + shiftedG * factor);
    targetData[i + 2] = clamp(origB * (1 - factor) + shiftedB * factor);
  }

  targetCtx.putImageData(targetImgData, 0, 0);
}

/**
 * Generate standard Adobe / DaVinci Resolve .cube 3D LUT file
 */
export function generateCubeLut(presetKey: FilmLutPreset, size = 17): string {
  const filter = FILM_PRESETS[presetKey].colorFilter;
  let lines: string[] = [
    `# Created by PicTools Film LUT Studio`,
    `TITLE "${FILM_PRESETS[presetKey].name}"`,
    `LUT_3D_SIZE ${size}`,
    `DOMAIN_MIN 0.0 0.0 0.0`,
    `DOMAIN_MAX 1.0 1.0 1.0`,
    ``,
  ];

  for (let b = 0; b < size; b++) {
    for (let g = 0; g < size; g++) {
      for (let r = 0; r < size; r++) {
        const inR = (r / (size - 1)) * 255;
        const inG = (g / (size - 1)) * 255;
        const inB = (b / (size - 1)) * 255;

        const [outR, outG, outB] = filter(inR, inG, inB);

        const floatR = (outR / 255).toFixed(6);
        const floatG = (outG / 255).toFixed(6);
        const floatB = (outB / 255).toFixed(6);

        lines.push(`${floatR} ${floatG} ${floatB}`);
      }
    }
  }

  return lines.join("\n");
}

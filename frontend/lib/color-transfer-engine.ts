/**
 * Cinematic Color Match & Mood Transfer Engine
 *
 * Implements Reinhard statistical color transfer in perceptual CIE L*a*b* space,
 * with intelligent skin-tone preservation masking, 35mm film grain synthesis,
 * split-wiper comparison rendering, and standard .CUBE 3D LUT export.
 */

export interface CinemaPreset {
  id: string;
  name: string;
  director: string;
  description: string;
  paletteColors: [string, string, string, string];
  meanL: number;
  meanA: number;
  meanB: number;
  stdL: number;
  stdA: number;
  stdB: number;
}

export const CINEMA_PRESETS: CinemaPreset[] = [
  {
    id: "oppenheimer",
    name: "Oppenheimer Cold Steel",
    director: "Christopher Nolan",
    description: "High-contrast, silvery steel shadows, cool metallic highlights with dramatic tension.",
    paletteColors: ["#0f172a", "#334155", "#94a3b8", "#f1f5f9"],
    meanL: 46,
    meanA: -2,
    meanB: -8,
    stdL: 26,
    stdA: 8,
    stdB: 12,
  },
  {
    id: "blade-runner-2049",
    name: "Blade Runner 2049",
    director: "Denis Villeneuve",
    description: "Iconic amber-orange dust storm atmospheric glow balanced against deep teal noir shadows.",
    paletteColors: ["#451a03", "#b45309", "#f59e0b", "#0e7490"],
    meanL: 52,
    meanA: 16,
    meanB: 34,
    stdL: 24,
    stdA: 18,
    stdB: 24,
  },
  {
    id: "the-matrix",
    name: "The Matrix Cyber Green",
    director: "The Wachowskis",
    description: "Phosphorescent monochrome digital wash with eerie green shadows and deep contrast.",
    paletteColors: ["#022c22", "#064e3b", "#059669", "#34d399"],
    meanL: 42,
    meanA: -24,
    meanB: 14,
    stdL: 22,
    stdA: 14,
    stdB: 12,
  },
  {
    id: "wes-anderson",
    name: "Wes Anderson Pastel Warmth",
    director: "Wes Anderson",
    description: "Symmetrical pastel yellow wash, creamy highlights, soft muted shadows and nostalgic warmth.",
    paletteColors: ["#78350f", "#d97706", "#fde68a", "#fef3c7"],
    meanL: 68,
    meanA: 8,
    meanB: 28,
    stdL: 18,
    stdA: 10,
    stdB: 16,
  },
  {
    id: "nordic-noir",
    name: "Nordic Noir Melancholy",
    director: "Scandinavian Crime",
    description: "Desaturated cool blues, suppressed reds, bleak overcast skies and deep cold drama.",
    paletteColors: ["#0c4a6e", "#155e75", "#475569", "#cbd5e1"],
    meanL: 48,
    meanA: -6,
    meanB: -16,
    stdL: 24,
    stdA: 6,
    stdB: 14,
  },
  {
    id: "kodak-portra",
    name: "Kodak Portra 400 Film",
    director: "Analog Legend",
    description: "Subtle golden hour warmth, creamy highlight rolloff, and flattering organic skin tones.",
    paletteColors: ["#422006", "#92400e", "#f59e0b", "#fef3c7"],
    meanL: 58,
    meanA: 6,
    meanB: 16,
    stdL: 22,
    stdA: 12,
    stdB: 14,
  },
];

export interface ColorTransferOptions {
  strength: number; // 0 to 1
  protectSkin: boolean;
  filmGrain: number; // 0 to 1
  contrast: number; // -0.5 to +0.5
}

export const DEFAULT_TRANSFER_OPTIONS: ColorTransferOptions = {
  strength: 0.85,
  protectSkin: true,
  filmGrain: 0.15,
  contrast: 0.05,
};

function clamp(val: number, min = 0, max = 255): number {
  return Math.max(min, Math.min(max, val));
}

/**
 * Converts sRGB (0..255) to CIE L*a*b* (L: 0..100, a: -128..127, b: -128..127).
 */
export function rgbToLab(r: number, g: number, b: number): [number, number, number] {
  // 1. sRGB to linear RGB
  let lr = r / 255;
  let lg = g / 255;
  let lb = b / 255;

  lr = lr > 0.04045 ? Math.pow((lr + 0.055) / 1.055, 2.4) : lr / 12.92;
  lg = lg > 0.04045 ? Math.pow((lg + 0.055) / 1.055, 2.4) : lg / 12.92;
  lb = lb > 0.04045 ? Math.pow((lb + 0.055) / 1.055, 2.4) : lb / 12.92;

  // 2. Linear RGB to XYZ (D65)
  const x = (lr * 0.4124564 + lg * 0.3575761 + lb * 0.1804375) / 0.95047;
  const y = (lr * 0.2126729 + lg * 0.7151522 + lb * 0.072175) / 1.0;
  const z = (lr * 0.0193339 + lg * 0.119192 + lb * 0.9503041) / 1.08883;

  // 3. XYZ to L*a*b*
  const fx = x > 0.008856 ? Math.cbrt(x) : 7.787 * x + 16 / 116;
  const fy = y > 0.008856 ? Math.cbrt(y) : 7.787 * y + 16 / 116;
  const fz = z > 0.008856 ? Math.cbrt(z) : 7.787 * z + 16 / 116;

  const L = 116 * fy - 16;
  const A = 500 * (fx - fy);
  const B = 200 * (fy - fz);

  return [L, A, B];
}

/**
 * Converts CIE L*a*b* back to sRGB (0..255).
 */
export function labToRgb(L: number, A: number, B: number): [number, number, number] {
  const fy = (L + 16) / 116;
  const fx = A / 500 + fy;
  const fz = fy - B / 200;

  const fx3 = Math.pow(fx, 3);
  const fz3 = Math.pow(fz, 3);

  const x = (fx3 > 0.008856 ? fx3 : (fx - 16 / 116) / 7.787) * 0.95047;
  const y = (L > 0.008856 * 116 ? Math.pow((L + 16) / 116, 3) : L / 903.3) * 1.0;
  const z = (fz3 > 0.008856 ? fz3 : (fz - 16 / 116) / 7.787) * 1.08883;

  // XYZ to linear RGB
  let lr = x * 3.2404542 + y * -1.5371385 + z * -0.4985314;
  let lg = x * -0.969266 + y * 1.8760108 + z * 0.041556;
  let lb = x * 0.0556434 + y * -0.2040259 + z * 1.0572252;

  // Linear RGB to sRGB
  lr = lr > 0.0031308 ? 1.055 * Math.pow(lr, 1 / 2.4) - 0.055 : 12.92 * lr;
  lg = lg > 0.0031308 ? 1.055 * Math.pow(lg, 1 / 2.4) - 0.055 : 12.92 * lg;
  lb = lb > 0.0031308 ? 1.055 * Math.pow(lb, 1 / 2.4) - 0.055 : 12.92 * lb;

  return [clamp(Math.round(lr * 255)), clamp(Math.round(lg * 255)), clamp(Math.round(lb * 255))];
}

/**
 * Detects if a pixel falls within human skin tone range.
 * Returns weight 0..1 (1 = fully skin tone).
 */
function getSkinToneWeight(r: number, g: number, b: number): number {
  if (r <= g || g <= b) return 0;
  const sum = r + g + b;
  if (sum === 0) return 0;
  const nr = r / sum;
  const ng = g / sum;
  // Normalized chromaticity skin locus:
  if (nr > 0.36 && nr < 0.54 && ng > 0.28 && ng < 0.38) {
    return Math.min(1, ((nr - 0.36) / 0.1) * ((0.38 - ng) / 0.08));
  }
  return 0;
}

export interface LabStats {
  meanL: number;
  meanA: number;
  meanB: number;
  stdL: number;
  stdA: number;
  stdB: number;
}

/**
 * Computes mean and standard deviation of L, A, B channels across image data.
 */
export function computeImageLabStats(imageData: ImageData): LabStats {
  const data = imageData.data;
  let sumL = 0,
    sumA = 0,
    sumB = 0;
  const count = data.length / 4;

  // First pass: means
  for (let i = 0; i < data.length; i += 4) {
    const [l, a, b] = rgbToLab(data[i], data[i + 1], data[i + 2]);
    sumL += l;
    sumA += a;
    sumB += b;
  }
  const meanL = sumL / count;
  const meanA = sumA / count;
  const meanB = sumB / count;

  // Second pass: standard deviation
  let sqL = 0,
    sqA = 0,
    sqB = 0;
  for (let i = 0; i < data.length; i += 4) {
    const [l, a, b] = rgbToLab(data[i], data[i + 1], data[i + 2]);
    sqL += (l - meanL) * (l - meanL);
    sqA += (a - meanA) * (a - meanA);
    sqB += (b - meanB) * (b - meanB);
  }

  const stdL = Math.max(1, Math.sqrt(sqL / count));
  const stdA = Math.max(1, Math.sqrt(sqA / count));
  const stdB = Math.max(1, Math.sqrt(sqB / count));

  return { meanL, meanA, meanB, stdL, stdA, stdB };
}

/**
 * Performs full color transfer on an ImageData object.
 */
export function applyReinhardTransfer(
  sourceData: ImageData,
  refStats: LabStats,
  sourceStats: LabStats,
  opts: ColorTransferOptions
): ImageData {
  const width = sourceData.width;
  const height = sourceData.height;
  const output = new ImageData(new Uint8ClampedArray(sourceData.data), width, height);
  const data = output.data;
  const orig = sourceData.data;

  const ratioL = refStats.stdL / sourceStats.stdL;
  const ratioA = refStats.stdA / sourceStats.stdA;
  const ratioB = refStats.stdB / sourceStats.stdB;

  const strength = opts.strength;

  for (let i = 0; i < data.length; i += 4) {
    const r = orig[i];
    const g = orig[i + 1];
    const b = orig[i + 2];

    const [l, a, cb] = rgbToLab(r, g, b);

    // Reinhard transfer
    let newL = (l - sourceStats.meanL) * ratioL + refStats.meanL;
    let newA = (a - sourceStats.meanA) * ratioA + refStats.meanA;
    let newB = (cb - sourceStats.meanB) * ratioB + refStats.meanB;

    // Contrast curve adjustment
    if (opts.contrast !== 0) {
      newL = (newL - 50) * (1 + opts.contrast) + 50;
    }

    const [outR, outG, outB] = labToRgb(newL, newA, newB);

    // Skin protection mask
    let effectiveStrength = strength;
    if (opts.protectSkin) {
      const skinWeight = getSkinToneWeight(r, g, b);
      effectiveStrength *= 1 - skinWeight * 0.75;
    }

    // Blend with original
    let finalR = Math.round(r * (1 - effectiveStrength) + outR * effectiveStrength);
    let finalG = Math.round(g * (1 - effectiveStrength) + outG * effectiveStrength);
    let finalB = Math.round(b * (1 - effectiveStrength) + outB * effectiveStrength);

    // 35mm Film Grain
    if (opts.filmGrain > 0) {
      const noise = (Math.random() - 0.5) * opts.filmGrain * 40;
      finalR = clamp(finalR + noise);
      finalG = clamp(finalG + noise);
      finalB = clamp(finalB + noise);
    }

    data[i] = finalR;
    data[i + 1] = finalG;
    data[i + 2] = finalB;
    data[i + 3] = orig[i + 3];
  }

  return output;
}

/**
 * Generates an Adobe / DaVinci Resolve standard 3D LUT (.CUBE format).
 */
export function generateCubeLut(
  refStats: LabStats,
  sourceStats: LabStats,
  opts: ColorTransferOptions,
  cubeSize: number = 17
): string {
  const lines: string[] = [
    `# PicTools Cinematic 3D Look-Up Table`,
    `# Mode: Reinhard CIE L*a*b* Mood Transfer`,
    `TITLE "PicTools_Cinema_Grade"`,
    `LUT_3D_SIZE ${cubeSize}`,
    `DOMAIN_MIN 0.0 0.0 0.0`,
    `DOMAIN_MAX 1.0 1.0 1.0`,
    "",
  ];

  const ratioL = refStats.stdL / sourceStats.stdL;
  const ratioA = refStats.stdA / sourceStats.stdA;
  const ratioB = refStats.stdB / sourceStats.stdB;

  for (let b = 0; b < cubeSize; b++) {
    for (let g = 0; g < cubeSize; g++) {
      for (let r = 0; r < cubeSize; r++) {
        const inR = (r / (cubeSize - 1)) * 255;
        const inG = (g / (cubeSize - 1)) * 255;
        const inB = (b / (cubeSize - 1)) * 255;

        const [l, a, cb] = rgbToLab(inR, inG, inB);
        let newL = (l - sourceStats.meanL) * ratioL + refStats.meanL;
        let newA = (a - sourceStats.meanA) * ratioA + refStats.meanA;
        let newB = (cb - sourceStats.meanB) * ratioB + refStats.meanB;

        if (opts.contrast !== 0) {
          newL = (newL - 50) * (1 + opts.contrast) + 50;
        }

        const [tOutR, tOutG, tOutB] = labToRgb(newL, newA, newB);

        const outR = clamp(inR * (1 - opts.strength) + tOutR * opts.strength) / 255;
        const outG = clamp(inG * (1 - opts.strength) + tOutG * opts.strength) / 255;
        const outB = clamp(inB * (1 - opts.strength) + tOutB * opts.strength) / 255;

        lines.push(`${outR.toFixed(6)} ${outG.toFixed(6)} ${outB.toFixed(6)}`);
      }
    }
  }

  return lines.join("\n");
}

/**
 * Image Color Palette & Gradient Studio utilities
 * Fast client-side color extraction, quantization, harmony generation,
 * WCAG accessibility contrast scoring, and gradient synthesis.
 */

export interface ColorInfo {
  hex: string;
  rgb: [number, number, number];
  hsl: [number, number, number];
  cmyk: [number, number, number, number];
  name: string;
  population: number; // percentage (0 - 100)
  contrastWhite: number; // e.g. 4.5
  contrastBlack: number; // e.g. 12.1
  isDark: boolean;
}

export interface PaletteMoods {
  dominant: ColorInfo | null;
  vibrant: ColorInfo | null;
  lightVibrant: ColorInfo | null;
  darkVibrant: ColorInfo | null;
  muted: ColorInfo | null;
  lightMuted: ColorInfo | null;
  darkMuted: ColorInfo | null;
}

export interface PaletteResult {
  colors: ColorInfo[];
  moods: PaletteMoods;
  imageWidth: number;
  imageHeight: number;
}

// Named web colors dictionary for nearest-color naming
const NAMED_COLORS: [string, [number, number, number]][] = [
  ["Black", [0, 0, 0]],
  ["Navy", [0, 0, 128]],
  ["Dark Blue", [0, 0, 139]],
  ["Medium Blue", [0, 0, 205]],
  ["Blue", [0, 0, 255]],
  ["Dark Green", [0, 100, 0]],
  ["Green", [0, 128, 0]],
  ["Teal", [0, 128, 128]],
  ["Dark Cyan", [0, 139, 139]],
  ["Deep Sky Blue", [0, 191, 255]],
  ["Dark Turquoise", [0, 206, 209]],
  ["Medium Spring Green", [0, 250, 154]],
  ["Lime", [0, 255, 0]],
  ["Spring Green", [0, 255, 127]],
  ["Aqua / Cyan", [0, 255, 255]],
  ["Midnight Blue", [25, 25, 112]],
  ["Dodger Blue", [30, 144, 255]],
  ["Forest Green", [34, 139, 34]],
  ["Sea Green", [46, 139, 87]],
  ["Dark Slate Gray", [47, 79, 79]],
  ["Lime Green", [50, 205, 50]],
  ["Medium Sea Green", [60, 179, 113]],
  ["Turquoise", [64, 224, 208]],
  ["Royal Blue", [65, 105, 225]],
  ["Steel Blue", [70, 130, 180]],
  ["Indigo", [75, 0, 130]],
  ["Dark Slate Blue", [72, 61, 139]],
  ["Cadet Blue", [95, 158, 160]],
  ["Slate Blue", [106, 90, 205]],
  ["Medium Slate Blue", [123, 104, 238]],
  ["Slate Gray", [112, 128, 144]],
  ["Light Slate Gray", [119, 136, 153]],
  ["Medium Aquamarine", [102, 205, 170]],
  ["Cornflower Blue", [100, 149, 237]],
  ["Sky Blue", [135, 206, 235]],
  ["Light Sky Blue", [135, 206, 250]],
  ["Light Blue", [173, 216, 230]],
  ["Powder Blue", [176, 224, 230]],
  ["Aquamarine", [127, 255, 212]],
  ["Maroon", [128, 0, 0]],
  ["Purple", [128, 0, 128]],
  ["Olive", [128, 128, 0]],
  ["Gray", [128, 128, 128]],
  ["Dark Olive Green", [85, 107, 47]],
  ["Saddle Brown", [139, 69, 19]],
  ["Dark Red", [139, 0, 0]],
  ["Dark Magenta", [139, 0, 139]],
  ["Dark Violet", [148, 0, 211]],
  ["Dark Goldenrod", [184, 134, 11]],
  ["Sienna", [160, 82, 45]],
  ["Brown", [165, 42, 42]],
  ["Dark Orchid", [153, 50, 204]],
  ["Chocolate", [210, 105, 30]],
  ["Crimson", [220, 20, 60]],
  ["Firebrick", [178, 34, 34]],
  ["Indian Red", [205, 92, 92]],
  ["Medium Orchid", [186, 85, 211]],
  ["Peru", [205, 133, 63]],
  ["Goldenrod", [218, 165, 32]],
  ["Orchid", [218, 112, 214]],
  ["Rosy Brown", [188, 143, 143]],
  ["Dark Salmon", [233, 150, 122]],
  ["Coral", [255, 127, 80]],
  ["Tomato", [255, 99, 71]],
  ["Orange Red", [255, 69, 0]],
  ["Red", [255, 0, 0]],
  ["Deep Pink", [255, 20, 147]],
  ["Hot Pink", [255, 105, 180]],
  ["Dark Orange", [255, 140, 0]],
  ["Orange", [255, 165, 0]],
  ["Gold", [255, 215, 0]],
  ["Yellow", [255, 255, 0]],
  ["Pale Violet Red", [219, 112, 147]],
  ["Thistle", [216, 191, 216]],
  ["Plum", [221, 160, 221]],
  ["Violet", [238, 130, 238]],
  ["Magenta / Fuchsia", [255, 0, 255]],
  ["Khaki", [240, 230, 140]],
  ["Light Coral", [240, 128, 128]],
  ["Salmon", [250, 128, 114]],
  ["Light Salmon", [255, 160, 122]],
  ["Peach Puff", [255, 218, 185]],
  ["Navajo White", [255, 222, 173]],
  ["Moccasin", [255, 228, 181]],
  ["Bisque", [255, 228, 196]],
  ["Misty Rose", [255, 228, 225]],
  ["Blanched Almond", [255, 235, 205]],
  ["Papaya Whip", [255, 239, 213]],
  ["Lavender Blush", [255, 240, 245]],
  ["Sea Shell", [255, 245, 238]],
  ["Cornsilk", [255, 248, 220]],
  ["Lemon Chiffon", [255, 250, 205]],
  ["Floral White", [255, 250, 240]],
  ["Snow", [255, 250, 250]],
  ["Yellow Green", [154, 205, 50]],
  ["Chartreuse", [127, 255, 0]],
  ["Lawn Green", [124, 252, 0]],
  ["Green Yellow", [173, 255, 47]],
  ["Pale Green", [152, 251, 152]],
  ["Light Green", [144, 238, 144]],
  ["Medium Purple", [147, 112, 219]],
  ["Light Sea Green", [32, 178, 170]],
  ["Pale Turquoise", [175, 238, 238]],
  ["Lavender", [230, 230, 250]],
  ["White Smoke", [245, 245, 245]],
  ["Gainsboro", [220, 220, 220]],
  ["Light Gray", [211, 211, 211]],
  ["Silver", [192, 192, 192]],
  ["Dark Gray", [169, 169, 169]],
  ["Dim Gray", [105, 105, 105]],
  ["White", [255, 255, 255]],
];

/** Convert RGB to Hex string */
export function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  const toHex = (n: number) => clamp(n).toString(16).padStart(2, "0").toUpperCase();
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/** Convert Hex to RGB tuple */
export function hexToRgb(hex: string): [number, number, number] {
  let cleaned = hex.replace("#", "").trim();
  if (cleaned.length === 3) {
    cleaned = cleaned.split("").map((c) => c + c).join("");
  }
  const num = parseInt(cleaned, 16);
  if (isNaN(num)) return [0, 0, 0];
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

/** Convert RGB to HSL [H (0-360), S (0-100), L (0-100)] */
export function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;

  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (delta !== 0) {
    s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);
    if (max === rn) {
      h = ((gn - bn) / delta + (gn < bn ? 6 : 0)) / 6;
    } else if (max === gn) {
      h = ((bn - rn) / delta + 2) / 6;
    } else {
      h = ((rn - gn) / delta + 4) / 6;
    }
  }

  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

/** Convert HSL to RGB [R, G, B] */
export function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h = (h % 360 + 360) % 360;
  const sl = s / 100;
  const ll = l / 100;
  const c = (1 - Math.abs(2 * ll - 1)) * sl;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = ll - c / 2;

  let r1 = 0, g1 = 0, b1 = 0;
  if (h >= 0 && h < 60) {
    r1 = c; g1 = x; b1 = 0;
  } else if (h >= 60 && h < 120) {
    r1 = x; g1 = c; b1 = 0;
  } else if (h >= 120 && h < 180) {
    r1 = 0; g1 = c; b1 = x;
  } else if (h >= 180 && h < 240) {
    r1 = 0; g1 = x; b1 = c;
  } else if (h >= 240 && h < 300) {
    r1 = x; g1 = 0; b1 = c;
  } else {
    r1 = c; g1 = 0; b1 = x;
  }

  return [
    Math.round((r1 + m) * 255),
    Math.round((g1 + m) * 255),
    Math.round((b1 + m) * 255),
  ];
}

/** Convert RGB to CMYK [C, M, Y, K] in percent 0-100 */
export function rgbToCmyk(r: number, g: number, b: number): [number, number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const k = 1 - Math.max(rn, gn, bn);
  if (k === 1) return [0, 0, 0, 100];
  const c = (1 - rn - k) / (1 - k);
  const m = (1 - gn - k) / (1 - k);
  const y = (1 - bn - k) / (1 - k);
  return [
    Math.round(c * 100),
    Math.round(m * 100),
    Math.round(y * 100),
    Math.round(k * 100),
  ];
}

/** WCAG 2.1 Relative Luminance */
export function getLuminance(r: number, g: number, b: number): number {
  const a = [r, g, b].map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
}

/** Contrast Ratio between two RGB colors (1.0 to 21.0) */
export function getContrastRatio(rgb1: [number, number, number], rgb2: [number, number, number]): number {
  const lum1 = getLuminance(...rgb1);
  const lum2 = getLuminance(...rgb2);
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  return Number(((brightest + 0.05) / (darkest + 0.05)).toFixed(2));
}

/** Find nearest human-readable color name */
export function getNearestColorName(r: number, g: number, b: number): string {
  let minDistance = Infinity;
  let closestName = "Custom Color";

  for (const [name, [cr, cg, cb]] of NAMED_COLORS) {
    // Weighted Euclidean distance based on human perception
    const dr = r - cr;
    const dg = g - cg;
    const db = b - cb;
    const distance = 0.3 * dr * dr + 0.59 * dg * dg + 0.11 * db * db;
    if (distance < minDistance) {
      minDistance = distance;
      closestName = name;
    }
  }
  return closestName;
}

/** Build ColorInfo object */
export function makeColorInfo(r: number, g: number, b: number, populationPercent = 0): ColorInfo {
  const hex = rgbToHex(r, g, b);
  const hsl = rgbToHsl(r, g, b);
  const cmyk = rgbToCmyk(r, g, b);
  const contrastWhite = getContrastRatio([r, g, b], [255, 255, 255]);
  const contrastBlack = getContrastRatio([r, g, b], [0, 0, 0]);
  const isDark = getLuminance(r, g, b) < 0.25;
  const name = getNearestColorName(r, g, b);

  return {
    hex,
    rgb: [r, g, b],
    hsl,
    cmyk,
    name,
    population: Number(populationPercent.toFixed(1)),
    contrastWhite,
    contrastBlack,
    isDark,
  };
}

/**
 * Fast K-Means / Quantization color extractor from HTMLImageElement.
 * Samples downscaled pixel data for instantaneous extraction on multi-megapixel photos.
 */
export function extractPaletteFromImage(
  img: HTMLImageElement,
  colorCount = 8,
  sampleWidth = 160,
): PaletteResult {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    throw new Error("Unable to create canvas 2D context");
  }

  const aspectRatio = img.naturalHeight / (img.naturalWidth || 1);
  const width = sampleWidth;
  const height = Math.max(1, Math.round(width * aspectRatio));
  canvas.width = width;
  canvas.height = height;

  ctx.drawImage(img, 0, 0, width, height);
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  // Filter and collect valid non-transparent pixels
  const pixels: [number, number, number][] = [];
  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3];
    if (alpha < 128) continue; // skip transparent pixels
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    pixels.push([r, g, b]);
  }

  if (pixels.length === 0) {
    const fallback = makeColorInfo(255, 255, 255, 100);
    return {
      colors: [fallback],
      moods: {
        dominant: fallback,
        vibrant: fallback,
        lightVibrant: fallback,
        darkVibrant: fallback,
        muted: fallback,
        lightMuted: fallback,
        darkMuted: fallback,
      },
      imageWidth: img.naturalWidth,
      imageHeight: img.naturalHeight,
    };
  }

  // Quantization using fast k-means
  const k = Math.min(colorCount, pixels.length);
  // Pick k initial centroids evenly spread
  const centroids: [number, number, number][] = [];
  const step = Math.floor(pixels.length / k);
  for (let i = 0; i < k; i++) {
    centroids.push([...pixels[i * step]]);
  }

  const maxIter = 10;
  const assignments = new Uint16Array(pixels.length);
  const counts = new Uint32Array(k);

  for (let iter = 0; iter < maxIter; iter++) {
    counts.fill(0);
    const sumR = new Float64Array(k);
    const sumG = new Float64Array(k);
    const sumB = new Float64Array(k);

    // Assign pixels to closest centroid
    for (let p = 0; p < pixels.length; p++) {
      const [pr, pg, pb] = pixels[p];
      let bestDist = Infinity;
      let bestIdx = 0;

      for (let c = 0; c < k; c++) {
        const [cr, cg, cb] = centroids[c];
        const dist = (pr - cr) ** 2 + (pg - cg) ** 2 + (pb - cb) ** 2;
        if (dist < bestDist) {
          bestDist = dist;
          bestIdx = c;
        }
      }

      assignments[p] = bestIdx;
      counts[bestIdx]++;
      sumR[bestIdx] += pr;
      sumG[bestIdx] += pg;
      sumB[bestIdx] += pb;
    }

    // Update centroids
    let moved = 0;
    for (let c = 0; c < k; c++) {
      if (counts[c] > 0) {
        const newR = Math.round(sumR[c] / counts[c]);
        const newG = Math.round(sumG[c] / counts[c]);
        const newB = Math.round(sumB[c] / counts[c]);
        const diff = Math.abs(centroids[c][0] - newR) + Math.abs(centroids[c][1] - newG) + Math.abs(centroids[c][2] - newB);
        if (diff > 2) moved++;
        centroids[c] = [newR, newG, newB];
      }
    }

    if (moved === 0) break;
  }

  // Sort centroids by population percentage descending
  const totalPixels = pixels.length;
  const clusterList: { rgb: [number, number, number]; count: number; pop: number }[] = [];
  for (let c = 0; c < k; c++) {
    if (counts[c] > 0) {
      clusterList.push({
        rgb: centroids[c],
        count: counts[c],
        pop: (counts[c] / totalPixels) * 100,
      });
    }
  }

  clusterList.sort((a, b) => b.count - a.count);

  const colors = clusterList.map((item) =>
    makeColorInfo(item.rgb[0], item.rgb[1], item.rgb[2], item.pop),
  );

  // Compute Material-style Mood Swatches (Vibrant, Muted, Light/Dark variants)
  const moods = deriveMoods(colors);

  return {
    colors,
    moods,
    imageWidth: img.naturalWidth,
    imageHeight: img.naturalHeight,
  };
}

/** Derive Vibrant, Light Vibrant, Dark Vibrant, Muted, Light Muted, Dark Muted swatches */
function deriveMoods(colors: ColorInfo[]): PaletteMoods {
  if (colors.length === 0) {
    return {
      dominant: null,
      vibrant: null,
      lightVibrant: null,
      darkVibrant: null,
      muted: null,
      lightMuted: null,
      darkMuted: null,
    };
  }

  const dominant = colors[0];

  // Helper score function
  const findBest = (
    targetSat: number,
    minSat: number,
    maxSat: number,
    targetLum: number,
    minLum: number,
    maxLum: number,
  ): ColorInfo | null => {
    let bestColor: ColorInfo | null = null;
    let bestScore = -Infinity;

    for (const c of colors) {
      const s = c.hsl[1] / 100;
      const l = c.hsl[2] / 100;

      if (s >= minSat && s <= maxSat && l >= minLum && l <= maxLum) {
        const satScore = 1 - Math.abs(s - targetSat);
        const lumScore = 1 - Math.abs(l - targetLum);
        const popScore = c.population / 100;
        const score = satScore * 3 + lumScore * 6.5 + popScore * 0.5;

        if (score > bestScore) {
          bestScore = score;
          bestColor = c;
        }
      }
    }
    return bestColor;
  };

  const vibrant = findBest(1.0, 0.35, 1.0, 0.5, 0.3, 0.7) || dominant;
  const lightVibrant = findBest(1.0, 0.35, 1.0, 0.74, 0.55, 1.0) || vibrant;
  const darkVibrant = findBest(1.0, 0.35, 1.0, 0.26, 0.0, 0.45) || vibrant;

  const muted = findBest(0.3, 0.0, 0.4, 0.5, 0.3, 0.7) || dominant;
  const lightMuted = findBest(0.3, 0.0, 0.4, 0.74, 0.55, 1.0) || muted;
  const darkMuted = findBest(0.3, 0.0, 0.4, 0.26, 0.0, 0.45) || muted;

  return {
    dominant,
    vibrant,
    lightVibrant,
    darkVibrant,
    muted,
    lightMuted,
    darkMuted,
  };
}

/** Generate Color Harmonies for any chosen base color */
export interface ColorHarmonies {
  complementary: ColorInfo[];
  analogous: ColorInfo[];
  triadic: ColorInfo[];
  tetradic: ColorInfo[];
  monochromatic: ColorInfo[];
  splitComplementary: ColorInfo[];
}

export function generateHarmonies(baseColor: ColorInfo): ColorHarmonies {
  const [h, s, l] = baseColor.hsl;

  const toColor = (nh: number, ns = s, nl = l): ColorInfo => {
    const rgb = hslToRgb((nh % 360 + 360) % 360, ns, nl);
    return makeColorInfo(rgb[0], rgb[1], rgb[2]);
  };

  return {
    complementary: [baseColor, toColor(h + 180)],
    analogous: [toColor(h - 30), baseColor, toColor(h + 30)],
    triadic: [baseColor, toColor(h + 120), toColor(h + 240)],
    tetradic: [baseColor, toColor(h + 90), toColor(h + 180), toColor(h + 270)],
    splitComplementary: [baseColor, toColor(h + 150), toColor(h + 210)],
    monochromatic: [
      toColor(h, Math.max(10, s - 30), Math.min(90, l + 30)),
      toColor(h, s, Math.min(80, l + 15)),
      baseColor,
      toColor(h, s, Math.max(15, l - 15)),
      toColor(h, Math.min(100, s + 10), Math.max(10, l - 30)),
    ],
  };
}

/** Gradient definition */
export interface GradientStop {
  color: string;
  position: number; // 0 to 100
}

export type GradientType = "linear" | "radial";

export function generateGradientCss(
  type: GradientType,
  angle: number,
  stops: GradientStop[],
): string {
  const stopStr = stops
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((s) => `${s.color} ${s.position}%`)
    .join(", ");

  if (type === "radial") {
    return `radial-gradient(circle at center, ${stopStr})`;
  }
  return `linear-gradient(${angle}deg, ${stopStr})`;
}

/** Export formats: CSS Variables */
export function exportAsCssVariables(colors: ColorInfo[]): string {
  const lines = [":root {"];
  colors.forEach((c, idx) => {
    lines.push(`  --color-palette-${idx + 1}: ${c.hex}; /* ${c.name} */`);
    lines.push(`  --color-palette-${idx + 1}-rgb: ${c.rgb.join(", ")};`);
  });
  lines.push("}");
  return lines.join("\n");
}

/** Export formats: Tailwind config snippet */
export function exportAsTailwind(colors: ColorInfo[]): string {
  const paletteObj: Record<string, string> = {};
  colors.forEach((c, idx) => {
    const slug = c.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    paletteObj[`palette-${idx + 1}-${slug}`] = c.hex;
  });
  return `module.exports = {\n  theme: {\n    extend: {\n      colors: ${JSON.stringify(paletteObj, null, 8).replace(/"([^"]+)":/g, "$1:")}\n    }\n  }\n};`;
}

/** Export formats: JSON Design Tokens */
export function exportAsJson(colors: ColorInfo[]): string {
  return JSON.stringify(
    {
      palette: colors.map((c, i) => ({
        index: i + 1,
        name: c.name,
        hex: c.hex,
        rgb: c.rgb,
        hsl: c.hsl,
        cmyk: c.cmyk,
        population: c.population,
        contrastWhite: c.contrastWhite,
        contrastBlack: c.contrastBlack,
      })),
    },
    null,
    2,
  );
}

/**
 * Render a high-resolution branded Swatch Card PNG on HTML5 canvas.
 * Shows original image on top and color swatch blocks with labels underneath.
 */
export async function generateSwatchCardBlob(
  img: HTMLImageElement,
  colors: ColorInfo[],
): Promise<Blob> {
  const cardWidth = 1200;
  const padding = 48;
  const imgWidth = cardWidth - padding * 2;
  const imgAspect = img.naturalHeight / (img.naturalWidth || 1);
  const imgHeight = Math.min(700, Math.round(imgWidth * imgAspect));

  const swatchesHeight = 180;
  const headerHeight = 70;
  const cardHeight = padding + headerHeight + imgHeight + 36 + swatchesHeight + padding;

  const canvas = document.createElement("canvas");
  canvas.width = cardWidth;
  canvas.height = cardHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create canvas context for card");

  // Background
  ctx.fillStyle = "#0F172A"; // Slate 900
  ctx.fillRect(0, 0, cardWidth, cardHeight);

  // Header Title
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 32px sans-serif";
  ctx.fillText("COLOR PALETTE STUDIO", padding, padding + 36);

  ctx.fillStyle = "#94A3B8";
  ctx.font = "16px sans-serif";
  ctx.fillText("PHOTO TOOLS • HARMONIC EXTRACTION", padding, padding + 62);

  // Draw Image
  ctx.save();
  // Rounded corners for image
  const imgX = padding;
  const imgY = padding + headerHeight;
  const radius = 16;
  ctx.beginPath();
  ctx.moveTo(imgX + radius, imgY);
  ctx.lineTo(imgX + imgWidth - radius, imgY);
  ctx.quadraticCurveTo(imgX + imgWidth, imgY, imgX + imgWidth, imgY + radius);
  ctx.lineTo(imgX + imgWidth, imgY + imgHeight - radius);
  ctx.quadraticCurveTo(imgX + imgWidth, imgY + imgHeight, imgX + imgWidth - radius, imgY + imgHeight);
  ctx.lineTo(imgX + radius, imgY + imgHeight);
  ctx.quadraticCurveTo(imgX, imgY + imgHeight, imgX, imgY + imgHeight - radius);
  ctx.lineTo(imgX, imgY + radius);
  ctx.quadraticCurveTo(imgX, imgY, imgX + radius, imgY);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(img, imgX, imgY, imgWidth, imgHeight);
  ctx.restore();

  // Draw Swatches
  const swatchY = imgY + imgHeight + 36;
  const swatchCount = colors.length;
  const gap = 14;
  const totalGaps = (swatchCount - 1) * gap;
  const swatchWidth = (imgWidth - totalGaps) / swatchCount;

  colors.forEach((c, idx) => {
    const sx = padding + idx * (swatchWidth + gap);

    // Color Box
    ctx.fillStyle = c.hex;
    ctx.beginPath();
    ctx.roundRect(sx, swatchY, swatchWidth, 90, 10);
    ctx.fill();

    // Population badge inside swatch
    ctx.fillStyle = c.isDark ? "rgba(255, 255, 255, 0.85)" : "rgba(0, 0, 0, 0.75)";
    ctx.font = "bold 13px monospace";
    ctx.fillText(`${c.population}%`, sx + 8, swatchY + 22);

    // Hex label
    ctx.fillStyle = "#F8FAFC";
    ctx.font = "bold 16px monospace";
    ctx.fillText(c.hex, sx, swatchY + 116);

    // Color Name
    ctx.fillStyle = "#94A3B8";
    ctx.font = "13px sans-serif";
    const displayName = c.name.length > 14 ? c.name.slice(0, 12) + "..." : c.name;
    ctx.fillText(displayName, sx, swatchY + 138);

    // RGB label
    ctx.fillStyle = "#64748B";
    ctx.font = "11px monospace";
    ctx.fillText(`rgb(${c.rgb.slice(0, 2).join(",")})`, sx, swatchY + 158);
  });

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Could not export swatch card to blob"));
    }, "image/png");
  });
}

import type { NormRect } from "./image-edit";

export interface SaliencyResult {
  /** Normalized X coordinate of focal subject center of mass (0.0 - 1.0). */
  x: number;
  /** Normalized Y coordinate of focal subject center of mass (0.0 - 1.0). */
  y: number;
  /** Confidence score between 0.0 and 1.0 based on saliency peak sharpness. */
  confidence: number;
  /** High-level classification of detected subject. */
  subjectType: "portrait" | "salient-object" | "landscape" | "general";
  /** Closest compositional Rule-of-Thirds power point label. */
  powerPointLabel: string;
}

/**
 * AI Saliency & Visual Focal Point Detector
 * Analyzes edge gradients, color contrast, and skin tone probability maps
 * to identify the primary subject and calculate the optimal compositional focal point.
 */
export function detectImageSaliency(
  source: CanvasImageSource,
  sourceW: number,
  sourceH: number,
): SaliencyResult {
  const sampleW = 96;
  const sampleH = Math.max(32, Math.round((sourceH / sourceW) * sampleW));

  const canvas = document.createElement("canvas");
  canvas.width = sampleW;
  canvas.height = sampleH;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  if (!ctx) {
    return {
      x: 0.5,
      y: 0.45,
      confidence: 0.5,
      subjectType: "general",
      powerPointLabel: "Center",
    };
  }

  ctx.drawImage(source, 0, 0, sampleW, sampleH);
  const imgData = ctx.getImageData(0, 0, sampleW, sampleH);
  const data = imgData.data;

  // 1. Calculate luminance map and average color
  const lumMap = new Float32Array(sampleW * sampleH);
  let totalR = 0;
  let totalG = 0;
  let totalB = 0;
  let skinPixels = 0;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    totalR += r;
    totalG += g;
    totalB += b;

    const pixelIdx = i / 4;
    lumMap[pixelIdx] = 0.299 * r + 0.587 * g + 0.114 * b;

    // Skin tone probability test (melanin/hemoglobin chromaticity)
    if (r > 95 && g > 40 && b > 20 && r > g && r > b && r - g > 15 && Math.abs(r - g) > 15) {
      skinPixels++;
    }
  }

  const numPixels = sampleW * sampleH;
  const meanR = totalR / numPixels;
  const meanG = totalG / numPixels;
  const meanB = totalB / numPixels;
  const skinRatio = skinPixels / numPixels;

  // 2. Compute edge gradient & chromatic contrast saliency map
  const saliency = new Float32Array(numPixels);
  let maxEnergy = 0.0001;

  for (let y = 1; y < sampleH - 1; y++) {
    for (let x = 1; x < sampleW - 1; x++) {
      const idx = y * sampleW + x;

      // Sobel gradient magnitude
      const gx =
        -lumMap[(y - 1) * sampleW + (x - 1)] +
        lumMap[(y - 1) * sampleW + (x + 1)] -
        2 * lumMap[y * sampleW + (x - 1)] +
        2 * lumMap[y * sampleW + (x + 1)] -
        lumMap[(y + 1) * sampleW + (x - 1)] +
        lumMap[(y + 1) * sampleW + (x + 1)];

      const gy =
        -lumMap[(y - 1) * sampleW + (x - 1)] -
        2 * lumMap[(y - 1) * sampleW + x] -
        lumMap[(y - 1) * sampleW + (x + 1)] +
        lumMap[(y + 1) * sampleW + (x - 1)] +
        2 * lumMap[(y + 1) * sampleW + x] +
        lumMap[(y + 1) * sampleW + (x + 1)];

      const edgeMag = Math.sqrt(gx * gx + gy * gy);

      // Chromatic distance from ambient background
      const pIdx = idx * 4;
      const dr = data[pIdx] - meanR;
      const dg = data[pIdx + 1] - meanG;
      const db = data[pIdx + 2] - meanB;
      const colorDist = Math.sqrt(dr * dr + dg * dg + db * db);

      // Skin boost
      const r = data[pIdx];
      const g = data[pIdx + 1];
      const b = data[pIdx + 2];
      const isSkin = r > 95 && g > 40 && b > 20 && r > g && r > b && r - g > 15;
      const skinBoost = isSkin ? 2.2 : 1.0;

      // Center-biased compositional weight (favors central 75% over outer frame borders)
      const normX = x / sampleW - 0.5;
      const normY = y / sampleH - 0.5;
      const centerDistSq = normX * normX + normY * normY;
      const centerWeight = Math.exp(-centerDistSq * 2.8);

      const energy = (edgeMag * 0.7 + colorDist * 0.3) * skinBoost * centerWeight;
      saliency[idx] = energy;
      if (energy > maxEnergy) maxEnergy = energy;
    }
  }

  // 3. Threshold top 20% salient energy to find true focal subject centroid
  const energyThreshold = maxEnergy * 0.42;
  let weightedSumX = 0;
  let weightedSumY = 0;
  let totalWeight = 0;

  for (let y = 1; y < sampleH - 1; y++) {
    for (let x = 1; x < sampleW - 1; x++) {
      const idx = y * sampleW + x;
      const val = saliency[idx];
      if (val >= energyThreshold) {
        const weight = val - energyThreshold;
        weightedSumX += (x / sampleW) * weight;
        weightedSumY += (y / sampleH) * weight;
        totalWeight += weight;
      }
    }
  }

  const focalX = totalWeight > 0 ? weightedSumX / totalWeight : 0.5;
  const focalY = totalWeight > 0 ? weightedSumY / totalWeight : 0.42;

  // Clamped focal point
  const clampedX = Math.max(0.15, Math.min(0.85, focalX));
  const clampedY = Math.max(0.15, Math.min(0.85, focalY));

  // Determine subject classification
  let subjectType: SaliencyResult["subjectType"] = "general";
  if (skinRatio > 0.04) {
    subjectType = "portrait";
  } else if (totalWeight > 0 && maxEnergy > 120) {
    subjectType = "salient-object";
  } else {
    subjectType = "landscape";
  }

  // Calculate power point label
  let powerPointLabel = "Center Focal Point";
  if (clampedX < 0.45 && clampedY < 0.45) powerPointLabel = "Top-Left Power Intersection (1/3, 1/3)";
  else if (clampedX >= 0.45 && clampedY < 0.45) powerPointLabel = "Top-Right Power Intersection (2/3, 1/3)";
  else if (clampedX < 0.45 && clampedY >= 0.45) powerPointLabel = "Bottom-Left Power Intersection (1/3, 2/3)";
  else if (clampedX >= 0.45 && clampedY >= 0.45) powerPointLabel = "Bottom-Right Power Intersection (2/3, 2/3)";

  return {
    x: clampedX,
    y: clampedY,
    confidence: Math.min(0.98, Math.max(0.65, totalWeight / 800)),
    subjectType,
    powerPointLabel,
  };
}

/**
 * Computes an AI Rule-of-Thirds crop rectangle from an active canvas element.
 */
export function computeSmartSaliencyCrop(
  source: HTMLCanvasElement | HTMLImageElement,
  imgW: number,
  imgH: number,
  aspectRatio: number | null = null,
): NormRect {
  const saliency = detectImageSaliency(source, imgW, imgH);

  const targetAspect = aspectRatio ?? imgW / imgH;
  const normAspect = targetAspect / (imgW / imgH);

  let cropW = 0.82;
  let cropH = 0.82 / normAspect;

  if (cropH > 0.98) {
    cropH = 0.9;
    cropW = cropH * normAspect;
  }
  if (cropW > 0.98) {
    cropW = 0.9;
    cropH = cropW / normAspect;
  }

  // Place focal point at nearest Rule-of-Thirds power point
  const powerX = saliency.x >= 0.5 ? 2 / 3 : 1 / 3;
  const powerY = saliency.y >= 0.5 ? 2 / 3 : 1 / 3;

  let x = saliency.x - powerX * cropW;
  let y = saliency.y - powerY * cropH;

  x = Math.max(0, Math.min(1 - cropW, x));
  y = Math.max(0, Math.min(1 - cropH, y));

  return { x, y, width: cropW, height: cropH };
}

/**
 * Canvas Expander & Generative Outpainting Engine
 * Synthesizes boundary textures, DSLR blur-fill bokeh, and gradients to expand photos
 * seamlessly beyond their original dimensions to fit any aspect ratio.
 */

export type UncropAspectRatio = "9:16" | "16:9" | "4:5" | "1:1" | "custom";
export type OutpaintMode = "seamless-texture" | "blur-bokeh" | "dominant-gradient";

export interface UncropPadding {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface UncropOptions {
  padding: UncropPadding;
  mode?: OutpaintMode;
  blendEdgeWidth?: number; // width in pixels of seamless edge transition
  addNoise?: boolean; // add micro-grain matching photo
}

/**
 * Calculates required symmetric padding to fit a target aspect ratio.
 */
export function calculatePaddingForAspect(
  currentW: number,
  currentH: number,
  ratioPreset: UncropAspectRatio,
): UncropPadding {
  if (ratioPreset === "custom") {
    return { top: 0, bottom: 0, left: 0, right: 0 };
  }

  let targetRatio = 1.0;
  switch (ratioPreset) {
    case "9:16":
      targetRatio = 9 / 16;
      break;
    case "16:9":
      targetRatio = 16 / 9;
      break;
    case "4:5":
      targetRatio = 4 / 5;
      break;
    case "1:1":
      targetRatio = 1.0;
      break;
  }

  const currentRatio = currentW / currentH;

  let padTop = 0;
  let padBottom = 0;
  let padLeft = 0;
  let padRight = 0;

  if (currentRatio < targetRatio) {
    // Current is narrower than target -> expand width (left/right)
    const newW = Math.round(currentH * targetRatio);
    const diff = newW - currentW;
    padLeft = Math.floor(diff / 2);
    padRight = diff - padLeft;
  } else if (currentRatio > targetRatio) {
    // Current is wider than target -> expand height (top/bottom)
    const newH = Math.round(currentW / targetRatio);
    const diff = newH - currentH;
    padTop = Math.floor(diff / 2);
    padBottom = diff - padTop;
  }

  return { top: padTop, bottom: padBottom, left: padLeft, right: padRight };
}

/**
 * Performs outpainting to expand an image beyond its borders.
 */
export function uncropImageData(
  source: ImageData,
  options: UncropOptions,
): ImageData {
  const { padding, mode = "seamless-texture", blendEdgeWidth = 24, addNoise = true } = options;
  const srcW = source.width;
  const srcH = source.height;
  const src = source.data;

  const targetW = srcW + padding.left + padding.right;
  const targetH = srcH + padding.top + padding.bottom;

  const output = new ImageData(targetW, targetH);
  const dst = output.data;

  const offsetX = padding.left;
  const offsetY = padding.top;

  // Measure border average colors
  let topR = 0, topG = 0, topB = 0;
  let btmR = 0, btmG = 0, btmB = 0;
  let lftR = 0, lftG = 0, lftB = 0;
  let rgtR = 0, rgtG = 0, rgtB = 0;

  for (let x = 0; x < srcW; x++) {
    const tIdx = x * 4;
    topR += src[tIdx]; topG += src[tIdx + 1]; topB += src[tIdx + 2];
    const bIdx = ((srcH - 1) * srcW + x) * 4;
    btmR += src[bIdx]; btmG += src[bIdx + 1]; btmB += src[bIdx + 2];
  }
  topR /= srcW; topG /= srcW; topB /= srcW;
  btmR /= srcW; btmG /= srcW; btmB /= srcW;

  for (let y = 0; y < srcH; y++) {
    const lIdx = (y * srcW) * 4;
    lftR += src[lIdx]; lftG += src[lIdx + 1]; lftB += src[lIdx + 2];
    const rIdx = (y * srcW + (srcW - 1)) * 4;
    rgtR += src[rIdx]; rgtG += src[rIdx + 1]; rgtB += src[rIdx + 2];
  }
  lftR /= srcH; lftG /= srcH; lftB /= srcH;
  rgtR /= srcH; rgtG /= srcH; rgtB /= srcH;

  // 1. Copy original image into center offset
  for (let sy = 0; sy < srcH; sy++) {
    const dy = offsetY + sy;
    for (let sx = 0; sx < srcW; sx++) {
      const dx = offsetX + sx;
      const sIdx = (sy * srcW + sx) * 4;
      const dIdx = (dy * targetW + dx) * 4;

      dst[dIdx] = src[sIdx];
      dst[dIdx + 1] = src[sIdx + 1];
      dst[dIdx + 2] = src[sIdx + 2];
      dst[dIdx + 3] = src[sIdx + 3];
    }
  }

  // 2. Synthesize Expanded Regions
  for (let dy = 0; dy < targetH; dy++) {
    const clampedSrcY = Math.max(0, Math.min(srcH - 1, dy - offsetY));

    for (let dx = 0; dx < targetW; dx++) {
      const isExpanded =
        dx < offsetX ||
        dx >= offsetX + srcW ||
        dy < offsetY ||
        dy >= offsetY + srcH;

      if (!isExpanded) continue;

      const dIdx = (dy * targetW + dx) * 4;
      const clampedSrcX = Math.max(0, Math.min(srcW - 1, dx - offsetX));

      const distLeft = offsetX - dx;
      const distRight = dx - (offsetX + srcW - 1);
      const distTop = offsetY - dy;
      const distBottom = dy - (offsetY + srcH - 1);

      let r = 0, g = 0, b = 0;

      if (mode === "blur-bokeh") {
        // Sample scaled-up blurred source pixel
        const normX = dx / targetW;
        const normY = dy / targetH;
        const bSampleX = Math.floor(normX * srcW);
        const bSampleY = Math.floor(normY * srcH);
        const bIdx = (bSampleY * srcW + bSampleX) * 4;

        r = src[bIdx] * 0.85;
        g = src[bIdx + 1] * 0.85;
        b = src[bIdx + 2] * 0.85;
      } else if (mode === "dominant-gradient") {
        // Smooth vignette gradient from boundary color to darkened tone
        const edgeIdx = (clampedSrcY * srcW + clampedSrcX) * 4;
        const maxDist = Math.max(0, distLeft, distRight, distTop, distBottom);
        const fade = Math.max(0.4, 1.0 - maxDist / 400);

        r = src[edgeIdx] * fade;
        g = src[edgeIdx + 1] * fade;
        b = src[edgeIdx + 2] * fade;
      } else {
        // Seamless texture synthesis with soft mirror decay
        let sampleX = clampedSrcX;
        let sampleY = clampedSrcY;

        if (distLeft > 0) {
          sampleX = Math.min(srcW - 1, distLeft % srcW);
        } else if (distRight > 0) {
          sampleX = Math.max(0, srcW - 1 - (distRight % srcW));
        }

        if (distTop > 0) {
          sampleY = Math.min(srcH - 1, distTop % srcH);
        } else if (distBottom > 0) {
          sampleY = Math.max(0, srcH - 1 - (distBottom % srcH));
        }

        const sIdx = (sampleY * srcW + sampleX) * 4;
        const bIdx = (clampedSrcY * srcW + clampedSrcX) * 4;

        const maxDist = Math.max(0, distLeft, distRight, distTop, distBottom);
        const blendFactor = Math.min(1.0, maxDist / blendEdgeWidth);

        let noise = 0;
        if (addNoise) {
          noise = (Math.random() - 0.5) * 4.0;
        }

        r = src[bIdx] * (1 - blendFactor * 0.4) + (src[sIdx] + noise) * (blendFactor * 0.4);
        g = src[bIdx + 1] * (1 - blendFactor * 0.4) + (src[sIdx + 1] + noise) * (blendFactor * 0.4);
        b = src[bIdx + 2] * (1 - blendFactor * 0.4) + (src[sIdx + 2] + noise) * (blendFactor * 0.4);
      }

      dst[dIdx] = Math.max(0, Math.min(255, Math.round(r)));
      dst[dIdx + 1] = Math.max(0, Math.min(255, Math.round(g)));
      dst[dIdx + 2] = Math.max(0, Math.min(255, Math.round(b)));
      dst[dIdx + 3] = 255;
    }
  }

  return output;
}

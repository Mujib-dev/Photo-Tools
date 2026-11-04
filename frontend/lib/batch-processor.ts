/**
 * Batch Watermarking & Bulk Photo Rename Engine
 * High-performance client-side image processing, watermark rendering,
 * token-based filename templating, and ZIP bundling.
 */

import { createZip, type ZipEntry } from "./zip";

export type WatermarkPosition =
  | "top-left"
  | "top-center"
  | "top-right"
  | "center-left"
  | "center"
  | "center-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right"
  | "tile";

export interface BatchWatermarkOptions {
  enabled: boolean;
  type: "text" | "logo";
  text: string;
  fontFamily: string;
  fontSizePercent: number; // 1 to 20 percent of image shortest dimension
  color: string;
  opacity: number; // 0 to 100
  position: WatermarkPosition;
  logoImg?: HTMLImageElement | null;
  logoScalePercent: number; // 5 to 50 percent of image width
}

export interface BatchRenameOptions {
  pattern: string; // e.g. "{name}-{0index}"
  findText: string;
  replaceText: string;
  caseTransform: "none" | "lower" | "upper" | "title";
  prefix: string;
  suffix: string;
  startIndex: number;
}

export interface BatchResizeOptions {
  mode: "original" | "max-dim" | "scale";
  maxDimension: number; // e.g. 1920
  scalePercent: number; // e.g. 50
  format: "original" | "jpeg" | "png" | "webp";
  quality: number; // 0.1 to 1.0
}

export interface BatchItem {
  id: string;
  file: File;
  previewUrl: string;
  width: number;
  height: number;
  originalName: string;
  renamedName: string;
  status: "pending" | "processing" | "done" | "error";
  processedBlob?: Blob;
  errorMessage?: string;
}

/** Compute renamed filename for an item based on pattern and rules */
export function computeRenamedFilename(
  originalFilename: string,
  index: number,
  renameOpts: BatchRenameOptions,
  targetFormat: "original" | "jpeg" | "png" | "webp",
): string {
  const lastDot = originalFilename.lastIndexOf(".");
  let base = lastDot > 0 ? originalFilename.slice(0, lastDot) : originalFilename;
  const originalExt = lastDot > 0 ? originalFilename.slice(lastDot + 1).toLowerCase() : "jpg";

  // Determine target extension
  let ext = originalExt;
  if (targetFormat === "jpeg") ext = "jpg";
  else if (targetFormat === "png") ext = "png";
  else if (targetFormat === "webp") ext = "webp";

  // Find & Replace
  if (renameOpts.findText) {
    base = base.replaceAll(renameOpts.findText, renameOpts.replaceText);
  }

  // Current date tokens
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const yyyy = now.getFullYear();
  const mm = pad(now.getMonth() + 1);
  const dd = pad(now.getDate());
  const dateStr = `${yyyy}${mm}${dd}`;

  const seq = renameOpts.startIndex + index;
  const seq2 = String(seq).padStart(2, "0");
  const seq3 = String(seq).padStart(3, "0");

  // Pattern replacement
  let result = renameOpts.pattern
    .replaceAll("{name}", base)
    .replaceAll("{index}", String(seq))
    .replaceAll("{0index}", seq2)
    .replaceAll("{00index}", seq3)
    .replaceAll("{date}", dateStr);

  // Prefix and Suffix
  if (renameOpts.prefix) result = renameOpts.prefix + result;
  if (renameOpts.suffix) result = result + renameOpts.suffix;

  // Case transform
  if (renameOpts.caseTransform === "lower") {
    result = result.toLowerCase();
  } else if (renameOpts.caseTransform === "upper") {
    result = result.toUpperCase();
  } else if (renameOpts.caseTransform === "title") {
    result = result.replace(/\b\w/g, (c) => c.toUpperCase());
  }

  // Sanitize filename for filesystem safety
  result = result.replace(/[<>:"/\\|?*\x00-\x1F]/g, "_").trim();
  if (!result) result = `photo-${seq2}`;

  return `${result}.${ext}`;
}

/** Render watermark and resize single image on canvas, returning processed Blob */
export async function processBatchImage(
  img: HTMLImageElement,
  watermark: BatchWatermarkOptions,
  resize: BatchResizeOptions,
  originalMime: string,
): Promise<Blob> {
  let targetWidth = img.naturalWidth || 800;
  let targetHeight = img.naturalHeight || 600;

  // Calculate target dimensions
  if (resize.mode === "scale") {
    const factor = Math.max(0.1, Math.min(2.0, resize.scalePercent / 100));
    targetWidth = Math.round(targetWidth * factor);
    targetHeight = Math.round(targetHeight * factor);
  } else if (resize.mode === "max-dim") {
    const maxDim = resize.maxDimension;
    if (targetWidth > maxDim || targetHeight > maxDim) {
      if (targetWidth >= targetHeight) {
        targetHeight = Math.round((targetHeight * maxDim) / targetWidth);
        targetWidth = maxDim;
      } else {
        targetWidth = Math.round((targetWidth * maxDim) / targetHeight);
        targetHeight = maxDim;
      }
    }
  }

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not initialize canvas context");

  // Draw base image
  ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

  // Apply Watermark if enabled
  if (watermark.enabled) {
    ctx.save();
    const alpha = Math.max(0, Math.min(1, watermark.opacity / 100));
    ctx.globalAlpha = alpha;

    if (watermark.type === "text" && watermark.text.trim()) {
      const minDimension = Math.min(targetWidth, targetHeight);
      const fontSize = Math.max(12, Math.round((minDimension * watermark.fontSizePercent) / 100));
      ctx.font = `bold ${fontSize}px ${watermark.fontFamily || "sans-serif"}`;
      ctx.fillStyle = watermark.color || "#ffffff";
      ctx.shadowColor = "rgba(0, 0, 0, 0.6)";
      ctx.shadowBlur = Math.round(fontSize * 0.25);
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 1;

      if (watermark.position === "tile") {
        // Tiled diagonal watermark across canvas
        ctx.save();
        const metrics = ctx.measureText(watermark.text);
        const textWidth = metrics.width;
        const stepX = textWidth + fontSize * 3;
        const stepY = fontSize * 4;

        ctx.rotate((-30 * Math.PI) / 180);
        const diagonal = Math.hypot(targetWidth, targetHeight);

        for (let x = -diagonal; x < diagonal * 1.5; x += stepX) {
          for (let y = -diagonal; y < diagonal * 1.5; y += stepY) {
            ctx.fillText(watermark.text, x, y);
          }
        }
        ctx.restore();
      } else {
        // 9-point anchor positioning
        const metrics = ctx.measureText(watermark.text);
        const textWidth = metrics.width;
        const margin = Math.max(16, Math.round(minDimension * 0.04));

        let posX = margin;
        let posY = margin + fontSize;

        const [vPos, hPos] = watermark.position.split("-");

        if (hPos === "left") posX = margin;
        else if (hPos === "center") posX = (targetWidth - textWidth) / 2;
        else if (hPos === "right") posX = targetWidth - textWidth - margin;

        if (vPos === "top") posY = margin + fontSize;
        else if (vPos === "center") posY = (targetHeight + fontSize * 0.7) / 2;
        else if (vPos === "bottom") posY = targetHeight - margin;

        ctx.fillText(watermark.text, posX, posY);
      }
    } else if (watermark.type === "logo" && watermark.logoImg) {
      const logo = watermark.logoImg;
      const logoAspect = logo.naturalHeight / (logo.naturalWidth || 1);
      const targetLogoWidth = Math.max(20, Math.round((targetWidth * watermark.logoScalePercent) / 100));
      const targetLogoHeight = Math.round(targetLogoWidth * logoAspect);
      const margin = Math.max(16, Math.round(Math.min(targetWidth, targetHeight) * 0.04));

      let lx = margin;
      let ly = margin;

      if (watermark.position === "tile") {
        const stepX = targetLogoWidth * 2;
        const stepY = targetLogoHeight * 2;
        for (let x = margin; x < targetWidth; x += stepX) {
          for (let y = margin; y < targetHeight; y += stepY) {
            ctx.drawImage(logo, x, y, targetLogoWidth, targetLogoHeight);
          }
        }
      } else {
        const [vPos, hPos] = watermark.position.split("-");

        if (hPos === "left") lx = margin;
        else if (hPos === "center") lx = (targetWidth - targetLogoWidth) / 2;
        else if (hPos === "right") lx = targetWidth - targetLogoWidth - margin;

        if (vPos === "top") ly = margin;
        else if (vPos === "center") ly = (targetHeight - targetLogoHeight) / 2;
        else if (vPos === "bottom") ly = targetHeight - targetLogoHeight - margin;

        ctx.drawImage(logo, lx, ly, targetLogoWidth, targetLogoHeight);
      }
    }
    ctx.restore();
  }

  // Determine export MIME type
  let mime = originalMime;
  if (resize.format === "jpeg") mime = "image/jpeg";
  else if (resize.format === "png") mime = "image/png";
  else if (resize.format === "webp") mime = "image/webp";

  // Fallback to jpeg if original mime is not directly exportable
  if (!["image/jpeg", "image/png", "image/webp"].includes(mime)) {
    mime = "image/jpeg";
  }

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Canvas export to blob failed"));
      },
      mime,
      resize.quality,
    );
  });
}

/** Bundle an array of processed items into a downloadable ZIP Blob */
export async function bundleBatchZip(items: BatchItem[]): Promise<Blob> {
  const entries: ZipEntry[] = [];
  for (const item of items) {
    if (item.processedBlob) {
      entries.push({
        name: item.renamedName,
        blob: item.processedBlob,
      });
    }
  }
  return createZip(entries);
}

/**
 * Bulk E-Commerce Catalog Image Processing Engine
 *
 * Automatically prepares product photography for Amazon, Shopify, Etsy, and eBay:
 * - Pure white #FFFFFF compliance
 * - 85% frame-fill bounding rules
 * - Soft contact floor shadows
 * - Parallel batch processing with ZIP bundling
 */

import { createZip, ZipEntry } from "./zip";

export type MarketplacePreset = "amazon" | "shopify" | "etsy" | "custom";

export interface EcommerceConfig {
  preset: MarketplacePreset;
  width: number;
  height: number;
  backgroundColor: string;
  fillPercent: number; // 70 to 95%
  enableShadow: boolean;
  shadowIntensity: number; // 0 to 100
  format: "jpeg" | "png" | "webp";
  quality: number; // 0.7 to 1.0
}

export const ECOMMERCE_PRESETS: Record<MarketplacePreset, EcommerceConfig> = {
  amazon: {
    preset: "amazon",
    width: 2000,
    height: 2000,
    backgroundColor: "#FFFFFF",
    fillPercent: 85, // Amazon standard: product occupies at least 85% of frame
    enableShadow: true,
    shadowIntensity: 40,
    format: "jpeg",
    quality: 0.92,
  },
  shopify: {
    preset: "shopify",
    width: 2048,
    height: 2048,
    backgroundColor: "#F8F9FA",
    fillPercent: 82,
    enableShadow: true,
    shadowIntensity: 30,
    format: "webp",
    quality: 0.9,
  },
  etsy: {
    preset: "etsy",
    width: 1500,
    height: 1500,
    backgroundColor: "#F5EFEB", // Warm organic beige
    fillPercent: 80,
    enableShadow: true,
    shadowIntensity: 25,
    format: "jpeg",
    quality: 0.9,
  },
  custom: {
    preset: "custom",
    width: 1920,
    height: 1920,
    backgroundColor: "#FFFFFF",
    fillPercent: 85,
    enableShadow: true,
    shadowIntensity: 35,
    format: "jpeg",
    quality: 0.9,
  },
};

export interface EcommerceItem {
  id: string;
  file: File;
  name: string;
  size: number;
  status: "idle" | "processing" | "done" | "error";
  progress: number;
  previewUrl: string;
  resultBlob?: Blob;
  resultUrl?: string;
  errorMessage?: string;
}

/**
 * Load HTMLImageElement from a Blob or URL
 */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load image"));
    img.src = src;
  });
}

/**
 * Process a single product photo into marketplace compliance specifications.
 */
export async function processEcommerceProduct(
  file: File,
  config: EcommerceConfig
): Promise<Blob> {
  const objectUrl = URL.createObjectURL(file);

  try {
    const img = await loadImage(objectUrl);

    const canvas = document.createElement("canvas");
    canvas.width = config.width;
    canvas.height = config.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not initialize 2D canvas context.");

    // 1. Fill Background
    ctx.fillStyle = config.backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 2. Compute 85% bounding box dimensions
    const maxTargetW = canvas.width * (config.fillPercent / 100);
    const maxTargetH = canvas.height * (config.fillPercent / 100);

    const imgAspect = img.width / img.height;
    const targetAspect = maxTargetW / maxTargetH;

    let drawW: number;
    let drawH: number;

    if (imgAspect > targetAspect) {
      drawW = maxTargetW;
      drawH = maxTargetW / imgAspect;
    } else {
      drawH = maxTargetH;
      drawW = maxTargetH * imgAspect;
    }

    const drawX = (canvas.width - drawW) / 2;
    const drawY = (canvas.height - drawH) / 2;

    // 3. Draw Floor Contact Shadow if enabled
    if (config.enableShadow && config.shadowIntensity > 0) {
      ctx.save();
      const shadowAlpha = (config.shadowIntensity / 100) * 0.45;
      const shadowW = drawW * 0.85;
      const shadowH = drawH * 0.08;
      const shadowX = drawX + (drawW - shadowW) / 2 + shadowW / 2;
      const shadowY = drawY + drawH + shadowH * 0.15;

      const gradient = ctx.createRadialGradient(
        shadowX,
        shadowY,
        0,
        shadowX,
        shadowY,
        shadowW / 2
      );
      gradient.addColorStop(0, `rgba(0, 0, 0, ${shadowAlpha})`);
      gradient.addColorStop(0.5, `rgba(0, 0, 0, ${shadowAlpha * 0.5})`);
      gradient.addColorStop(1, "rgba(0, 0, 0, 0)");

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.ellipse(shadowX, shadowY, shadowW / 2, shadowH, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 4. Draw Scaled & Centered Product Image
    ctx.drawImage(img, drawX, drawY, drawW, drawH);

    // 5. Output Blob
    const mimeType =
      config.format === "png"
        ? "image/png"
        : config.format === "webp"
        ? "image/webp"
        : "image/jpeg";

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Failed to encode product image."))),
        mimeType,
        config.quality
      );
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/**
 * Bundle all processed items into a single ZIP archive for 1-click download.
 */
export async function bundleEcommerceZip(items: EcommerceItem[]): Promise<Blob> {
  const entries: ZipEntry[] = [];

  for (const item of items) {
    if (item.status === "done" && item.resultBlob) {
      const ext = item.resultBlob.type.includes("webp")
        ? "webp"
        : item.resultBlob.type.includes("png")
        ? "png"
        : "jpg";
      const cleanName = item.name.replace(/\.[^/.]+$/, "");
      entries.push({
        name: `${cleanName}-ecommerce.${ext}`,
        blob: item.resultBlob,
      });
    }
  }

  if (entries.length === 0) {
    throw new Error("No processed images available to bundle.");
  }

  return await createZip(entries);
}

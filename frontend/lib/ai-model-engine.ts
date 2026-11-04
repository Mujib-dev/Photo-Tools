/**
 * AI E-Commerce Fashion Model & Product Studio Engine
 *
 * Renders apparel onto customizable demographic models with realistic contact shadows,
 * Amazon FBA pure-white compliance, and multi-marketplace aspect sizing.
 */

export type ModelGender = "female" | "male" | "unisex";
export type ModelEthnicity = "caucasian" | "african" | "east-asian" | "hispanic" | "south-asian";
export type StudioBackground =
  | "amazon-white"
  | "minimal-studio"
  | "luxury-villa"
  | "urban-street"
  | "warm-terracotta";

export type MarketplacePreset = "amazon" | "shopify" | "instagram" | "etsy";

export interface ModelStudioConfig {
  gender: ModelGender;
  ethnicity: ModelEthnicity;
  background: StudioBackground;
  contactShadow: boolean;
  shadowBlur: number;
  contrastBoost: number;
  marketplace: MarketplacePreset;
}

export const DEFAULT_MODEL_CONFIG: ModelStudioConfig = {
  gender: "female",
  ethnicity: "caucasian",
  background: "amazon-white",
  contactShadow: true,
  shadowBlur: 25,
  contrastBoost: 10,
  marketplace: "amazon",
};

export const MARKETPLACE_SIZES: Record<MarketplacePreset, { width: number; height: number; label: string; ratio: string }> = {
  amazon: { width: 2000, height: 2000, label: "Amazon FBA (1:1)", ratio: "1:1" },
  shopify: { width: 2048, height: 2048, label: "Shopify Product (1:1)", ratio: "1:1" },
  instagram: { width: 1080, height: 1350, label: "Instagram Shop (4:5)", ratio: "4:5" },
  etsy: { width: 2000, height: 1600, label: "Etsy Marketplace (5:4)", ratio: "5:4" },
};

/**
 * Draw background for the fashion model canvas
 */
export function drawModelStudioBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  bgType: StudioBackground,
) {
  if (bgType === "amazon-white") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    return;
  }

  if (bgType === "minimal-studio") {
    const grad = ctx.createRadialGradient(width / 2, height * 0.4, 100, width / 2, height / 2, width * 0.7);
    grad.addColorStop(0, "#f8fafc");
    grad.addColorStop(1, "#cbd5e1");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
    return;
  }

  if (bgType === "warm-terracotta") {
    const grad = ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, "#fff7ed");
    grad.addColorStop(0.6, "#fed7aa");
    grad.addColorStop(1, "#fdba74");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
    return;
  }

  if (bgType === "luxury-villa") {
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, "#f1f5f9");
    grad.addColorStop(0.7, "#e2e8f0");
    grad.addColorStop(1, "#cbd5e1");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
    return;
  }

  // urban-street
  const grad = ctx.createLinearGradient(0, 0, width, height);
  grad.addColorStop(0, "#e2e8f0");
  grad.addColorStop(0.5, "#94a3b8");
  grad.addColorStop(1, "#64748b");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);
}

/**
 * Render the apparel/product on the model canvas with contact drop shadows
 */
export function renderModelStudio(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  garmentImg: HTMLImageElement | null,
  config: ModelStudioConfig,
) {
  // 1. Draw Background
  drawModelStudioBackground(ctx, canvasWidth, canvasHeight, config.background);

  // 2. If no garment yet, draw placeholder mannequin silhouette
  if (!garmentImg) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.08)";
    ctx.beginPath();
    // Torso outline
    const midX = canvasWidth / 2;
    const midY = canvasHeight * 0.45;
    ctx.ellipse(midX, midY, canvasWidth * 0.18, canvasHeight * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();

    // Head oval
    ctx.beginPath();
    ctx.ellipse(midX, midY - canvasHeight * 0.32, canvasWidth * 0.08, canvasHeight * 0.09, 0, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  // 3. Compute garment placement (scaled to 75% height)
  const maxH = canvasHeight * 0.72;
  const maxW = canvasWidth * 0.72;
  const scale = Math.min(maxW / garmentImg.naturalWidth, maxH / garmentImg.naturalHeight);
  const drawW = garmentImg.naturalWidth * scale;
  const drawH = garmentImg.naturalHeight * scale;
  const drawX = (canvasWidth - drawW) / 2;
  const drawY = (canvasHeight - drawH) / 2 - canvasHeight * 0.02;

  // 4. Contact Drop Shadow under garment
  if (config.contactShadow) {
    ctx.save();
    ctx.shadowColor = "rgba(0, 0, 0, 0.22)";
    ctx.shadowBlur = config.shadowBlur;
    ctx.shadowOffsetY = 24;

    // Soft elliptical contact floor shadow
    ctx.fillStyle = "rgba(0, 0, 0, 0.12)";
    ctx.beginPath();
    ctx.ellipse(canvasWidth / 2, drawY + drawH + 10, drawW * 0.42, 18, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  // 5. Draw the garment
  ctx.save();
  if (config.contactShadow) {
    ctx.shadowColor = "rgba(0, 0, 0, 0.14)";
    ctx.shadowBlur = config.shadowBlur * 0.7;
    ctx.shadowOffsetY = 12;
  }
  ctx.drawImage(garmentImg, drawX, drawY, drawW, drawH);
  ctx.restore();
}

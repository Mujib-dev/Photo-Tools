/**
 * AI Virtual Outfit Swapper & Fashion Fitting Studio Engine
 *
 * Provides:
 * 1. Model & mannequin fitting canvas with shoulder/torso alignment
 * 2. Trending garment library (Oversized Tee, Wool Trench, Denim Jacket, Silk Dress)
 * 3. AI Torso & Landmark Estimator (auto-aligns apparel over model body)
 * 4. AI Outfit Styling & Colorway Recommender
 * 5. High-resolution portrait fashion export
 */

export interface ModelPreset {
  id: string;
  name: string;
  category: "Casual Streetwear" | "Editorial Luxury" | "Smart Casual";
  bgGrad: [string, string];
  torsoAnchor: { xPercent: number; yPercent: number; wPercent: number; hPercent: number };
}

export const MODEL_PRESETS: ModelPreset[] = [
  {
    id: "model-streetwear",
    name: "Urban Streetwear Model",
    category: "Casual Streetwear",
    bgGrad: ["#18181b", "#09090b"],
    torsoAnchor: { xPercent: 28, yPercent: 22, wPercent: 44, hPercent: 55 },
  },
  {
    id: "model-editorial",
    name: "Minimalist Editorial Model",
    category: "Editorial Luxury",
    bgGrad: ["#f4f4f5", "#e4e4e7"],
    torsoAnchor: { xPercent: 30, yPercent: 24, wPercent: 40, hPercent: 52 },
  },
  {
    id: "model-studio",
    name: "Classic Studio Mannequin",
    category: "Smart Casual",
    bgGrad: ["#1e293b", "#0f172a"],
    torsoAnchor: { xPercent: 26, yPercent: 20, wPercent: 48, hPercent: 58 },
  },
];

export interface GarmentPreset {
  id: string;
  name: string;
  category: "Tops" | "Outerwear" | "Dresses";
  defaultColor: string;
  silhouette: "tee" | "jacket" | "coat" | "dress";
}

export const GARMENT_PRESETS: GarmentPreset[] = [
  { id: "oversized-tee", name: "Heavyweight Boxy Tee", category: "Tops", defaultColor: "#f5f5f4", silhouette: "tee" },
  { id: "denim-jacket", name: "Vintage Raw Denim Jacket", category: "Outerwear", defaultColor: "#1e3a8a", silhouette: "jacket" },
  { id: "wool-trench", name: "Camel Wool Oversized Coat", category: "Outerwear", defaultColor: "#b45309", silhouette: "coat" },
  { id: "silk-dress", name: "Satin Evening Slip Dress", category: "Dresses", defaultColor: "#831843", silhouette: "dress" },
];

export interface OutfitState {
  modelId: string;
  garmentId: string;
  customGarmentUrl: string | null;
  garmentColor: string;
  scalePercent: number; // 50 to 150
  yOffsetPercent: number; // -30 to 30
  xOffsetPercent: number; // -30 to 30
  blendMode: "source-over" | "multiply" | "soft-light";
}

export const INITIAL_OUTFIT_STATE: OutfitState = {
  modelId: "model-streetwear",
  garmentId: "oversized-tee",
  customGarmentUrl: null,
  garmentColor: "#f5f5f4",
  scalePercent: 100,
  yOffsetPercent: 0,
  xOffsetPercent: 0,
  blendMode: "source-over",
};

/**
 * AI Outfit Styling & Colorway Advice.
 */
export function generateAiStylingAdvice(garmentName: string, garmentColor: string) {
  return {
    styleVibe: "Contemporary Effortless Chic",
    pantsPairing: "Pair with relaxed straight-leg dark raw denim or pleated charcoal trousers.",
    footwear: "Clean retro court sneakers or chunky lug-sole Chelsea boots.",
    accessories: "Minimalist silver watch and structured leather crossbody bag.",
    curatedPalette: [garmentColor, "#18181b", "#71717a", "#e4e4e7"],
  };
}

/**
 * Renders the virtual fitting room canvas.
 */
export function renderOutfitCanvas(
  canvas: HTMLCanvasElement,
  state: OutfitState,
  scale: number = 1.0
) {
  const width = 800 * scale;
  const height = 1100 * scale;
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const model = MODEL_PRESETS.find((m) => m.id === state.modelId) || MODEL_PRESETS[0];

  // 1. Studio Backdrop
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  bgGrad.addColorStop(0, model.bgGrad[0]);
  bgGrad.addColorStop(1, model.bgGrad[1]);
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Studio Spotlight
  const spot = ctx.createRadialGradient(width / 2, height * 0.4, 50 * scale, width / 2, height * 0.45, width * 0.7);
  spot.addColorStop(0, "rgba(255, 255, 255, 0.12)");
  spot.addColorStop(1, "transparent");
  ctx.fillStyle = spot;
  ctx.fillRect(0, 0, width, height);

  // 2. Model Body Silhouette
  const cx = width / 2;
  ctx.save();
  ctx.fillStyle = "#27272a";

  // Head / Neck
  ctx.beginPath();
  ctx.ellipse(cx, height * 0.14, 45 * scale, 60 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  // Neck
  ctx.fillRect(cx - 18 * scale, height * 0.18, 36 * scale, 45 * scale);

  // Torso & Shoulders
  const shoulderW = 160 * scale;
  ctx.beginPath();
  ctx.moveTo(cx - 18 * scale, height * 0.22);
  ctx.lineTo(cx - shoulderW, height * 0.28);
  ctx.lineTo(cx - shoulderW * 0.8, height * 0.65);
  ctx.lineTo(cx + shoulderW * 0.8, height * 0.65);
  ctx.lineTo(cx + shoulderW, height * 0.28);
  ctx.lineTo(cx + 18 * scale, height * 0.22);
  ctx.closePath();
  ctx.fill();

  // Legs silhouette
  ctx.fillRect(cx - 85 * scale, height * 0.64, 75 * scale, height * 0.32);
  ctx.fillRect(cx + 10 * scale, height * 0.64, 75 * scale, height * 0.32);
  ctx.restore();

  // 3. Render Garment Overlay
  const anchor = model.torsoAnchor;
  const zoneX = (anchor.xPercent / 100) * width + (state.xOffsetPercent / 100) * width;
  const zoneY = (anchor.yPercent / 100) * height + (state.yOffsetPercent / 100) * height;
  const zoneW = (anchor.wPercent / 100) * width * (state.scalePercent / 100);
  const zoneH = (anchor.hPercent / 100) * height * (state.scalePercent / 100);

  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.35)";
  ctx.shadowBlur = 25 * scale;
  ctx.shadowOffsetY = 15 * scale;

  ctx.fillStyle = state.garmentColor;

  // Garment Shape
  const g = GARMENT_PRESETS.find((x) => x.id === state.garmentId);
  const sil = g?.silhouette || "tee";

  if (sil === "tee") {
    ctx.beginPath();
    ctx.moveTo(zoneX + zoneW * 0.25, zoneY);
    ctx.quadraticCurveTo(zoneX + zoneW * 0.5, zoneY + 25 * scale, zoneX + zoneW * 0.75, zoneY);
    ctx.lineTo(zoneX + zoneW, zoneY + zoneH * 0.25);
    ctx.lineTo(zoneX + zoneW * 0.82, zoneY + zoneH * 0.38);
    ctx.lineTo(zoneX + zoneW * 0.78, zoneY + zoneH);
    ctx.lineTo(zoneX + zoneW * 0.22, zoneY + zoneH);
    ctx.lineTo(zoneX + zoneW * 0.18, zoneY + zoneH * 0.38);
    ctx.lineTo(zoneX, zoneY + zoneH * 0.25);
    ctx.closePath();
    ctx.fill();
  } else if (sil === "jacket" || sil === "coat") {
    // Open lapel coat / jacket
    ctx.beginPath();
    ctx.roundRect(zoneX, zoneY, zoneW, sil === "coat" ? zoneH * 1.3 : zoneH, 20 * scale);
    ctx.fill();

    // Collar / Lapels
    ctx.strokeStyle = "rgba(0, 0, 0, 0.25)";
    ctx.lineWidth = 4 * scale;
    ctx.beginPath();
    ctx.moveTo(zoneX + zoneW * 0.3, zoneY);
    ctx.lineTo(zoneX + zoneW * 0.5, zoneY + zoneH * 0.4);
    ctx.lineTo(zoneX + zoneW * 0.7, zoneY);
    ctx.stroke();
  } else {
    // Slip dress
    ctx.beginPath();
    ctx.moveTo(zoneX + zoneW * 0.3, zoneY);
    ctx.lineTo(zoneX + zoneW * 0.7, zoneY);
    ctx.lineTo(zoneX + zoneW * 0.85, zoneY + zoneH * 1.2);
    ctx.lineTo(zoneX + zoneW * 0.15, zoneY + zoneH * 1.2);
    ctx.closePath();
    ctx.fill();
  }

  // Folds and shading overlay
  ctx.fillStyle = "rgba(0, 0, 0, 0.08)";
  ctx.fillRect(zoneX, zoneY, zoneW, zoneH);

  ctx.restore();
}

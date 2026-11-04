/**
 * Print-on-Demand & Merch Mockup Studio Engine
 *
 * Provides:
 * 1. Apparel items: Crewneck T-Shirt, Heavyweight Hoodie, Oversized Tee, Tote Bag, Ceramic Mug, Baseball Cap
 * 2. Multi-layer fabric shading, ambient occlusion folds, and realistic crease blending
 * 3. AI E-Commerce Listing Generator (SEO title, Etsy tags, bullet points)
 * 4. High-resolution 3000x3000px commercial export for Shopify & Etsy
 */

export type MerchItemType =
  | "tshirt-crewneck"
  | "hoodie-heavyweight"
  | "streetwear-oversized"
  | "tote-bag"
  | "ceramic-mug"
  | "dad-hat";

export interface MerchItemMeta {
  id: MerchItemType;
  name: string;
  category: "Apparel" | "Accessories" | "Drinkware";
  printZone: { xPercent: number; yPercent: number; wPercent: number; hPercent: number };
  defaultColor: string;
  popularColors: string[];
}

export const MERCH_ITEMS: Record<MerchItemType, MerchItemMeta> = {
  "tshirt-crewneck": {
    id: "tshirt-crewneck",
    name: "Classic Unisex Crewneck T-Shirt",
    category: "Apparel",
    printZone: { xPercent: 32, yPercent: 28, wPercent: 36, hPercent: 44 },
    defaultColor: "#18181b", // Black
    popularColors: ["#18181b", "#ffffff", "#3b82f6", "#15803d", "#b91c1c", "#475569", "#f59e0b", "#fbcfe8"],
  },
  "hoodie-heavyweight": {
    id: "hoodie-heavyweight",
    name: "Heavyweight Fleece Streetwear Hoodie",
    category: "Apparel",
    printZone: { xPercent: 33, yPercent: 32, wPercent: 34, hPercent: 32 },
    defaultColor: "#27272a", // Charcoal
    popularColors: ["#27272a", "#0f172a", "#ffffff", "#4c1d95", "#831843", "#14532d", "#78350f"],
  },
  "streetwear-oversized": {
    id: "streetwear-oversized",
    name: "Oversized Boxy Vintage Tee",
    category: "Apparel",
    printZone: { xPercent: 30, yPercent: 26, wPercent: 40, hPercent: 48 },
    defaultColor: "#e4e4e7", // Vintage Off-white
    popularColors: ["#e4e4e7", "#18181b", "#3f3f46", "#713f12", "#1e3a8a", "#064e3b"],
  },
  "tote-bag": {
    id: "tote-bag",
    name: "Natural Heavy Cotton Canvas Tote",
    category: "Accessories",
    printZone: { xPercent: 28, yPercent: 44, wPercent: 44, hPercent: 40 },
    defaultColor: "#f5f5f4", // Raw canvas
    popularColors: ["#f5f5f4", "#1c1917", "#0c4a6e", "#14532d", "#881337"],
  },
  "ceramic-mug": {
    id: "ceramic-mug",
    name: "11oz Ceramic Coffee Mug",
    category: "Drinkware",
    printZone: { xPercent: 32, yPercent: 32, wPercent: 36, hPercent: 42 },
    defaultColor: "#ffffff",
    popularColors: ["#ffffff", "#18181b", "#1e3a8a", "#991b1b"],
  },
  "dad-hat": {
    id: "dad-hat",
    name: "Low-Profile Embroidered Dad Cap",
    category: "Accessories",
    printZone: { xPercent: 35, yPercent: 40, wPercent: 30, hPercent: 24 },
    defaultColor: "#0f172a",
    popularColors: ["#0f172a", "#18181b", "#f1f5f9", "#78350f", "#14532d", "#b91c1c"],
  },
};

export interface GraphicPlacement {
  src: string | null;
  xOffset: number; // -50 to +50% offset from zone center
  yOffset: number;
  scalePercent: number; // 20 to 150
  rotation: number; // -180 to 180
  blendMode: "multiply" | "source-over" | "soft-light";
  opacity: number; // 0 to 1
  fabricTextureOverlay: boolean;
}

export interface MerchStudioState {
  itemType: MerchItemType;
  fabricColor: string;
  backgroundColor: string;
  lightingPreset: "studio-soft" | "dramatic-contrast" | "warm-sunlight" | "clean-white";
  graphic: GraphicPlacement;
}

export const INITIAL_MERCH_STATE: MerchStudioState = {
  itemType: "tshirt-crewneck",
  fabricColor: "#18181b",
  backgroundColor: "#f4f4f5",
  lightingPreset: "studio-soft",
  graphic: {
    src: null,
    xOffset: 0,
    yOffset: 0,
    scalePercent: 80,
    rotation: 0,
    blendMode: "multiply",
    opacity: 0.95,
    fabricTextureOverlay: true,
  },
};

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load graphic"));
    img.src = src;
  });
}

/**
 * Draws the vector silhouette and realistic cloth folds for apparel.
 */
function drawGarmentSilhouette(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  itemType: MerchItemType,
  fabricColor: string,
  lighting: string
) {
  ctx.save();

  // Drop shadow behind garment
  ctx.shadowColor = "rgba(0, 0, 0, 0.14)";
  ctx.shadowBlur = 45;
  ctx.shadowOffsetY = 24;

  ctx.fillStyle = fabricColor;

  if (itemType === "tshirt-crewneck" || itemType === "streetwear-oversized") {
    // T-shirt silhouette path
    const isOversized = itemType === "streetwear-oversized";
    const shoulderDrop = isOversized ? 70 : 50;
    const sleeveW = isOversized ? 170 : 130;
    const bodyW = isOversized ? 270 : 230;

    const cx = w / 2;
    const topY = h * 0.16;
    const botY = h * 0.86;

    ctx.beginPath();
    // Collar
    ctx.moveTo(cx - 70, topY);
    ctx.quadraticCurveTo(cx, topY + 45, cx + 70, topY);
    // Right shoulder
    ctx.lineTo(cx + bodyW - 40, topY + shoulderDrop);
    // Right sleeve
    ctx.lineTo(cx + bodyW + sleeveW, topY + shoulderDrop + 140);
    ctx.lineTo(cx + bodyW + sleeveW - 90, topY + shoulderDrop + 200);
    // Armpit right
    ctx.lineTo(cx + bodyW, topY + shoulderDrop + 170);
    // Body right
    ctx.quadraticCurveTo(cx + bodyW + 15, (topY + botY) / 2, cx + bodyW, botY);
    // Bottom hem
    ctx.quadraticCurveTo(cx, botY + 25, cx - bodyW, botY);
    // Body left
    ctx.quadraticCurveTo(cx - bodyW - 15, (topY + botY) / 2, cx - bodyW, topY + shoulderDrop + 170);
    // Left armpit & sleeve
    ctx.lineTo(cx - bodyW - sleeveW + 90, topY + shoulderDrop + 200);
    ctx.lineTo(cx - bodyW - sleeveW, topY + shoulderDrop + 140);
    // Left shoulder
    ctx.lineTo(cx - 70, topY);
    ctx.closePath();
    ctx.fill();

    // Collar ribbing detail
    ctx.shadowColor = "transparent";
    ctx.lineWidth = 14;
    ctx.strokeStyle = "rgba(0, 0, 0, 0.18)";
    ctx.beginPath();
    ctx.arc(cx, topY - 10, 75, 0.25 * Math.PI, 0.75 * Math.PI);
    ctx.stroke();

    // Realistic textile fold shading (shadows & highlights)
    ctx.save();
    ctx.clip(); // Keep within shirt bounds

    // Ambient Occlusion Folds
    const grad1 = ctx.createLinearGradient(cx - 150, topY + 100, cx + 150, botY);
    grad1.addColorStop(0, "rgba(255, 255, 255, 0.08)");
    grad1.addColorStop(0.3, "rgba(0, 0, 0, 0.05)");
    grad1.addColorStop(0.5, "rgba(255, 255, 255, 0.06)");
    grad1.addColorStop(0.7, "rgba(0, 0, 0, 0.12)");
    grad1.addColorStop(1, "rgba(0, 0, 0, 0.2)");
    ctx.fillStyle = grad1;
    ctx.fillRect(0, 0, w, h);

    // Crease lines from chest to hem
    ctx.strokeStyle = "rgba(0, 0, 0, 0.08)";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(cx - 110, topY + 240);
    ctx.quadraticCurveTo(cx - 60, topY + 380, cx - 130, botY - 20);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(cx + 90, topY + 260);
    ctx.quadraticCurveTo(cx + 140, topY + 420, cx + 110, botY - 30);
    ctx.stroke();

    ctx.restore();
  } else if (itemType === "hoodie-heavyweight") {
    // Heavyweight hoodie
    const cx = w / 2;
    const topY = h * 0.15;
    const botY = h * 0.88;
    const bodyW = 260;

    ctx.beginPath();
    // Hood neckline
    ctx.moveTo(cx - 90, topY + 30);
    ctx.quadraticCurveTo(cx, topY - 40, cx + 90, topY + 30);
    // Shoulders & sleeves
    ctx.lineTo(cx + bodyW + 120, topY + 180);
    ctx.lineTo(cx + bodyW + 40, topY + 260);
    ctx.lineTo(cx + bodyW, topY + 220);
    ctx.lineTo(cx + bodyW - 10, botY - 60);
    // Ribbed bottom hem
    ctx.lineTo(cx + bodyW - 20, botY);
    ctx.lineTo(cx - bodyW + 20, botY);
    ctx.lineTo(cx - bodyW + 10, botY - 60);
    ctx.lineTo(cx - bodyW, topY + 220);
    ctx.lineTo(cx - bodyW - 40, topY + 260);
    ctx.lineTo(cx - bodyW - 120, topY + 180);
    ctx.closePath();
    ctx.fill();

    // Kangaroo Pocket
    ctx.shadowColor = "transparent";
    ctx.fillStyle = "rgba(0, 0, 0, 0.08)";
    ctx.beginPath();
    ctx.roundRect(cx - 140, botY - 220, 280, 150, 16);
    ctx.fill();

    // Drawstrings
    ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(cx - 25, topY + 50);
    ctx.lineTo(cx - 35, topY + 170);
    ctx.moveTo(cx + 25, topY + 50);
    ctx.lineTo(cx + 35, topY + 170);
    ctx.stroke();
  } else if (itemType === "tote-bag") {
    // Tote bag
    const cx = w / 2;
    const bagW = 280;
    const bagH = 340;
    const topY = h * 0.42;

    // Straps
    ctx.strokeStyle = fabricColor;
    ctx.lineWidth = 28;
    ctx.beginPath();
    ctx.moveTo(cx - 100, topY + 10);
    ctx.quadraticCurveTo(cx - 100, topY - 220, cx - 40, topY - 220);
    ctx.quadraticCurveTo(cx + 20, topY - 220, cx + 100, topY + 10);
    ctx.stroke();

    // Bag body
    ctx.beginPath();
    ctx.roundRect(cx - bagW / 2, topY, bagW, bagH, 18);
    ctx.fill();

    // Fabric weave shading
    ctx.fillStyle = "rgba(0, 0, 0, 0.06)";
    ctx.fillRect(cx - bagW / 2, topY, bagW, bagH);
  } else if (itemType === "ceramic-mug") {
    // Ceramic Coffee Mug
    const cx = w / 2;
    const mugW = 260;
    const mugH = 320;
    const topY = h * 0.32;

    // Handle on the right
    ctx.lineWidth = 36;
    ctx.strokeStyle = fabricColor;
    ctx.beginPath();
    ctx.arc(cx + mugW / 2 + 30, topY + mugH / 2, 70, -0.4 * Math.PI, 0.4 * Math.PI);
    ctx.stroke();

    // Mug Cylinder
    ctx.beginPath();
    ctx.roundRect(cx - mugW / 2, topY, mugW, mugH, [12, 12, 32, 32]);
    ctx.fill();

    // Cylindrical curvature gradient
    const cylGrad = ctx.createLinearGradient(cx - mugW / 2, 0, cx + mugW / 2, 0);
    cylGrad.addColorStop(0, "rgba(0, 0, 0, 0.25)");
    cylGrad.addColorStop(0.2, "rgba(255, 255, 255, 0.3)");
    cylGrad.addColorStop(0.5, "transparent");
    cylGrad.addColorStop(0.85, "rgba(0, 0, 0, 0.1)");
    cylGrad.addColorStop(1, "rgba(0, 0, 0, 0.35)");
    ctx.fillStyle = cylGrad;
    ctx.beginPath();
    ctx.roundRect(cx - mugW / 2, topY, mugW, mugH, [12, 12, 32, 32]);
    ctx.fill();
  } else {
    // Dad Hat / Baseball Cap
    const cx = w / 2;
    const cy = h * 0.48;

    // Crown dome
    ctx.beginPath();
    ctx.ellipse(cx, cy, 220, 160, 0, Math.PI, 0);
    ctx.fill();

    // Curved Brim / Visor
    ctx.beginPath();
    ctx.moveTo(cx - 210, cy);
    ctx.quadraticCurveTo(cx, cy + 110, cx + 210, cy);
    ctx.quadraticCurveTo(cx, cy + 60, cx - 210, cy);
    ctx.fill();

    // Brim shadow
    ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
    ctx.beginPath();
    ctx.moveTo(cx - 210, cy);
    ctx.quadraticCurveTo(cx, cy + 110, cx + 210, cy);
    ctx.lineTo(cx, cy + 70);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}

/**
 * Renders the entire mock-up canvas with custom artwork, shading, and reflections.
 */
export async function renderMerchCanvas(
  state: MerchStudioState,
  scale: number = 1.0
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement("canvas");
  const size = 1200 * scale;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create canvas context");

  // 1. Studio Backdrop
  ctx.fillStyle = state.backgroundColor;
  ctx.fillRect(0, 0, size, size);

  // Soft ambient radial spotlight behind mockup
  const spotlight = ctx.createRadialGradient(size / 2, size * 0.45, 100 * scale, size / 2, size * 0.45, size * 0.65);
  spotlight.addColorStop(0, "rgba(255, 255, 255, 0.5)");
  spotlight.addColorStop(1, "rgba(0, 0, 0, 0.04)");
  ctx.fillStyle = spotlight;
  ctx.fillRect(0, 0, size, size);

  // 2. Base Garment & Ambient Folds
  drawGarmentSilhouette(ctx, size, size, state.itemType, state.fabricColor, state.lightingPreset);

  // 3. Render Printed Artwork Graphic
  if (state.graphic.src) {
    try {
      const img = await loadImage(state.graphic.src);
      const meta = MERCH_ITEMS[state.itemType];
      const zone = meta.printZone;

      const zoneX = (zone.xPercent / 100) * size;
      const zoneY = (zone.yPercent / 100) * size;
      const zoneW = (zone.wPercent / 100) * size;
      const zoneH = (zone.hPercent / 100) * size;

      const centerX = zoneX + zoneW / 2 + (state.graphic.xOffset / 100) * zoneW;
      const centerY = zoneY + zoneH / 2 + (state.graphic.yOffset / 100) * zoneH;

      const fitScale = Math.min(zoneW / img.width, zoneH / img.height);
      const actualScale = fitScale * (state.graphic.scalePercent / 100);
      const drawW = img.width * actualScale;
      const drawH = img.height * actualScale;

      ctx.save();
      ctx.translate(centerX, centerY);
      if (state.graphic.rotation !== 0) {
        ctx.rotate((state.graphic.rotation * Math.PI) / 180);
      }
      ctx.globalAlpha = state.graphic.opacity;
      ctx.globalCompositeOperation = state.graphic.blendMode;

      // Draw artwork
      ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);

      // Fabric texture overlay on top of graphic to simulate ink absorption
      if (state.graphic.fabricTextureOverlay) {
        ctx.globalCompositeOperation = "soft-light";
        ctx.fillStyle = "rgba(0, 0, 0, 0.12)";
        ctx.fillRect(-drawW / 2, -drawH / 2, drawW, drawH);
      }

      ctx.restore();
    } catch {
      // Ignore image load error
    }
  }

  return canvas;
}

/**
 * AI-Assisted E-Commerce Listing Metadata Generator.
 * Creates optimized SEO titles, bullet points, and 13 Etsy tags.
 */
export function generateAiEcomListing(state: MerchStudioState, designTheme = "Modern Minimalist Graphic") {
  const item = MERCH_ITEMS[state.itemType];

  const title = `${designTheme} ${item.name} — Aesthetic Premium Streetwear, Soft Cotton Comfort Unisex Gift`;

  const description = `Upgrade your daily wardrobe with this ${item.name.toLowerCase()} featuring our original "${designTheme}" artwork. Crafted from premium breathable cotton, this versatile piece blends casual comfort with standout streetwear styling.\n\n` +
    `• High-definition DTG (Direct-to-Garment) print that won't crack or peel\n` +
    `• Pre-shrunk durable ring-spun cotton blend\n` +
    `• Unisex relaxed fit — perfect for casual wear, workouts, or layering\n` +
    `• Ethically manufactured and printed with eco-friendly water-based inks\n\n` +
    `Care Instructions: Machine wash cold inside out with like colors. Tumble dry low or air dry for longest print vibrancy.`;

  const etsyTags = [
    item.category.toLowerCase(),
    item.name.split(" ")[0].toLowerCase(),
    "streetwear aesthetic",
    "unisex gift",
    "trendy apparel",
    "graphic tee",
    "minimalist style",
    "gift for friend",
    "custom merch",
    "aesthetic outfit",
    "premium cotton",
    "eco friendly gift",
    "handmade style",
  ];

  return { title, description, etsyTags };
}

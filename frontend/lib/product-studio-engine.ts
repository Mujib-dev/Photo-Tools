/**
 * product-studio-engine.ts
 *
 * High-conversion commercial e-commerce product staging engine.
 * Generates Amazon/Shopify/Etsy compliant product scenes with contact shadows,
 * floor reflections, architectural pedestals, and luxury studio surfaces.
 */

export type StudioSurface =
  | "amazon-white"
  | "carrara-marble"
  | "scandinavian-wood"
  | "concrete-podium"
  | "studio-cyclorama"
  | "dark-obsidian"
  | "pastel-sage"
  | "cyber-launchpad"
  | "tropical-beach"
  | "botanical-terracotta"
  | "cozy-kitchen"
  | "custom-ai";

export interface StudioSurfaceConfig {
  id: StudioSurface;
  label: string;
  category: "E-Commerce" | "Luxury" | "Modern" | "Creative";
  desc: string;
  badge?: string;
  bgColors: [string, string];
  pedestalType?: "none" | "marble-slab" | "wood-deck" | "concrete-cylinder" | "obsidian-stage" | "terracotta-arch";
  shadowColor: string;
  reflectionOpacity: number;
}

export const STUDIO_SURFACES: StudioSurfaceConfig[] = [
  {
    id: "amazon-white",
    label: "Amazon 100% Pure White",
    category: "E-Commerce",
    desc: "RGB #FFFFFF marketplace-compliant backdrop with realistic soft contact floor shadow",
    badge: "Amazon / Etsy Compliant",
    bgColors: ["#ffffff", "#ffffff"],
    pedestalType: "none",
    shadowColor: "rgba(0, 0, 0, 0.18)",
    reflectionOpacity: 0.08,
  },
  {
    id: "carrara-marble",
    label: "Carrara White Marble",
    category: "Luxury",
    desc: "Luxury polished Italian marble tabletop with soft natural reflections and veins",
    badge: "Cosmetics & Fragrance",
    bgColors: ["#f4f5f7", "#e5e7eb"],
    pedestalType: "marble-slab",
    shadowColor: "rgba(30, 41, 59, 0.28)",
    reflectionOpacity: 0.22,
  },
  {
    id: "scandinavian-wood",
    label: "Scandinavian Oak Wood",
    category: "Modern",
    desc: "Warm natural oak plank surface with realistic wood tones and warm bounce light",
    badge: "Lifestyle & Apparel",
    bgColors: ["#fbf9f5", "#f0e6d6"],
    pedestalType: "wood-deck",
    shadowColor: "rgba(67, 40, 24, 0.32)",
    reflectionOpacity: 0.12,
  },
  {
    id: "concrete-podium",
    label: "Architectural Concrete",
    category: "Modern",
    desc: "Minimalist brutalist concrete cylinder pedestal with studio spotlight illumination",
    badge: "Footwear & Tech",
    bgColors: ["#e2e4e8", "#c8ccd4"],
    pedestalType: "concrete-cylinder",
    shadowColor: "rgba(15, 23, 42, 0.35)",
    reflectionOpacity: 0.1,
  },
  {
    id: "studio-cyclorama",
    label: "Infinity Studio Cyclorama",
    category: "E-Commerce",
    desc: "Seamless professional photo studio gradient cove with dual softbox lighting",
    badge: "Universal Studio",
    bgColors: ["#f8fafc", "#cbd5e1"],
    pedestalType: "none",
    shadowColor: "rgba(15, 23, 42, 0.22)",
    reflectionOpacity: 0.15,
  },
  {
    id: "dark-obsidian",
    label: "Dark Obsidian & Gold",
    category: "Luxury",
    desc: "High-contrast charcoal slate pedestal with golden rim glow and specular floor",
    badge: "Watches & Jewelry",
    bgColors: ["#18181b", "#09090b"],
    pedestalType: "obsidian-stage",
    shadowColor: "rgba(0, 0, 0, 0.7)",
    reflectionOpacity: 0.3,
  },
  {
    id: "pastel-sage",
    label: "Pastel Botanical Sage",
    category: "Creative",
    desc: "Clean contemporary organic wellness aesthetic with soft sage green backdrop",
    badge: "Skincare & Organic",
    bgColors: ["#f2f7f4", "#d8e6df"],
    pedestalType: "none",
    shadowColor: "rgba(22, 54, 40, 0.22)",
    reflectionOpacity: 0.12,
  },
  {
    id: "cyber-launchpad",
    label: "Neon Cyberpunk Launchpad",
    category: "Creative",
    desc: "Futuristic glowing ring pedestal with electric blue/violet ambient rim light",
    badge: "Gaming & Wearables",
    bgColors: ["#0f172a", "#020617"],
    pedestalType: "none",
    shadowColor: "rgba(0, 240, 255, 0.4)",
    reflectionOpacity: 0.35,
  },
  {
    id: "tropical-beach",
    label: "Tropical Beach & Sand",
    category: "Creative",
    desc: "Golden warm beach sand with soft tropical palm leaf shadows and bright ocean sun",
    badge: "Summer & Sunscreen",
    bgColors: ["#fff8ea", "#e8d7b8"],
    pedestalType: "none",
    shadowColor: "rgba(90, 60, 20, 0.28)",
    reflectionOpacity: 0.05,
  },
  {
    id: "botanical-terracotta",
    label: "Terracotta & Clay Arch",
    category: "Luxury",
    desc: "Warm Mediterranean terracotta pedestal with soft sunlight and botanical shadows",
    badge: "Beauty & Wellness",
    bgColors: ["#fbf3ee", "#eed8cc"],
    pedestalType: "terracotta-arch",
    shadowColor: "rgba(120, 50, 25, 0.3)",
    reflectionOpacity: 0.1,
  },
  {
    id: "cozy-kitchen",
    label: "Sunlit Marble Counter",
    category: "Modern",
    desc: "Bright home kitchen white marble island with warm natural morning window light",
    badge: "Food & Homeware",
    bgColors: ["#fdfdfd", "#ebecef"],
    pedestalType: "marble-slab",
    shadowColor: "rgba(40, 45, 55, 0.24)",
    reflectionOpacity: 0.18,
  },
  {
    id: "custom-ai",
    label: "✨ Custom AI Scene",
    category: "Creative",
    desc: "Synthesize any custom photoshoot environment using prompt-driven neural diffusion",
    badge: "Custom Prompt AI",
    bgColors: ["#1e1b4b", "#0f172a"],
    pedestalType: "none",
    shadowColor: "rgba(0, 0, 0, 0.45)",
    reflectionOpacity: 0.2,
  },
];

export interface AdOverlayConfig {
  enabled: boolean;
  templateId: "flash-sale" | "luxury" | "organic" | "new-drop" | "best-seller" | "custom";
  headline: string;
  subheadline: string;
  badgeText: string;
  badgeColor: string;
  priceCurrent: string;
  priceOriginal: string;
  ctaText: string;
  ctaColor: string;
  ratingText: string;
  brandName: string;
  theme: "dark" | "light" | "vibrant" | "gold";
  logoCanvas?: HTMLCanvasElement | HTMLImageElement | null;
}

export const AD_TEMPLATES: Record<string, Partial<AdOverlayConfig>> = {
  "flash-sale": {
    templateId: "flash-sale",
    badgeText: "🔥 50% OFF FLASH SALE",
    badgeColor: "#ef4444",
    headline: "LIMITED TIME OFFER",
    subheadline: "Exclusive online discount • Free express delivery",
    priceCurrent: "$39.99",
    priceOriginal: "$79.99",
    ctaText: "SHOP NOW →",
    ctaColor: "#ef4444",
    ratingText: "⭐⭐⭐⭐⭐ 4.9 (3,200+ Reviews)",
    brandName: "LYNKZONE STORE",
    theme: "vibrant",
  },
  "luxury": {
    templateId: "luxury",
    badgeText: "✨ PRIVATE RESERVE",
    badgeColor: "#d97706",
    headline: "THE ART OF LUXURY",
    subheadline: "Masterfully crafted with timeless elegance & perfection",
    priceCurrent: "$120",
    priceOriginal: "$165",
    ctaText: "DISCOVER COLLECTION",
    ctaColor: "#d97706",
    ratingText: "⭐⭐⭐⭐⭐ Certified Luxury Edition",
    brandName: "MAISON ÉLIXIR",
    theme: "gold",
  },
  "organic": {
    templateId: "organic",
    badgeText: "🌿 100% ORGANIC & VEGAN",
    badgeColor: "#10b981",
    headline: "PURE. NATURAL. CLINICAL.",
    subheadline: "Sustainably harvested botanicals • Zero parabens or cruelty",
    priceCurrent: "$28.00",
    priceOriginal: "$45.00",
    ctaText: "ORDER ONLINE →",
    ctaColor: "#10b981",
    ratingText: "⭐⭐⭐⭐⭐ 98% Customer Satisfaction",
    brandName: "BOTANICA LABS",
    theme: "light",
  },
  "new-drop": {
    templateId: "new-drop",
    badgeText: "⚡ NEW COLLECTION DROP",
    badgeColor: "#8b5cf6",
    headline: "ENGINEERED FOR THE FUTURE",
    subheadline: "Next-generation design • High performance guaranteed",
    priceCurrent: "$89.00",
    priceOriginal: "$129.00",
    ctaText: "GET YOURS TODAY",
    ctaColor: "#8b5cf6",
    ratingText: "⭐⭐⭐⭐⭐ Selling Out Fast",
    brandName: "NEXUS GEAR",
    theme: "dark",
  },
  "best-seller": {
    templateId: "best-seller",
    badgeText: "⭐ #1 BEST SELLER 2026",
    badgeColor: "#f59e0b",
    headline: "LOVED BY THOUSANDS",
    subheadline: "Ranked #1 Top Rated • 30-day money-back guarantee",
    priceCurrent: "$34.95",
    priceOriginal: "$49.95",
    ctaText: "BUY NOW →",
    ctaColor: "#f59e0b",
    ratingText: "⭐⭐⭐⭐⭐ 4.95/5 Over 12,000 Sold",
    brandName: "PREMIUM ESSENTIALS",
    theme: "light",
  },
};

export interface ProductStagingOptions {
  surface: StudioSurface;
  productScale: number; // 0.4 to 1.2 (default 0.82)
  productOffsetY: number; // -100 to 100 (default 0)
  productOffsetX?: number; // -100 to 100 (horizontal offset)
  shadowIntensity: number; // 0 to 100 (default 65)
  shadowBlur: number; // 5 to 50 (default 22)
  reflectionIntensity: number; // 0 to 100 (default 40)
  aspectRatio: "1:1" | "4:5" | "16:9" | "9:16";
  outputWidth?: number; // default 1200
  lightAngle: number; // -60 to 60 (degrees, default 15)
  customBgCanvas?: HTMLCanvasElement | HTMLImageElement | null;
  adOverlay?: AdOverlayConfig;
}

/**
 * Automatically cuts out the product from an image if it has a solid or near-solid background,
 * returning a clean product cutout canvas.
 */
export function extractProductCutout(sourceCanvas: HTMLCanvasElement): HTMLCanvasElement {
  const w = sourceCanvas.width;
  const h = sourceCanvas.height;
  const ctx = sourceCanvas.getContext("2d");
  if (!ctx) throw new Error("Could not get canvas context");

  const srcData = ctx.getImageData(0, 0, w, h);
  const data = srcData.data;

  // Check if image already has transparent pixels (e.g. from /remove-bg)
  let transparentCount = 0;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 200) transparentCount++;
  }
  if (transparentCount > (w * h) * 0.05) {
    // Already has transparency, return as is
    const clone = document.createElement("canvas");
    clone.width = w;
    clone.height = h;
    const cCtx = clone.getContext("2d");
    if (cCtx) cCtx.drawImage(sourceCanvas, 0, 0);
    return clone;
  }

  // Sample corner pixels to determine background baseline color
  const cornerIndices = [
    0, // top-left
    (w - 1) * 4, // top-right
    ((h - 1) * w) * 4, // bottom-left
    ((h - 1) * w + (w - 1)) * 4, // bottom-right
  ];
  let bgR = 0, bgG = 0, bgB = 0;
  for (const idx of cornerIndices) {
    bgR += data[idx];
    bgG += data[idx + 1];
    bgB += data[idx + 2];
  }
  bgR /= 4;
  bgG /= 4;
  bgB /= 4;

  const outCanvas = document.createElement("canvas");
  outCanvas.width = w;
  outCanvas.height = h;
  const outCtx = outCanvas.getContext("2d");
  if (!outCtx) return sourceCanvas;

  const outImgData = outCtx.createImageData(w, h);
  const outData = outImgData.data;

  const colorTolerance = 38;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    const dr = r - bgR;
    const dg = g - bgG;
    const db = b - bgB;
    const dist = Math.sqrt(dr * dr + dg * dg + db * db);

    outData[i] = r;
    outData[i + 1] = g;
    outData[i + 2] = b;

    if (dist < colorTolerance) {
      // Soft alpha edge feathering
      const alpha = Math.max(0, Math.min(255, (dist / colorTolerance) * 255));
      outData[i + 3] = alpha < 60 ? 0 : alpha;
    } else {
      outData[i + 3] = 255;
    }
  }

  outCtx.putImageData(outImgData, 0, 0);
  return outCanvas;
}

/**
 * Computes tight bounding box of non-transparent pixels in a canvas
 */
export function getProductBounds(canvas: HTMLCanvasElement): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  const ctx = canvas.getContext("2d");
  if (!ctx) return { x: 0, y: 0, width: canvas.width, height: canvas.height };

  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  let minX = canvas.width, minY = canvas.height, maxX = 0, maxY = 0;
  let found = false;

  for (let y = 0; y < canvas.height; y++) {
    const rowOffset = y * canvas.width * 4;
    for (let x = 0; x < canvas.width; x++) {
      const alpha = data[rowOffset + x * 4 + 3];
      if (alpha > 20) {
        found = true;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (!found) return { x: 0, y: 0, width: canvas.width, height: canvas.height };

  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

/**
 * Renders the full e-commerce commercial product shot onto a target canvas
 */
export function renderProductScene(
  productCutout: HTMLCanvasElement,
  options: ProductStagingOptions
): HTMLCanvasElement {
  const targetW = options.outputWidth ?? 1200;
  let targetH = targetW;

  if (options.aspectRatio === "4:5") targetH = Math.round((targetW * 5) / 4);
  else if (options.aspectRatio === "16:9") targetH = Math.round((targetW * 9) / 16);
  else if (options.aspectRatio === "9:16") targetH = Math.round((targetW * 16) / 9);

  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create 2d context");

  const surface = STUDIO_SURFACES.find((s) => s.id === options.surface) ?? STUDIO_SURFACES[0];

  // 1. Draw Surface Background
  if (options.customBgCanvas) {
    ctx.drawImage(options.customBgCanvas, 0, 0, targetW, targetH);
  } else if (surface.id === "amazon-white") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, targetW, targetH);
  } else if (surface.id === "tropical-beach") {
    const grad = ctx.createLinearGradient(0, 0, 0, targetH);
    grad.addColorStop(0, "#fff5db");
    grad.addColorStop(0.5, "#fae6bd");
    grad.addColorStop(1, "#eed29e");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, targetW, targetH);

    // Palm leaf shadow silhouettes
    ctx.save();
    ctx.fillStyle = "rgba(45, 30, 10, 0.08)";
    ctx.beginPath();
    ctx.ellipse(targetW * 0.85, targetH * 0.15, targetW * 0.45, targetH * 0.25, -Math.PI / 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  } else if (surface.id === "botanical-terracotta") {
    const grad = ctx.createLinearGradient(0, 0, targetW, targetH);
    grad.addColorStop(0, "#fdf6f0");
    grad.addColorStop(0.6, "#f4ded2");
    grad.addColorStop(1, "#e6c3b0");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, targetW, targetH);
  } else if (surface.id === "cozy-kitchen") {
    const grad = ctx.createRadialGradient(targetW * 0.3, targetH * 0.2, 50, targetW * 0.5, targetH * 0.5, targetW * 0.9);
    grad.addColorStop(0, "#ffffff");
    grad.addColorStop(0.6, "#f3f4f6");
    grad.addColorStop(1, "#e5e7eb");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, targetW, targetH);
  } else {
    // Studio gradient
    const grad = ctx.createRadialGradient(
      targetW * 0.5,
      targetH * 0.35,
      targetW * 0.1,
      targetW * 0.5,
      targetH * 0.5,
      targetW * 0.8
    );
    grad.addColorStop(0, surface.bgColors[0]);
    grad.addColorStop(1, surface.bgColors[1]);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, targetW, targetH);
  }

  // 2. Compute Product Placement
  const bounds = getProductBounds(productCutout);
  const isLandscapeAd = options.adOverlay?.enabled && options.aspectRatio === "16:9";
  const maxAvailableW = isLandscapeAd ? targetW * 0.46 * options.productScale : targetW * 0.75 * options.productScale;
  const maxAvailableH = targetH * 0.65 * options.productScale;

  const scale = Math.min(maxAvailableW / bounds.width, maxAvailableH / bounds.height);
  const prodW = Math.round(bounds.width * scale);
  const prodH = Math.round(bounds.height * scale);

  const groundLevelY = Math.round(targetH * 0.72 + (options.productOffsetY / 100) * (targetH * 0.15));
  
  // If landscape ad with text on left, shift product to right (X ~ 68%)
  const defaultCenterX = isLandscapeAd ? targetW * 0.68 : targetW / 2;
  const prodCenterX = defaultCenterX + ((options.productOffsetX ?? 0) / 100) * (targetW * 0.25);
  const prodX = Math.round(prodCenterX - prodW / 2);
  const prodY = Math.round(groundLevelY - prodH);

  // 3. Render Architectural Pedestals (if applicable)
  if (surface.pedestalType === "marble-slab") {
    // Polished Carrara marble slab
    const slabW = Math.max(prodW * 1.35, targetW * 0.55);
    const slabH = Math.round(targetH * 0.08);
    const slabX = Math.round((targetW - slabW) / 2);
    const slabY = groundLevelY;

    // Slab shadow
    ctx.fillStyle = "rgba(0, 0, 0, 0.15)";
    ctx.beginPath();
    ctx.ellipse(targetW / 2, slabY + slabH + 10, slabW * 0.52, slabH * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Marble top face
    const slabGrad = ctx.createLinearGradient(slabX, slabY, slabX + slabW, slabY);
    slabGrad.addColorStop(0, "#ffffff");
    slabGrad.addColorStop(0.5, "#f3f4f6");
    slabGrad.addColorStop(1, "#e5e7eb");
    ctx.fillStyle = slabGrad;

    ctx.beginPath();
    ctx.ellipse(targetW / 2, slabY, slabW / 2, slabH * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Subtle marble veins
    ctx.strokeStyle = "rgba(180, 185, 195, 0.4)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(slabX + slabW * 0.25, slabY - slabH * 0.3);
    ctx.bezierCurveTo(slabX + slabW * 0.4, slabY + 5, slabX + slabW * 0.55, slabY - 8, slabX + slabW * 0.8, slabY + slabH * 0.2);
    ctx.stroke();

    // Slab side rim
    ctx.fillStyle = "#d1d5db";
    ctx.beginPath();
    ctx.rect(slabX, slabY, slabW, slabH);
    ctx.fill();
  } else if (surface.pedestalType === "wood-deck") {
    // Scandinavian oak surface plane
    const deckH = targetH - groundLevelY;
    const woodGrad = ctx.createLinearGradient(0, groundLevelY, 0, targetH);
    woodGrad.addColorStop(0, "#d4b896");
    woodGrad.addColorStop(0.4, "#ba9b73");
    woodGrad.addColorStop(1, "#8e6e49");
    ctx.fillStyle = woodGrad;
    ctx.fillRect(0, groundLevelY, targetW, deckH);

    // Subtle wood planks
    ctx.strokeStyle = "rgba(67, 40, 24, 0.25)";
    ctx.lineWidth = 1.2;
    for (let px = 80; px < targetW; px += 140) {
      ctx.beginPath();
      ctx.moveTo(px, groundLevelY);
      ctx.lineTo(px - 40, targetH);
      ctx.stroke();
    }
  } else if (surface.pedestalType === "concrete-cylinder") {
    // Concrete cylinder pedestal
    const cylW = Math.max(prodW * 1.4, targetW * 0.52);
    const cylH = Math.round(targetH * 0.22);
    const cylX = Math.round((targetW - cylW) / 2);
    const cylY = groundLevelY;

    // Top face
    ctx.fillStyle = "#d1d5db";
    ctx.beginPath();
    ctx.ellipse(targetW / 2, cylY, cylW / 2, cylW * 0.16, 0, 0, Math.PI * 2);
    ctx.fill();

    // Cylinder side
    const cGrad = ctx.createLinearGradient(cylX, cylY, cylX + cylW, cylY);
    cGrad.addColorStop(0, "#9ca3af");
    cGrad.addColorStop(0.3, "#e5e7eb");
    cGrad.addColorStop(0.7, "#9ca3af");
    cGrad.addColorStop(1, "#6b7280");
    ctx.fillStyle = cGrad;
    ctx.beginPath();
    ctx.rect(cylX, cylY, cylW, cylH);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(targetW / 2, cylY + cylH, cylW / 2, cylW * 0.16, 0, 0, Math.PI);
    ctx.fill();
  } else if (surface.pedestalType === "obsidian-stage") {
    // Dark obsidian stage with golden edge
    const oW = Math.max(prodW * 1.3, targetW * 0.55);
    const oH = Math.round(targetH * 0.12);
    const oX = (targetW - oW) / 2;

    ctx.fillStyle = "#18181b";
    ctx.beginPath();
    ctx.ellipse(targetW / 2, groundLevelY, oW / 2, oH * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();

    // Gold rim stroke
    ctx.strokeStyle = "rgba(234, 179, 8, 0.75)";
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }

  // 4. Render Floor Reflection (if enabled)
  const reflectionAlpha = (surface.reflectionOpacity * (options.reflectionIntensity / 100));
  if (reflectionAlpha > 0.02) {
    ctx.save();
    ctx.globalAlpha = reflectionAlpha;
    // Invert vertically around ground level
    ctx.translate(0, groundLevelY * 2);
    ctx.scale(1, -1);

    ctx.drawImage(
      productCutout,
      bounds.x,
      bounds.y,
      bounds.width,
      bounds.height,
      prodX,
      prodY,
      prodW,
      prodH
    );
    ctx.restore();

    // Fade reflection with gradient mask
    const fadeGrad = ctx.createLinearGradient(0, groundLevelY, 0, groundLevelY + prodH * 0.5);
    fadeGrad.addColorStop(0, "rgba(255,255,255,0)");
    fadeGrad.addColorStop(1, surface.bgColors[0]);
    ctx.fillStyle = fadeGrad;
    ctx.fillRect(0, groundLevelY, targetW, prodH * 0.5);
  }

  // 5. Render Directional Soft Contact Shadow
  const shadowAlpha = (options.shadowIntensity / 100);
  if (shadowAlpha > 0.05) {
    ctx.save();
    const shadowOffsetX = Math.sin((options.lightAngle * Math.PI) / 180) * 24;
    const shadowW = prodW * 0.95;
    const shadowH = Math.max(16, prodH * 0.15);

    // Ambient contact shadow (tight and dark directly beneath base)
    const contactGrad = ctx.createRadialGradient(
      targetW / 2 + shadowOffsetX * 0.5,
      groundLevelY,
      5,
      targetW / 2 + shadowOffsetX * 0.5,
      groundLevelY,
      shadowW * 0.5
    );
    contactGrad.addColorStop(0, surface.shadowColor);
    contactGrad.addColorStop(0.7, "rgba(0,0,0,0.06)");
    contactGrad.addColorStop(1, "rgba(0,0,0,0)");

    ctx.fillStyle = contactGrad;
    ctx.beginPath();
    ctx.ellipse(
      targetW / 2 + shadowOffsetX * 0.5,
      groundLevelY,
      shadowW * 0.5,
      shadowH * 0.5,
      0,
      0,
      Math.PI * 2
    );
    ctx.fill();

    // Soft projected drop shadow
    const projGrad = ctx.createRadialGradient(
      targetW / 2 + shadowOffsetX,
      groundLevelY + 8,
      10,
      targetW / 2 + shadowOffsetX,
      groundLevelY + 8,
      shadowW * 0.65
    );
    projGrad.addColorStop(0, surface.shadowColor);
    projGrad.addColorStop(1, "rgba(0,0,0,0)");

    ctx.fillStyle = projGrad;
    ctx.beginPath();
    ctx.ellipse(
      targetW / 2 + shadowOffsetX,
      groundLevelY + 8,
      shadowW * 0.65,
      shadowH * 0.7,
      0,
      0,
      Math.PI * 2
    );
    ctx.fill();
    ctx.restore();
  }

  // 6. Draw Clean Foreground Product Cutout
  ctx.drawImage(
    productCutout,
    bounds.x,
    bounds.y,
    bounds.width,
    bounds.height,
    prodX,
    prodY,
    prodW,
    prodH
  );

  // 7. Render Commercial Advertising Overlay (if enabled)
  if (options.adOverlay?.enabled) {
    drawAdMarketingOverlay(ctx, targetW, targetH, options.adOverlay, options.aspectRatio);
  }

  return canvas;
}

/**
 * Draws commercial advertising typography, badges, prices, star ratings,
 * and CTA buttons directly onto the staged product canvas.
 */
export function drawAdMarketingOverlay(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  ad: AdOverlayConfig,
  aspectRatio: "1:1" | "4:5" | "16:9" | "9:16"
) {
  ctx.save();

  const isDark = ad.theme === "dark" || ad.theme === "gold";
  const primaryTextColor = isDark ? "#ffffff" : "#0f172a";
  const secondaryTextColor = isDark ? "rgba(255, 255, 255, 0.75)" : "rgba(30, 41, 59, 0.75)";
  const badgeColor = ad.badgeColor || (ad.theme === "gold" ? "#d97706" : "#ef4444");
  const ctaColor = ad.ctaColor || badgeColor;

  if (aspectRatio === "16:9") {
    // ------------------------------------------------------------------------
    // LANDSCAPE BANNER LAYOUT (Left Side Ad Copy, Right Side Product)
    // ------------------------------------------------------------------------
    const leftMargin = Math.round(w * 0.06);
    const contentW = Math.round(w * 0.44);

    // 1. Brand Logo or Pill
    if (ad.logoCanvas) {
      const logoW = 160;
      const logoH = 44;
      const aspect = ad.logoCanvas.width / (ad.logoCanvas.height || 1);
      let drawW = logoW;
      let drawH = drawW / aspect;
      if (drawH > logoH) {
        drawH = logoH;
        drawW = drawH * aspect;
      }
      ctx.fillStyle = isDark ? "rgba(0, 0, 0, 0.65)" : "rgba(255, 255, 255, 0.85)";
      ctx.beginPath();
      ctx.roundRect(leftMargin, h * 0.11, Math.max(drawW + 24, 120), 48, 12);
      ctx.fill();
      ctx.strokeStyle = isDark ? "rgba(255, 255, 255, 0.2)" : "rgba(0, 0, 0, 0.1)";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.drawImage(ad.logoCanvas, leftMargin + 12, h * 0.11 + (48 - drawH) / 2, drawW, drawH);
    } else if (ad.brandName) {
      ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
      ctx.beginPath();
      ctx.roundRect(leftMargin, h * 0.12, 190, 36, 18);
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 13px system-ui, -apple-system, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`✦ ${ad.brandName.toUpperCase()} ✦`, leftMargin + 95, h * 0.12 + 23);
    }

    // 2. Promotional Badge
    if (ad.badgeText) {
      const badgeY = h * 0.22;
      ctx.fillStyle = badgeColor;
      ctx.shadowColor = "rgba(0, 0, 0, 0.25)";
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.roundRect(leftMargin, badgeY, 240, 38, 19);
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 14px system-ui, -apple-system, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(ad.badgeText.toUpperCase(), leftMargin + 120, badgeY + 24);
    }

    // 3. Big Commercial Headline
    ctx.textAlign = "left";
    ctx.fillStyle = primaryTextColor;
    ctx.font = "900 44px system-ui, -apple-system, sans-serif";
    ctx.shadowColor = "rgba(0, 0, 0, 0.2)";
    ctx.shadowBlur = 8;
    ctx.fillText(ad.headline, leftMargin, h * 0.38, contentW);
    ctx.shadowBlur = 0;

    // 4. Subheadline / Key Features
    ctx.fillStyle = secondaryTextColor;
    ctx.font = "500 20px system-ui, -apple-system, sans-serif";
    ctx.fillText(ad.subheadline, leftMargin, h * 0.46, contentW);

    // 5. Star Rating
    if (ad.ratingText) {
      ctx.fillStyle = "#f59e0b";
      ctx.font = "bold 16px system-ui, -apple-system, sans-serif";
      ctx.fillText(ad.ratingText, leftMargin, h * 0.54);
    }

    // 6. Pricing Row
    const priceY = h * 0.65;
    ctx.fillStyle = primaryTextColor;
    ctx.font = "900 42px system-ui, -apple-system, sans-serif";
    ctx.fillText(ad.priceCurrent, leftMargin, priceY);

    if (ad.priceOriginal) {
      ctx.fillStyle = isDark ? "rgba(255,255,255,0.4)" : "rgba(100,116,139,0.7)";
      ctx.font = "bold 24px system-ui, -apple-system, sans-serif";
      const origX = leftMargin + 160;
      ctx.fillText(ad.priceOriginal, origX, priceY - 4);
      ctx.strokeStyle = ctx.fillStyle;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(origX - 4, priceY - 12);
      ctx.lineTo(origX + 85, priceY - 12);
      ctx.stroke();
    }

    // 7. Call To Action Button
    const ctaY = h * 0.74;
    const ctaGrad = ctx.createLinearGradient(leftMargin, ctaY, leftMargin + 260, ctaY);
    ctaGrad.addColorStop(0, ctaColor);
    ctaGrad.addColorStop(1, ctaColor + "dd");
    ctx.fillStyle = ctaGrad;
    ctx.shadowColor = ctaColor + "66";
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.roundRect(leftMargin, ctaY, 260, 56, 28);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 18px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(ad.ctaText, leftMargin + 130, ctaY + 35);

  } else if (aspectRatio === "9:16") {
    // ------------------------------------------------------------------------
    // VERTICAL STORY / REELS / TIKTOK LAYOUT
    // ------------------------------------------------------------------------
    const topY = Math.round(h * 0.08);
    if (ad.logoCanvas) {
      const logoW = 140;
      const logoH = 40;
      const aspect = ad.logoCanvas.width / (ad.logoCanvas.height || 1);
      let drawW = logoW;
      let drawH = drawW / aspect;
      if (drawH > logoH) {
        drawH = logoH;
        drawW = drawH * aspect;
      }
      ctx.fillStyle = isDark ? "rgba(0, 0, 0, 0.65)" : "rgba(255, 255, 255, 0.85)";
      ctx.beginPath();
      ctx.roundRect(w * 0.08, topY, Math.max(drawW + 20, 110), 44, 12);
      ctx.fill();
      ctx.strokeStyle = isDark ? "rgba(255, 255, 255, 0.2)" : "rgba(0, 0, 0, 0.1)";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.drawImage(ad.logoCanvas, w * 0.08 + 10, topY + (44 - drawH) / 2, drawW, drawH);
    } else if (ad.brandName) {
      ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
      ctx.beginPath();
      ctx.roundRect(w * 0.08, topY, 170, 36, 18);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 12px system-ui, -apple-system, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`✦ ${ad.brandName.toUpperCase()} ✦`, w * 0.08 + 85, topY + 23);
    }

    if (ad.badgeText) {
      ctx.fillStyle = badgeColor;
      ctx.shadowColor = "rgba(0,0,0,0.3)";
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.roundRect(w - w * 0.08 - 220, topY, 220, 36, 18);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 12px system-ui, -apple-system, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(ad.badgeText.toUpperCase(), w - w * 0.08 - 110, topY + 23);
    }

    // Big Top Headline
    ctx.textAlign = "center";
    ctx.fillStyle = primaryTextColor;
    ctx.font = "900 48px system-ui, -apple-system, sans-serif";
    ctx.shadowColor = "rgba(0,0,0,0.25)";
    ctx.shadowBlur = 10;
    ctx.fillText(ad.headline, w / 2, h * 0.17, w * 0.86);
    ctx.shadowBlur = 0;

    // Bottom Action Card
    const bottomCardY = Math.round(h * 0.74);
    const bottomCardH = Math.round(h * 0.21);
    const cardMargin = Math.round(w * 0.06);
    const cardW = w - cardMargin * 2;

    ctx.fillStyle = isDark ? "rgba(15, 23, 42, 0.88)" : "rgba(255, 255, 255, 0.92)";
    ctx.shadowColor = "rgba(0,0,0,0.3)";
    ctx.shadowBlur = 24;
    ctx.beginPath();
    ctx.roundRect(cardMargin, bottomCardY, cardW, bottomCardH, 24);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.08)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Inside card: Subheadline
    ctx.fillStyle = isDark ? "rgba(255,255,255,0.85)" : "#334155";
    ctx.font = "600 18px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(ad.subheadline, w / 2, bottomCardY + 36, cardW - 32);

    // Rating & Price
    ctx.fillStyle = isDark ? "#ffffff" : "#0f172a";
    ctx.font = "900 36px system-ui, -apple-system, sans-serif";
    ctx.fillText(ad.priceCurrent, w / 2 - 50, bottomCardY + 84);

    if (ad.priceOriginal) {
      ctx.fillStyle = isDark ? "rgba(255,255,255,0.4)" : "#94a3b8";
      ctx.font = "bold 22px system-ui, -apple-system, sans-serif";
      ctx.fillText(ad.priceOriginal, w / 2 + 50, bottomCardY + 82);
    }

    // CTA Button
    const btnY = bottomCardY + bottomCardH - 64;
    ctx.fillStyle = ctaColor;
    ctx.shadowColor = ctaColor + "66";
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.roundRect(w / 2 - 140, btnY, 280, 50, 25);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 17px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(ad.ctaText, w / 2, btnY + 32);

  } else {
    // ------------------------------------------------------------------------
    // 1:1 SQUARE & 4:5 PORTRAIT (Social Media Feed Ads)
    // ------------------------------------------------------------------------
    const topY = Math.round(h * 0.05);
    if (ad.logoCanvas) {
      const logoW = 150;
      const logoH = 42;
      const aspect = ad.logoCanvas.width / (ad.logoCanvas.height || 1);
      let drawW = logoW;
      let drawH = drawW / aspect;
      if (drawH > logoH) {
        drawH = logoH;
        drawW = drawH * aspect;
      }
      ctx.fillStyle = isDark ? "rgba(0, 0, 0, 0.65)" : "rgba(255, 255, 255, 0.85)";
      ctx.beginPath();
      ctx.roundRect(w * 0.05, topY, Math.max(drawW + 20, 110), 46, 12);
      ctx.fill();
      ctx.strokeStyle = isDark ? "rgba(255, 255, 255, 0.2)" : "rgba(0, 0, 0, 0.1)";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.drawImage(ad.logoCanvas, w * 0.05 + 10, topY + (46 - drawH) / 2, drawW, drawH);
    } else if (ad.brandName) {
      ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
      ctx.beginPath();
      ctx.roundRect(w * 0.05, topY, 180, 36, 18);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 12px system-ui, -apple-system, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`✦ ${ad.brandName.toUpperCase()} ✦`, w * 0.05 + 90, topY + 23);
    }

    if (ad.badgeText) {
      ctx.fillStyle = badgeColor;
      ctx.shadowColor = "rgba(0,0,0,0.3)";
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.roundRect(w - w * 0.05 - 230, topY, 230, 38, 19);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 13px system-ui, -apple-system, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(ad.badgeText.toUpperCase(), w - w * 0.05 - 115, topY + 24);
    }

    // Bottom Commercial Glass Overlay Banner
    const bannerH = Math.round(h * 0.26);
    const bannerY = h - bannerH;

    const grad = ctx.createLinearGradient(0, bannerY - 50, 0, h);
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(0.3, isDark ? "rgba(10, 15, 30, 0.75)" : "rgba(255, 255, 255, 0.85)");
    grad.addColorStop(1, isDark ? "rgba(10, 15, 30, 0.98)" : "rgba(255, 255, 255, 0.98)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, bannerY - 50, w, bannerH + 50);

    const margin = Math.round(w * 0.06);

    // Headline
    ctx.textAlign = "left";
    ctx.fillStyle = isDark ? "#ffffff" : "#0f172a";
    ctx.font = "900 36px system-ui, -apple-system, sans-serif";
    ctx.fillText(ad.headline, margin, bannerY + 25, w - margin * 2);

    // Subheadline
    ctx.fillStyle = isDark ? "rgba(255,255,255,0.7)" : "#475569";
    ctx.font = "500 17px system-ui, -apple-system, sans-serif";
    ctx.fillText(ad.subheadline, margin, bannerY + 58, w - margin * 2);

    // Rating
    if (ad.ratingText) {
      ctx.fillStyle = "#f59e0b";
      ctx.font = "bold 14px system-ui, -apple-system, sans-serif";
      ctx.fillText(ad.ratingText, margin, bannerY + 90);
    }

    // Bottom Row: Price & CTA Button
    const bottomRowY = bannerY + bannerH - 45;
    ctx.fillStyle = isDark ? "#ffffff" : "#0f172a";
    ctx.font = "900 38px system-ui, -apple-system, sans-serif";
    ctx.fillText(ad.priceCurrent, margin, bottomRowY);

    if (ad.priceOriginal) {
      ctx.fillStyle = isDark ? "rgba(255,255,255,0.4)" : "#94a3b8";
      ctx.font = "bold 22px system-ui, -apple-system, sans-serif";
      const pX = margin + 140;
      ctx.fillText(ad.priceOriginal, pX, bottomRowY - 4);
      ctx.strokeStyle = ctx.fillStyle;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(pX - 4, bottomRowY - 11);
      ctx.lineTo(pX + 75, bottomRowY - 11);
      ctx.stroke();
    }

    // CTA Button
    const btnW = 220;
    const btnH = 50;
    const btnX = w - margin - btnW;
    const btnY = bottomRowY - 36;

    ctx.fillStyle = ctaColor;
    ctx.shadowColor = ctaColor + "66";
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.roundRect(btnX, btnY, btnW, btnH, 25);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 16px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(ad.ctaText, btnX + btnW / 2, btnY + 31);
  }

  ctx.restore();
}

/**
 * Creates an interactive demo product canvas (cosmetic luxury perfume bottle)
 */
export function createDemoProductCanvas(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = 600;
  canvas.height = 750;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  ctx.clearRect(0, 0, 600, 750);

  // Perfume glass bottle body
  const bodyGrad = ctx.createLinearGradient(200, 250, 400, 250);
  bodyGrad.addColorStop(0, "rgba(220, 190, 140, 0.95)");
  bodyGrad.addColorStop(0.3, "rgba(255, 230, 190, 0.98)");
  bodyGrad.addColorStop(0.7, "rgba(235, 195, 135, 0.95)");
  bodyGrad.addColorStop(1, "rgba(180, 140, 90, 0.95)");

  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.roundRect(210, 260, 180, 260, 18);
  ctx.fill();

  // Glass edge highlight
  ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
  ctx.lineWidth = 3;
  ctx.stroke();

  // Bottle luxury label
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.roundRect(240, 330, 120, 120, 6);
  ctx.fill();
  ctx.strokeStyle = "#c5a059";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Label text
  ctx.fillStyle = "#1e1e1e";
  ctx.font = "bold 14px serif";
  ctx.textAlign = "center";
  ctx.fillText("É L I X I R", 300, 375);
  ctx.font = "italic 10px sans-serif";
  ctx.fillStyle = "#666";
  ctx.fillText("EAU DE PARFUM", 300, 395);
  ctx.font = "9px sans-serif";
  ctx.fillText("PARIS", 300, 420);

  // Metallic gold bottle neck
  const neckGrad = ctx.createLinearGradient(270, 210, 330, 210);
  neckGrad.addColorStop(0, "#d4af37");
  neckGrad.addColorStop(0.5, "#fff2a8");
  neckGrad.addColorStop(1, "#aa820a");
  ctx.fillStyle = neckGrad;
  ctx.fillRect(270, 210, 60, 50);

  // Luxury bottle cap
  ctx.fillStyle = neckGrad;
  ctx.beginPath();
  ctx.roundRect(255, 140, 90, 70, 8);
  ctx.fill();
  ctx.strokeStyle = "#ffe885";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  return canvas;
}

/**
 * Creates an Amazon-compliant 2000x2000 pure white (RGB 255,255,255) main listing image
 * with centered product occupying ~85% of frame with subtle natural ground shadow.
 */
export function generateAmazonProductListing(cutout: HTMLCanvasElement): HTMLCanvasElement {
  const size = 2000;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create canvas context");

  // Pure Amazon RGB 255, 255, 255
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size, size);

  // Target product bounds: 82% of image frame per Amazon imaging standards
  const maxProductDim = size * 0.82;
  const aspect = cutout.width / (cutout.height || 1);
  let pw = maxProductDim;
  let ph = pw / aspect;
  if (ph > maxProductDim) {
    ph = maxProductDim;
    pw = ph * aspect;
  }

  const px = (size - pw) / 2;
  const py = (size - ph) / 2 - size * 0.02;

  // Ground shadow
  ctx.save();
  ctx.beginPath();
  const shadowY = py + ph - 8;
  const shadowW = pw * 0.65;
  const shadowH = ph * 0.06;
  ctx.ellipse(size / 2, shadowY, shadowW / 2, shadowH / 2, 0, 0, Math.PI * 2);
  const shadowGrad = ctx.createRadialGradient(size / 2, shadowY, 0, size / 2, shadowY, shadowW / 2);
  shadowGrad.addColorStop(0, "rgba(40, 40, 40, 0.28)");
  shadowGrad.addColorStop(0.6, "rgba(60, 60, 60, 0.10)");
  shadowGrad.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = shadowGrad;
  ctx.fill();
  ctx.restore();

  // Draw product
  ctx.drawImage(cutout, px, py, pw, ph);

  return canvas;
}


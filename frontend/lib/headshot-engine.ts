/**
 * AI Professional Headshot Studio Engine
 * Composites isolated portraits onto executive studio backdrops with professional
 * lighting simulation, rim glow, color temperature grading, and business framing.
 */

export type HeadshotBackdrop =
  | "city-skyline"
  | "executive-boardroom"
  | "warm-wood"
  | "studio-gray"
  | "corporate-navy"
  | "library";

export interface HeadshotBackdropConfig {
  id: HeadshotBackdrop;
  name: string;
  tagline: string;
  badge: string;
  gradient: [string, string, string];
  blurRadius: number;
}

export const HEADSHOT_BACKDROPS: HeadshotBackdropConfig[] = [
  {
    id: "city-skyline",
    name: "🌆 High-Rise City Skyline",
    tagline: "Out-of-focus metropolitan skyline",
    badge: "Most Popular",
    gradient: ["#2d3748", "#1a202c", "#0f172a"],
    blurRadius: 18,
  },
  {
    id: "executive-boardroom",
    name: "🏢 Modern Executive Office",
    tagline: "Glass partition with soft architectural glow",
    badge: "Corporate",
    gradient: ["#334155", "#1e293b", "#0f172a"],
    blurRadius: 14,
  },
  {
    id: "warm-wood",
    name: "🪵 Architectural Wood Slats",
    tagline: "Warm walnut & acoustic wooden panels",
    badge: "Creative",
    gradient: ["#451a03", "#78350f", "#292524"],
    blurRadius: 16,
  },
  {
    id: "studio-gray",
    name: "📷 Studio Textured Gray",
    tagline: "Classic textured studio muslin portrait backdrop",
    badge: "Classic",
    gradient: ["#52525b", "#27272a", "#18181b"],
    blurRadius: 10,
  },
  {
    id: "corporate-navy",
    name: "🎨 Minimalist Executive Navy",
    tagline: "Deep royal blue to midnight vignette",
    badge: "Sleek",
    gradient: ["#1e3a8a", "#0f172a", "#020617"],
    blurRadius: 8,
  },
  {
    id: "library",
    name: "📚 Academic Library",
    tagline: "Subtle mahogany bookshelves and soft warm ambient",
    badge: "Academic",
    gradient: ["#3e2723", "#1c1917", "#0c0a09"],
    blurRadius: 20,
  },
];

export type HeadshotLighting = "neutral-daylight" | "warm-executive" | "cool-modern" | "studio-dramatic";

export interface HeadshotOptions {
  backdrop: HeadshotBackdrop;
  lighting: HeadshotLighting;
  rimLightIntensity: number; // 0 to 1
  contrastBoost: number; // 0.8 to 1.3
  smoothSkin: boolean;
  aspectRatio: "1:1" | "4:5" | "3:4" | "16:9";
}

/**
 * Draw executive studio backdrop onto a canvas context
 */
export function drawExecutiveBackdrop(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  backdropId: HeadshotBackdrop,
) {
  const config = HEADSHOT_BACKDROPS.find((b) => b.id === backdropId) ?? HEADSHOT_BACKDROPS[0];
  const [col1, col2, col3] = config.gradient;

  // Radial executive vignette
  const centerX = width * 0.5;
  const centerY = height * 0.38;
  const radius = Math.max(width, height) * 0.85;

  const grad = ctx.createRadialGradient(centerX, centerY, radius * 0.1, centerX, centerY, radius);
  grad.addColorStop(0, col1);
  grad.addColorStop(0.55, col2);
  grad.addColorStop(1, col3);

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // Soft bokeh circles simulation for architectural depth
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  const numOrbs = 6;
  for (let i = 0; i < numOrbs; i++) {
    const ox = width * (0.2 + (i * 0.6) / numOrbs);
    const oy = height * (0.15 + (i % 2) * 0.35);
    const orad = 40 + (i % 3) * 35;
    const orbGrad = ctx.createRadialGradient(ox, oy, 0, ox, oy, orad);
    orbGrad.addColorStop(0, "rgba(255, 255, 255, 0.12)");
    orbGrad.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = orbGrad;
    ctx.beginPath();
    ctx.arc(ox, oy, orad, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * Renders the final corporate headshot with lighting, rim glow, and framing
 */
export async function renderHeadshot(
  sourceImage: HTMLImageElement | HTMLCanvasElement,
  options: HeadshotOptions,
): Promise<HTMLCanvasElement> {
  const outCanvas = document.createElement("canvas");
  const ctx = outCanvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Could not initialize headshot canvas.");

  // Target output dimensions
  let targetWidth = 1200;
  let targetHeight = 1200;

  if (options.aspectRatio === "4:5") {
    targetWidth = 1200;
    targetHeight = 1500;
  } else if (options.aspectRatio === "3:4") {
    targetWidth = 1200;
    targetHeight = 1600;
  } else if (options.aspectRatio === "16:9") {
    targetWidth = 1920;
    targetHeight = 1080;
  }

  outCanvas.width = targetWidth;
  outCanvas.height = targetHeight;

  // 1. Draw Executive Studio Backdrop
  drawExecutiveBackdrop(ctx, targetWidth, targetHeight, options.backdrop);

  // 2. Draw Subject in Golden-Ratio / Eye-Line position
  const srcW = sourceImage.width;
  const srcH = sourceImage.height;

  // Scale subject to fit nicely centered
  const scale = Math.min((targetWidth * 0.88) / srcW, (targetHeight * 0.95) / srcH);
  const drawW = srcW * scale;
  const drawH = srcH * scale;
  const drawX = (targetWidth - drawW) / 2;
  const drawY = targetHeight - drawH; // Anchor to bottom for torso/chest alignment

  // 3. Optional Rim Light Glow Behind Subject
  if (options.rimLightIntensity > 0) {
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    const rimGrad = ctx.createRadialGradient(
      targetWidth * 0.5,
      drawY + drawH * 0.25,
      drawW * 0.2,
      targetWidth * 0.5,
      drawY + drawH * 0.25,
      drawW * 0.65,
    );
    rimGrad.addColorStop(0, `rgba(255, 245, 230, ${options.rimLightIntensity * 0.4})`);
    rimGrad.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = rimGrad;
    ctx.fillRect(0, 0, targetWidth, targetHeight);
    ctx.restore();
  }

  // 4. Draw Subject
  ctx.drawImage(sourceImage, drawX, drawY, drawW, drawH);

  // 5. Lighting & Color Temperature Grade
  if (options.lighting === "warm-executive") {
    ctx.save();
    ctx.globalCompositeOperation = "color";
    ctx.fillStyle = "rgba(255, 190, 120, 0.12)";
    ctx.fillRect(0, 0, targetWidth, targetHeight);
    ctx.restore();
  } else if (options.lighting === "cool-modern") {
    ctx.save();
    ctx.globalCompositeOperation = "color";
    ctx.fillStyle = "rgba(180, 220, 255, 0.1)";
    ctx.fillRect(0, 0, targetWidth, targetHeight);
    ctx.restore();
  } else if (options.lighting === "studio-dramatic") {
    ctx.save();
    ctx.globalCompositeOperation = "overlay";
    const dramGrad = ctx.createLinearGradient(0, 0, targetWidth, 0);
    dramGrad.addColorStop(0, "rgba(255, 255, 255, 0.15)");
    dramGrad.addColorStop(1, "rgba(0, 0, 0, 0.2)");
    ctx.fillStyle = dramGrad;
    ctx.fillRect(0, 0, targetWidth, targetHeight);
    ctx.restore();
  }

  // 6. Contrast & Polish
  if (options.contrastBoost !== 1.0) {
    const imgData = ctx.getImageData(0, 0, targetWidth, targetHeight);
    const data = imgData.data;
    const factor = options.contrastBoost;
    for (let i = 0; i < data.length; i += 4) {
      data[i] = Math.min(255, Math.max(0, 128 + (data[i] - 128) * factor));
      data[i + 1] = Math.min(255, Math.max(0, 128 + (data[i + 1] - 128) * factor));
      data[i + 2] = Math.min(255, Math.max(0, 128 + (data[i + 2] - 128) * factor));
    }
    ctx.putImageData(imgData, 0, 0);
  }

  return outCanvas;
}

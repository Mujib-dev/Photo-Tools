/**
 * YouTube & Social Media Thumbnail Studio Engine
 *
 * Canvas generator for 16:9, 9:16, 1:1 and 4:5 thumbnails with:
 * - High-impact sticker outline generator (subject cutout glow & stroke)
 * - YouTube-optimized viral typography with drop shadows and badges
 * - Background presets, dimming and blur controls
 * - Feed CTR readiness analysis
 */

export type AspectRatio = "16:9" | "9:16" | "1:1" | "4:5";

export type BackgroundPreset =
  | "dark-neon"
  | "red-energy"
  | "sunset-flare"
  | "midnight-blue"
  | "electric-purple"
  | "money-green"
  | "studio-gray"
  | "custom";

export type FontPreset = "impact" | "black" | "sans" | "serif";

export interface ThumbnailConfig {
  titleText: string;
  subText: string;
  badgeText?: string;
  aspectRatio: AspectRatio;
  backgroundPreset: BackgroundPreset;
  backgroundDim: number; // 0 to 80 (%)
  backgroundBlur: number; // 0 to 24 (px, custom background only)
  customBgUrl?: string;
  textColor: string;
  subTextColor: string;
  badgeBgColor: string;
  badgeTextColor: string;
  fontPreset: FontPreset;
  titleScale: number; // 0.6 to 1.4
  stickerGlowColor: string;
  stickerGlowWidth: number; // 0 to 24
  textRotation: number; // -10 to +10 deg
  subjectScale: number; // 0.5 to 1.6
  subjectOffsetX: number; // -1 to 1
  subjectOffsetY: number; // -1 to 1
  subjectFlip: boolean;
  subjectShadow: boolean;
}

export const DEFAULT_THUMBNAIL_CONFIG: ThumbnailConfig = {
  titleText: "I TRIED THIS FOR 30 DAYS!",
  subText: "DON'T MAKE THIS MISTAKE",
  badgeText: "100% SHOCKING",
  aspectRatio: "16:9",
  backgroundPreset: "dark-neon",
  backgroundDim: 18,
  backgroundBlur: 8,
  textColor: "#FFEB3B",
  subTextColor: "#FFFFFF",
  badgeBgColor: "#FF1744",
  badgeTextColor: "#FFFFFF",
  fontPreset: "impact",
  titleScale: 1,
  stickerGlowColor: "#FFFFFF",
  stickerGlowWidth: 12,
  textRotation: -3,
  subjectScale: 1,
  subjectOffsetX: 0,
  subjectOffsetY: 0,
  subjectFlip: false,
  subjectShadow: true,
};

export interface ThumbnailTemplate {
  id: string;
  name: string;
  category: string;
  badge: string;
  config: Partial<ThumbnailConfig>;
}

export const THUMBNAIL_TEMPLATES: ThumbnailTemplate[] = [
  {
    id: "tech-review",
    name: "Tech Review & Setup",
    category: "Tech",
    badge: "Tech Review",
    config: {
      titleText: "DON'T BUY THIS YET!",
      subText: "M4 Pro In-Depth After 30 Days",
      badgeText: "WATCH FIRST",
      aspectRatio: "16:9",
      backgroundPreset: "midnight-blue",
      textColor: "#00E5FF",
      subTextColor: "#FFFFFF",
      badgeBgColor: "#0284C7",
      fontPreset: "sans",
      stickerGlowColor: "#00E5FF",
      stickerGlowWidth: 10,
      textRotation: -2,
    },
  },
  {
    id: "gaming-hype",
    name: "Gaming Hype & Clutch",
    category: "Gaming",
    badge: "Gaming Clutch",
    config: {
      titleText: "HOW DID HE SURVIVE?!",
      subText: "Insane 1v5 Ranked Clutch",
      badgeText: "WORLD RECORD",
      aspectRatio: "16:9",
      backgroundPreset: "red-energy",
      textColor: "#FFE600",
      subTextColor: "#FFFFFF",
      badgeBgColor: "#DC2626",
      fontPreset: "impact",
      stickerGlowColor: "#FF0055",
      stickerGlowWidth: 16,
      textRotation: -4,
    },
  },
  {
    id: "crypto-wealth",
    name: "Finance & Wealth Blueprint",
    category: "Finance",
    badge: "Finance & SaaS",
    config: {
      titleText: "PASSIVE INCOME 2026",
      subText: "From $0 to $10,000/Month",
      badgeText: "ROADMAP",
      aspectRatio: "16:9",
      backgroundPreset: "money-green",
      textColor: "#FDE047",
      subTextColor: "#F1F5F9",
      badgeBgColor: "#15803D",
      fontPreset: "black",
      stickerGlowColor: "#22C55E",
      stickerGlowWidth: 12,
      textRotation: 0,
    },
  },
  {
    id: "coding-tutorial",
    name: "Code Tutorial & Masterclass",
    category: "Dev",
    badge: "Coding / AI",
    config: {
      titleText: "BUILD FULL-STACK IN 20M",
      subText: "Next.js 15 & Autonomous Agents",
      badgeText: "FREE SOURCE",
      aspectRatio: "16:9",
      backgroundPreset: "dark-neon",
      textColor: "#38BDF8",
      subTextColor: "#E2E8F0",
      badgeBgColor: "#6366F1",
      fontPreset: "sans",
      stickerGlowColor: "#38BDF8",
      stickerGlowWidth: 8,
      textRotation: 0,
    },
  },
  {
    id: "documentary-mystery",
    name: "Documentary & Deep Dive",
    category: "Story",
    badge: "Documentary",
    config: {
      titleText: "THE UNTOLD TRUTH",
      subText: "What Really Happened Behind The Scenes",
      badgeText: "EXPOSED",
      aspectRatio: "16:9",
      backgroundPreset: "studio-gray",
      textColor: "#F8FAFC",
      subTextColor: "#CBD5E1",
      badgeBgColor: "#B91C1C",
      fontPreset: "serif",
      stickerGlowColor: "#F59E0B",
      stickerGlowWidth: 10,
      textRotation: -1,
    },
  },
  {
    id: "fitness-challenge",
    name: "Fitness & Transformation",
    category: "Health",
    badge: "Transformation",
    config: {
      titleText: "30-DAY BODY SHRED",
      subText: "The Only 3 Exercises You Need",
      badgeText: "BEFORE & AFTER",
      aspectRatio: "16:9",
      backgroundPreset: "sunset-flare",
      textColor: "#FEF08A",
      subTextColor: "#FFFFFF",
      badgeBgColor: "#EA580C",
      fontPreset: "impact",
      stickerGlowColor: "#F97316",
      stickerGlowWidth: 14,
      textRotation: -3,
    },
  },
  {
    id: "viral-shorts-hook",
    name: "Shorts & Viral Reel Hook",
    category: "Shorts",
    badge: "Shorts (9:16)",
    config: {
      titleText: "DO NOT SCROLL!",
      subText: "This Secret Changes Everything",
      badgeText: "WAIT FOR IT",
      aspectRatio: "9:16",
      backgroundPreset: "electric-purple",
      textColor: "#FDE047",
      subTextColor: "#FFFFFF",
      badgeBgColor: "#9333EA",
      fontPreset: "impact",
      stickerGlowColor: "#C084FC",
      stickerGlowWidth: 14,
      textRotation: -5,
    },
  },
  {
    id: "podcast-exclusive",
    name: "Podcast & Interview",
    category: "Podcast",
    badge: "Podcast Talk",
    config: {
      titleText: "HE BROKE HIS SILENCE",
      subText: "Uncensored Episode 104",
      badgeText: "EXCLUSIVE",
      aspectRatio: "16:9",
      backgroundPreset: "midnight-blue",
      textColor: "#FFFFFF",
      subTextColor: "#94A3B8",
      badgeBgColor: "#E11D48",
      fontPreset: "black",
      stickerGlowColor: "#FFFFFF",
      stickerGlowWidth: 8,
      textRotation: 0,
    },
  },
];

export const ASPECT_PRESETS: Array<{
  id: AspectRatio;
  label: string;
  hint: string;
  size: string;
}> = [
  { id: "16:9", label: "YouTube", hint: "1280 x 720", size: "16:9" },
  { id: "9:16", label: "Shorts / Reels", hint: "1080 x 1920", size: "9:16" },
  { id: "1:1", label: "Square", hint: "1080 x 1080", size: "1:1" },
  { id: "4:5", label: "Portrait", hint: "1080 x 1350", size: "4:5" },
];

export const BACKGROUND_PRESETS: Array<{
  id: Exclude<BackgroundPreset, "custom">;
  label: string;
  swatch: string;
}> = [
  { id: "dark-neon", label: "Dark Neon", swatch: "linear-gradient(135deg,#6366f1,#1e1b4b)" },
  { id: "red-energy", label: "Red Energy", swatch: "linear-gradient(135deg,#ef4444,#450a0a)" },
  { id: "sunset-flare", label: "Sunset Flare", swatch: "linear-gradient(135deg,#f97316,#7c2d12)" },
  { id: "midnight-blue", label: "Midnight Blue", swatch: "linear-gradient(135deg,#0ea5e9,#020617)" },
  { id: "electric-purple", label: "Electric Purple", swatch: "linear-gradient(135deg,#a855f7,#2e1065)" },
  { id: "money-green", label: "Money Green", swatch: "linear-gradient(135deg,#22c55e,#052e16)" },
  { id: "studio-gray", label: "Studio Gray", swatch: "linear-gradient(135deg,#737373,#171717)" },
];

export const FONT_PRESETS: Array<{ id: FontPreset; label: string; stack: string }> = [
  { id: "impact", label: "Impact", stack: "Impact, 'Arial Black', 'Haettenschweiler', sans-serif" },
  { id: "black", label: "Arial Black", stack: "'Arial Black', Impact, sans-serif" },
  { id: "sans", label: "Modern Sans", stack: "'Inter', 'Segoe UI', system-ui, sans-serif" },
  { id: "serif", label: "Bold Serif", stack: "Georgia, 'Times New Roman', serif" },
];

export function fontStackFor(preset: FontPreset): string {
  return FONT_PRESETS.find((font) => font.id === preset)?.stack ?? FONT_PRESETS[0].stack;
}

export function getThumbnailSize(aspectRatio: AspectRatio): { width: number; height: number } {
  switch (aspectRatio) {
    case "9:16":
      return { width: 1080, height: 1920 };
    case "1:1":
      return { width: 1080, height: 1080 };
    case "4:5":
      return { width: 1080, height: 1350 };
    default:
      return { width: 1280, height: 720 };
  }
}

/** Split text into lines that fit inside `maxWidth` (max 3 lines). */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines = 3,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth || !current) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);

  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = `${kept[maxLines - 1].replace(/\s+\S*$/, "")}…`;
    return kept;
  }
  return lines;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const cleaned = hex.replace("#", "").trim();
  if (cleaned.length !== 3 && cleaned.length !== 6) return null;
  const full =
    cleaned.length === 3
      ? cleaned
          .split("")
          .map((c) => c + c)
          .join("")
      : cleaned;
  const value = Number.parseInt(full, 16);
  if (!Number.isFinite(value)) return null;
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
}

function relativeLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const channel = (value: number) => {
    const s = value / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
}

function approximateBackgroundLuminance(config: ThumbnailConfig): number {
  if (config.backgroundPreset === "custom") return 0.28;
  if (config.backgroundPreset === "studio-gray") return 0.22;
  if (config.backgroundPreset === "sunset-flare") return 0.16;
  if (config.backgroundPreset === "midnight-blue") return 0.08;
  if (config.backgroundPreset === "money-green") return 0.1;
  if (config.backgroundPreset === "electric-purple") return 0.09;
  if (config.backgroundPreset === "red-energy") return 0.12;
  return 0.11;
}

export interface ThumbnailAnalysis {
  score: number;
  label: string;
  tips: string[];
  contrastRatio: number;
}

/** Heuristic CTR readiness score (0-100) with actionable tips. */
export function analyzeThumbnail(
  config: ThumbnailConfig,
  hasSubject: boolean,
): ThumbnailAnalysis {
  const tips: string[] = [];
  let score = 40;

  const title = config.titleText.trim();
  const words = title.split(/\s+/).filter(Boolean).length;

  if (title.length === 0) {
    tips.push("Add a short, punchy headline (3-6 words works best).");
  } else if (title.length <= 48 && words <= 6) {
    score += 18;
  } else {
    score += 8;
    tips.push("Keep the headline under 48 characters so it stays legible on mobile.");
  }

  if (config.badgeText?.trim()) {
    score += 10;
  } else {
    tips.push("Add a badge (e.g. NEW, 100% REAL) to create a curiosity gap.");
  }

  if (config.subText.trim()) score += 5;

  if (hasSubject) {
    score += 10;
  } else {
    tips.push("Upload a transparent subject cutout for an eye-catching sticker outline.");
  }

  if (config.aspectRatio === "16:9") score += 4;
  else if (config.aspectRatio === "9:16") score += 2;

  if (config.stickerGlowWidth >= 6) score += 4;
  else tips.push("Increase the sticker outline so the subject separates from the background.");

  if (config.fontPreset === "impact" || config.fontPreset === "black") score += 3;
  else tips.push("Heavy display fonts (Impact or Arial Black) read best at thumbnail size.");

  const fg = relativeLuminance(config.textColor);
  const bg = approximateBackgroundLuminance(config);
  const contrastRatio = (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05);
  if (contrastRatio >= 4.5) score += 6;
  else tips.push("Increase headline/background contrast for better mobile visibility.");

  if (hasSubject && config.subjectScale < 0.7) {
    tips.push("Scale the subject up — small faces get lost in the feed.");
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  const label =
    score >= 85 ? "Viral-ready" : score >= 70 ? "Strong" : score >= 50 ? "Needs polish" : "Weak";

  return { score, label, tips: tips.slice(0, 4), contrastRatio };
}

/**
 * Draw background onto the thumbnail canvas
 */
export function drawThumbnailBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  config: ThumbnailConfig,
  customBgImg?: HTMLImageElement | null,
) {
  ctx.clearRect(0, 0, width, height);

  if (config.backgroundPreset === "custom" && customBgImg) {
    const blur = Math.max(0, config.backgroundBlur);
    const pad = blur * 2;
    ctx.save();
    if (blur > 0) ctx.filter = `blur(${blur}px)`;
    ctx.drawImage(customBgImg, -pad, -pad, width + pad * 2, height + pad * 2);
    ctx.restore();

    // Dark vignette overlay so text pops.
    const vig = ctx.createLinearGradient(0, 0, width, height);
    vig.addColorStop(0, "rgba(0,0,0,0.25)");
    vig.addColorStop(1, "rgba(0,0,0,0.6)");
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, width, height);
  } else {
    const grad = ctx.createRadialGradient(
      width * 0.35,
      height * 0.45,
      Math.max(20, width * 0.04),
      width * 0.5,
      height * 0.5,
      width * 0.75,
    );

    if (config.backgroundPreset === "red-energy") {
      grad.addColorStop(0, "#dc2626");
      grad.addColorStop(0.55, "#7f1d1d");
      grad.addColorStop(1, "#180303");
    } else if (config.backgroundPreset === "sunset-flare") {
      grad.addColorStop(0, "#fb923c");
      grad.addColorStop(0.5, "#7c2d12");
      grad.addColorStop(1, "#09090b");
    } else if (config.backgroundPreset === "midnight-blue") {
      grad.addColorStop(0, "#0ea5e9");
      grad.addColorStop(0.6, "#0f172a");
      grad.addColorStop(1, "#020617");
    } else if (config.backgroundPreset === "electric-purple") {
      grad.addColorStop(0, "#a855f7");
      grad.addColorStop(0.5, "#3b0764");
      grad.addColorStop(1, "#09090b");
    } else if (config.backgroundPreset === "money-green") {
      grad.addColorStop(0, "#22c55e");
      grad.addColorStop(0.55, "#14532d");
      grad.addColorStop(1, "#020617");
    } else if (config.backgroundPreset === "studio-gray") {
      grad.addColorStop(0, "#9ca3af");
      grad.addColorStop(0.55, "#374151");
      grad.addColorStop(1, "#030712");
    } else {
      // dark-neon
      grad.addColorStop(0, "#818cf8");
      grad.addColorStop(0.5, "#1e1b4b");
      grad.addColorStop(1, "#09090b");
    }

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Subtle speed streaks add energy without competing with the text.
    ctx.save();
    ctx.globalAlpha = 0.12;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = Math.max(2, width * 0.003);
    for (let i = 0; i < 6; i += 1) {
      const y = height * (0.1 + i * 0.16);
      ctx.beginPath();
      ctx.moveTo(-width * 0.1, y + height * 0.12);
      ctx.lineTo(width * 1.1, y - height * 0.12);
      ctx.stroke();
    }
    ctx.restore();
  }

  if (config.backgroundDim > 0) {
    ctx.fillStyle = `rgba(0,0,0,${Math.min(80, config.backgroundDim) / 100})`;
    ctx.fillRect(0, 0, width, height);
  }
}

/**
 * Draw the subject cutout with a sticker outline and drop shadow.
 * Position and scale respond to the editor controls.
 */
export function drawSubjectSticker(
  ctx: CanvasRenderingContext2D,
  subjectImg: HTMLImageElement,
  canvasW: number,
  canvasH: number,
  config: ThumbnailConfig,
) {
  const wide = canvasW >= canvasH;
  const baseScale = wide
    ? Math.min((canvasW * 0.6) / subjectImg.width, (canvasH * 0.94) / subjectImg.height)
    : Math.min((canvasW * 0.92) / subjectImg.width, (canvasH * 0.55) / subjectImg.height);

  const scale = baseScale * config.subjectScale;
  const drawW = subjectImg.width * scale;
  const drawH = subjectImg.height * scale;

  const anchorX = wide ? canvasW - drawW * 0.9 : (canvasW - drawW) / 2;
  const anchorY = wide ? canvasH - drawH : canvasH - drawH - canvasH * 0.03;
  const drawX = anchorX + config.subjectOffsetX * canvasW * 0.35;
  const drawY = anchorY + config.subjectOffsetY * canvasH * 0.35;

  const glowWidth = Math.max(0, config.stickerGlowWidth) * (Math.min(canvasW, canvasH) / 720);

  ctx.save();
  ctx.translate(drawX + drawW / 2, drawY + drawH / 2);
  if (config.subjectFlip) ctx.scale(-1, 1);
  const localX = -drawW / 2;
  const localY = -drawH / 2;

  // Draw the sticker border by rendering offset copies around the subject.
  if (glowWidth > 0) {
    const steps = 16;
    for (let i = 0; i < steps; i += 1) {
      const angle = (i * 2 * Math.PI) / steps;
      const dx = Math.cos(angle) * glowWidth;
      const dy = Math.sin(angle) * glowWidth;

      ctx.save();
      ctx.shadowColor = config.stickerGlowColor;
      ctx.shadowBlur = glowWidth * 1.4;
      ctx.globalAlpha = 0.9;
      ctx.drawImage(subjectImg, localX + dx, localY + dy, drawW, drawH);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  // Draw the subject on top with a crisp drop shadow.
  if (config.subjectShadow) {
    ctx.shadowColor = "rgba(0, 0, 0, 0.75)";
    ctx.shadowBlur = 24;
    ctx.shadowOffsetX = -10;
    ctx.shadowOffsetY = 10;
  }
  ctx.drawImage(subjectImg, localX, localY, drawW, drawH);

  ctx.restore();
}

/**
 * Draw YouTube viral typography.
 */
export function drawThumbnailTypography(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  config: ThumbnailConfig,
) {
  const wide = width > height;
  const tall = height > width * 1.2;
  const centerX = wide ? width * 0.31 : width * 0.5;
  const centerY = wide ? height * 0.44 : tall ? height * 0.22 : height * 0.28;

  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate((config.textRotation * Math.PI) / 180);

  const font = fontStackFor(config.fontPreset);
  const titleSize = Math.round(
    Math.min(width, height) * (wide ? 0.12 : 0.105) * config.titleScale,
  );
  const maxTextWidth = wide ? width * 0.58 : width * 0.9;

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // Badge text sits above the headline.
  const badgeFontSize = Math.max(16, Math.round(Math.min(width, height) * 0.05));
  const badgeText = config.badgeText?.trim().toUpperCase() ?? "";
  let badgeH = 0;
  let badgeW = 0;

  if (badgeText) {
    ctx.font = `900 ${badgeFontSize}px ${font}`;
    const metrics = ctx.measureText(badgeText);
    const padX = badgeFontSize * 0.9;
    const padY = badgeFontSize * 0.35;
    badgeW = metrics.width + padX * 2;
    badgeH = badgeFontSize + padY * 2;
  }

  // Headline (wraps up to three lines).
  ctx.font = `900 ${titleSize}px ${font}`;
  const titleLines = config.titleText.trim()
    ? wrapText(ctx, config.titleText.trim().toUpperCase(), maxTextWidth, 3)
    : [];
  const lineHeight = titleSize * 1.04;
  const titleH = titleLines.length * lineHeight;

  if (badgeText) {
    const badgeY = -titleH / 2 - badgeH / 2 - Math.round(height * 0.02);
    ctx.save();
    ctx.fillStyle = config.badgeBgColor;
    ctx.shadowColor = "rgba(0,0,0,0.8)";
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.roundRect(-badgeW / 2, badgeY - badgeH / 2, badgeW, badgeH, badgeH * 0.28);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = config.badgeTextColor;
    ctx.fillText(badgeText, 0, badgeY);
  }

  if (titleLines.length > 0) {
    ctx.font = `900 ${titleSize}px ${font}`;
    ctx.lineJoin = "round";

    titleLines.forEach((line, index) => {
      const y = -titleH / 2 + lineHeight / 2 + index * lineHeight;

      ctx.strokeStyle = "#000000";
      ctx.lineWidth = titleSize * 0.18;
      ctx.shadowColor = "rgba(0, 0, 0, 0.9)";
      ctx.shadowBlur = 20;
      ctx.strokeText(line, 0, y);

      ctx.shadowBlur = 0;
      ctx.fillStyle = config.textColor;
      ctx.fillText(line, 0, y);
    });
  }

  // Subtext below the headline.
  if (config.subText.trim()) {
    const subSize = Math.round(
      Math.min(width, height) * (wide ? 0.08 : 0.07) * Math.min(1.15, config.titleScale),
    );
    const subLines = wrapText(
      ctx,
      config.subText.trim().toUpperCase(),
      maxTextWidth,
      2,
    );
    ctx.font = `900 ${subSize}px ${font}`;
    const subLineHeight = subSize * 1.02;

    subLines.forEach((line, index) => {
      const y = titleH / 2 + subSize * 0.9 + index * subLineHeight;
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = subSize * 0.16;
      ctx.lineJoin = "round";
      ctx.shadowColor = "rgba(0, 0, 0, 0.8)";
      ctx.shadowBlur = 14;
      ctx.strokeText(line, 0, y);

      ctx.shadowBlur = 0;
      ctx.fillStyle = config.subTextColor;
      ctx.fillText(line, 0, y);
    });
  }

  ctx.restore();
}

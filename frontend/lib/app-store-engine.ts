/**
 * App Store & Google Play Screenshot Packager Engine
 *
 * Generates official-spec promotional screenshots for the Apple App Store
 * and Google Play Store with vector device frames, panoramic connected backgrounds,
 * marketing copy, and automated batch ZIP export.
 */

import { createZip } from "./zip";

export type StoreDeviceFormat =
  | "iphone-67" // 1290 x 2796 (iPhone 16 Pro Max, 15 Pro Max)
  | "iphone-65" // 1242 x 2688 (iPhone 11 Pro Max, XS Max)
  | "ipad-129" // 2048 x 2732 (12.9" iPad Pro)
  | "android-phone"; // 1080 x 2400 (Google Play Modern Phone)

export interface DeviceFormatMeta {
  id: StoreDeviceFormat;
  name: string;
  store: "apple" | "google";
  width: number;
  height: number;
  aspectDesc: string;
}

export const STORE_FORMATS: Record<StoreDeviceFormat, DeviceFormatMeta> = {
  "iphone-67": {
    id: "iphone-67",
    name: "Apple 6.7\" Display (16 Pro / 15 Pro Max)",
    store: "apple",
    width: 1290,
    height: 2796,
    aspectDesc: "1290 × 2796 px (19.5:9)",
  },
  "iphone-65": {
    id: "iphone-65",
    name: "Apple 6.5\" Display (11 Pro Max / XS Max)",
    store: "apple",
    width: 1242,
    height: 2688,
    aspectDesc: "1242 × 2688 px (19.5:9)",
  },
  "ipad-129": {
    id: "ipad-129",
    name: "Apple iPad Pro 12.9\" Display",
    store: "apple",
    width: 2048,
    height: 2732,
    aspectDesc: "2048 × 2732 px (4:3)",
  },
  "android-phone": {
    id: "android-phone",
    name: "Google Play Store (Modern Android)",
    store: "google",
    width: 1080,
    height: 2400,
    aspectDesc: "1080 × 2400 px (20:9)",
  },
};

export type DeviceStyle = "iphone-titanium" | "ipad-pro" | "android-flagship" | "frameless-card";
export type DevicePosition = "bottom-bleed" | "centered" | "tilted-angle";

export interface AppStoreSlide {
  id: string;
  headline: string;
  subheadline: string;
  badgeText?: string;
  screenDataUrl: string | null;
}

export interface AppStoreConfig {
  format: StoreDeviceFormat;
  deviceStyle: DeviceStyle;
  position: DevicePosition;
  deviceColor: "titanium-dark" | "titanium-silver" | "titanium-gold" | "deep-blue";
  bgType: "connected-gradient" | "solid" | "spotlight";
  bgStartColor: string;
  bgEndColor: string;
  textColor: string;
  accentColor: string;
  slides: AppStoreSlide[];
}

export const INITIAL_APP_STORE_CONFIG: AppStoreConfig = {
  format: "iphone-67",
  deviceStyle: "iphone-titanium",
  position: "bottom-bleed",
  deviceColor: "titanium-dark",
  bgType: "connected-gradient",
  bgStartColor: "#4f46e5",
  bgEndColor: "#06b6d4",
  textColor: "#ffffff",
  accentColor: "#38bdf8",
  slides: [
    {
      id: "slide-1",
      headline: "Track Everything In Real Time",
      subheadline: "Smart insights, zero clutter, and blazing speed.",
      badgeText: "★ 4.9 APP STORE RATING",
      screenDataUrl: null,
    },
    {
      id: "slide-2",
      headline: "Automate Your Daily Workflow",
      subheadline: "Connect your favourite tools in under 60 seconds.",
      badgeText: "FEATURED BY EDITORS",
      screenDataUrl: null,
    },
    {
      id: "slide-3",
      headline: "Bank-Grade Privacy & Security",
      subheadline: "100% on-device processing. Your data stays yours.",
      badgeText: "ZERO DATA TRACKING",
      screenDataUrl: null,
    },
  ],
};

export interface AppStoreTemplate {
  id: string;
  name: string;
  badge: string;
  category: string;
  config: Partial<AppStoreConfig>;
}

export const APP_STORE_TEMPLATES: AppStoreTemplate[] = [
  {
    id: "fintech",
    name: "Fintech & Investing",
    badge: "Fintech",
    category: "Finance",
    config: {
      bgType: "connected-gradient",
      bgStartColor: "#0f172a",
      bgEndColor: "#0284c7",
      textColor: "#ffffff",
      accentColor: "#38bdf8",
      slides: [
        {
          id: "slide-1",
          headline: "Zero-Fee Global Investing",
          subheadline: "Trade US stocks, crypto & index funds with zero commission.",
          badgeText: "★ 4.9 RATED BY 80K USERS",
          screenDataUrl: null,
        },
        {
          id: "slide-2",
          headline: "Automated Recurring Wealth",
          subheadline: "Dollar-cost average into top index funds every payday.",
          badgeText: "AUTOMATED DEPOSITS",
          screenDataUrl: null,
        },
        {
          id: "slide-3",
          headline: "Institutional-Grade Vault Security",
          subheadline: "256-bit AES encryption with biometric Face ID protection.",
          badgeText: "SIPC PROTECTED",
          screenDataUrl: null,
        },
      ],
    },
  },
  {
    id: "health-fitness",
    name: "Fitness & Nutrition",
    badge: "Health",
    category: "Fitness",
    config: {
      bgType: "connected-gradient",
      bgStartColor: "#881337",
      bgEndColor: "#f97316",
      textColor: "#ffffff",
      accentColor: "#fb923c",
      slides: [
        {
          id: "slide-1",
          headline: "Crush Your Personal Records",
          subheadline: "Smart progressive overload and live rest timer.",
          badgeText: "APPLE HEALTH COMPATIBLE",
          screenDataUrl: null,
        },
        {
          id: "slide-2",
          headline: "Instant AI Calorie Scanner",
          subheadline: "Snap a photo of your meal for accurate macros in 2 seconds.",
          badgeText: "AI FOOD LOGGING",
          screenDataUrl: null,
        },
        {
          id: "slide-3",
          headline: "Real-Time Heart Rate Zones",
          subheadline: "Maximize fat burn and cardio endurance with haptic alerts.",
          badgeText: "ZONE 2 TRAINING",
          screenDataUrl: null,
        },
      ],
    },
  },
  {
    id: "productivity-ai",
    name: "AI Copilot & Notes",
    badge: "AI / Work",
    category: "Productivity",
    config: {
      bgType: "connected-gradient",
      bgStartColor: "#18181b",
      bgEndColor: "#4f46e5",
      textColor: "#ffffff",
      accentColor: "#c084fc",
      slides: [
        {
          id: "slide-1",
          headline: "Your Autonomous AI Copilot",
          subheadline: "Draft documents, summarize meetings, and debug code instantly.",
          badgeText: "GPT-4O POWERED",
          screenDataUrl: null,
        },
        {
          id: "slide-2",
          headline: "Instant Voice-to-Action Notes",
          subheadline: "Speak naturally. AI organizes your ideas into structured tasks.",
          badgeText: "99.8% ACCURACY",
          screenDataUrl: null,
        },
        {
          id: "slide-3",
          headline: "End-to-End Encrypted Cloud Sync",
          subheadline: "Access your second brain across iPhone, iPad, and Mac.",
          badgeText: "ZERO KNOWLEDGE PRIVACY",
          screenDataUrl: null,
        },
      ],
    },
  },
  {
    id: "mindfulness-sleep",
    name: "Sleep & Meditation",
    badge: "Wellness",
    category: "Lifestyle",
    config: {
      bgType: "connected-gradient",
      bgStartColor: "#0f172a",
      bgEndColor: "#312e81",
      textColor: "#ffffff",
      accentColor: "#818cf8",
      slides: [
        {
          id: "slide-1",
          headline: "Fall Asleep Faster in 10 Minutes",
          subheadline: "Scientifically engineered soundscapes and binaural beats.",
          badgeText: "OVER 1M SLEEPERS",
          screenDataUrl: null,
        },
        {
          id: "slide-2",
          headline: "100+ Spatial Audio Soundscapes",
          subheadline: "Gentle rain, ocean waves, crackling fire, and deep brown noise.",
          badgeText: "DOLBY ATMOS AUDIO",
          screenDataUrl: null,
        },
        {
          id: "slide-3",
          headline: "Smart Gentle Phase Alarm",
          subheadline: "Wake up naturally at the optimal light sleep cycle.",
          badgeText: "NO GROGGINESS",
          screenDataUrl: null,
        },
      ],
    },
  },
];

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image: " + src));
    img.src = src;
  });
}

/**
 * Draws the vector device frame (iPhone Titanium, iPad Pro, Android, or Frameless).
 */
function drawVectorDevice(
  ctx: CanvasRenderingContext2D,
  screenImg: HTMLImageElement | null,
  x: number,
  y: number,
  width: number,
  height: number,
  style: DeviceStyle,
  colorScheme: string,
  angleRad: number = 0
) {
  ctx.save();
  ctx.translate(x + width / 2, y + height / 2);
  if (angleRad !== 0) {
    ctx.rotate(angleRad);
  }

  const hw = width / 2;
  const hh = height / 2;

  // Drop Shadow
  ctx.shadowColor = "rgba(0, 0, 0, 0.45)";
  ctx.shadowBlur = 45;
  ctx.shadowOffsetY = 25;

  const cornerRadius = style === "ipad-pro" ? 36 : style === "frameless-card" ? 32 : 48;
  const bezel = style === "frameless-card" ? 0 : style === "ipad-pro" ? 18 : 16;

  // Outer Titanium / Metal Bezel
  if (style !== "frameless-card") {
    let bezelGrad = ctx.createLinearGradient(-hw, -hh, hw, hh);
    if (colorScheme === "titanium-silver") {
      bezelGrad.addColorStop(0, "#e2e8f0");
      bezelGrad.addColorStop(0.5, "#94a3b8");
      bezelGrad.addColorStop(1, "#cbd5e1");
    } else if (colorScheme === "titanium-gold") {
      bezelGrad.addColorStop(0, "#fde68a");
      bezelGrad.addColorStop(0.5, "#d97706");
      bezelGrad.addColorStop(1, "#b45309");
    } else {
      // Dark Titanium
      bezelGrad.addColorStop(0, "#334155");
      bezelGrad.addColorStop(0.5, "#0f172a");
      bezelGrad.addColorStop(1, "#1e293b");
    }
    ctx.fillStyle = bezelGrad;
    ctx.beginPath();
    ctx.roundRect(-hw, -hh, width, height, cornerRadius);
    ctx.fill();
  }

  // Clear shadow before screen drawing
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  // Screen Area (Inner Display)
  const screenX = -hw + bezel;
  const screenY = -hh + bezel;
  const screenW = width - bezel * 2;
  const screenH = height - bezel * 2;
  const screenRadius = Math.max(8, cornerRadius - bezel);

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(screenX, screenY, screenW, screenH, screenRadius);
  ctx.clip();

  // Background behind screenshot (default dark display)
  ctx.fillStyle = "#020617";
  ctx.fillRect(screenX, screenY, screenW, screenH);

  if (screenImg) {
    ctx.drawImage(screenImg, screenX, screenY, screenW, screenH);
  } else {
    // Elegant Placeholder Graphic inside screen
    const grad = ctx.createLinearGradient(screenX, screenY, screenX + screenW, screenY + screenH);
    grad.addColorStop(0, "#1e1b4b");
    grad.addColorStop(1, "#0f172a");
    ctx.fillStyle = grad;
    ctx.fillRect(screenX, screenY, screenW, screenH);

    ctx.fillStyle = "#4f46e5";
    ctx.beginPath();
    ctx.arc(0, 0, 70, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 24px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Upload Screen", 0, 0);

    ctx.font = "16px system-ui, sans-serif";
    ctx.fillStyle = "#94a3b8";
    ctx.fillText("Drop your app screenshot here", 0, 36);
  }

  ctx.restore();

  // Draw Camera Cutout / Dynamic Island on top of screen
  if (style === "iphone-titanium") {
    // Dynamic Island pill
    const pillW = width * 0.28;
    const pillH = 34;
    const pillY = screenY + 16;
    ctx.fillStyle = "#000000";
    ctx.beginPath();
    ctx.roundRect(-pillW / 2, pillY, pillW, pillH, pillH / 2);
    ctx.fill();

    // Subtle front camera lens dot
    ctx.fillStyle = "#0f172a";
    ctx.beginPath();
    ctx.arc(pillW * 0.28, pillY + pillH / 2, 5, 0, Math.PI * 2);
    ctx.fill();
  } else if (style === "android-flagship") {
    // Center punch hole
    ctx.fillStyle = "#000000";
    ctx.beginPath();
    ctx.arc(0, screenY + 22, 10, 0, Math.PI * 2);
    ctx.fill();
  } else if (style === "ipad-pro") {
    // Top bezel camera
    ctx.fillStyle = "#09090b";
    ctx.beginPath();
    ctx.arc(0, -hh + bezel / 2, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

/**
 * Renders a single App Store promotional screenshot slide onto a canvas.
 */
export async function renderStoreSlideCanvas(
  config: AppStoreConfig,
  slideIndex: number,
  scale: number = 1.0
): Promise<HTMLCanvasElement> {
  const meta = STORE_FORMATS[config.format];
  const targetW = meta.width * scale;
  const targetH = meta.height * scale;

  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create 2D canvas context");

  const slide = config.slides[slideIndex];
  const totalSlides = config.slides.length;

  // 1. Background
  if (config.bgType === "connected-gradient") {
    // Panoramic gradient flowing across all slides
    // Slide index fraction:
    const startFrac = slideIndex / totalSlides;
    const endFrac = (slideIndex + 1) / totalSlides;

    // Linear gradient for this specific slide
    const bgGrad = ctx.createLinearGradient(0, 0, targetW, targetH);
    bgGrad.addColorStop(0, config.bgStartColor);
    bgGrad.addColorStop(1, config.bgEndColor);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, targetW, targetH);

    // Subtle ambient lighting overlay
    const radial = ctx.createRadialGradient(
      targetW * 0.5,
      targetH * 0.35,
      50 * scale,
      targetW * 0.5,
      targetH * 0.5,
      targetW * 0.8
    );
    radial.addColorStop(0, "rgba(255, 255, 255, 0.12)");
    radial.addColorStop(1, "rgba(0, 0, 0, 0.2)");
    ctx.fillStyle = radial;
    ctx.fillRect(0, 0, targetW, targetH);
  } else if (config.bgType === "spotlight") {
    ctx.fillStyle = "#09090b";
    ctx.fillRect(0, 0, targetW, targetH);

    const rad = ctx.createRadialGradient(
      targetW * 0.5,
      targetH * 0.55,
      80 * scale,
      targetW * 0.5,
      targetH * 0.55,
      targetW * 0.75
    );
    rad.addColorStop(0, config.bgStartColor + "bb");
    rad.addColorStop(1, "#09090b");
    ctx.fillStyle = rad;
    ctx.fillRect(0, 0, targetW, targetH);
  } else {
    ctx.fillStyle = config.bgStartColor;
    ctx.fillRect(0, 0, targetW, targetH);
  }

  // 2. Marketing Typography (Top Section)
  const padX = targetW * 0.08;
  let topY = targetH * 0.065;

  // Optional Badge / Star Rating
  if (slide?.badgeText) {
    ctx.font = `800 ${22 * scale}px system-ui, -apple-system, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const badgeMetrics = ctx.measureText(slide.badgeText);
    const bW = badgeMetrics.width + 36 * scale;
    const bH = 46 * scale;
    const bX = (targetW - bW) / 2;

    ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
    ctx.strokeStyle = config.accentColor;
    ctx.lineWidth = 2 * scale;
    ctx.beginPath();
    ctx.roundRect(bX, topY, bW, bH, bH / 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = config.accentColor;
    ctx.fillText(slide.badgeText, targetW / 2, topY + bH / 2);

    topY += bH + 28 * scale;
  }

  // Headline
  ctx.fillStyle = config.textColor;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.font = `800 ${72 * scale}px system-ui, -apple-system, sans-serif`;

  const words = (slide?.headline || "Your App Headline").split(" ");
  let line = "";
  const maxTextW = targetW - padX * 2;
  const headlineLineHeight = 84 * scale;

  for (let w = 0; w < words.length; w++) {
    const testLine = line + words[w] + " ";
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxTextW && w > 0) {
      ctx.fillText(line.trim(), targetW / 2, topY);
      line = words[w] + " ";
      topY += headlineLineHeight;
    } else {
      line = testLine;
    }
  }
  if (line.trim().length > 0) {
    ctx.fillText(line.trim(), targetW / 2, topY);
    topY += headlineLineHeight + 12 * scale;
  }

  // Subheadline
  if (slide?.subheadline) {
    ctx.font = `500 ${36 * scale}px system-ui, -apple-system, sans-serif`;
    ctx.fillStyle = "rgba(255, 255, 255, 0.85)";

    const subWords = slide.subheadline.split(" ");
    let sLine = "";
    const subLineHeight = 48 * scale;

    for (let sw = 0; sw < subWords.length; sw++) {
      const testLine = sLine + subWords[sw] + " ";
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxTextW && sw > 0) {
        ctx.fillText(sLine.trim(), targetW / 2, topY);
        sLine = subWords[sw] + " ";
        topY += subLineHeight;
      } else {
        sLine = testLine;
      }
    }
    if (sLine.trim().length > 0) {
      ctx.fillText(sLine.trim(), targetW / 2, topY);
    }
  }

  // 3. Render Device Bezel with Screenshot
  let screenImg: HTMLImageElement | null = null;
  if (slide?.screenDataUrl) {
    try {
      screenImg = await loadImage(slide.screenDataUrl);
    } catch {
      screenImg = null;
    }
  }

  // Calculate device sizing based on format & positioning
  const isTablet = config.format === "ipad-129";
  let devW = isTablet ? targetW * 0.82 : targetW * 0.84;
  let devH = isTablet ? devW * (2732 / 2048) : devW * (2796 / 1290);

  let devX = (targetW - devW) / 2;
  let devY = targetH - devH * 0.78; // Bottom-bleed default
  let angleRad = 0;

  if (config.position === "centered") {
    devW = targetW * 0.72;
    devH = isTablet ? devW * (2732 / 2048) : devW * (2796 / 1290);
    devX = (targetW - devW) / 2;
    devY = targetH * 0.42;
  } else if (config.position === "tilted-angle") {
    devW = targetW * 0.8;
    devH = isTablet ? devW * (2732 / 2048) : devW * (2796 / 1290);
    devX = targetW * 0.12;
    devY = targetH * 0.38;
    angleRad = (-7 * Math.PI) / 180; // 7 degree tilt
  }

  drawVectorDevice(
    ctx,
    screenImg,
    devX,
    devY,
    devW,
    devH,
    config.deviceStyle,
    config.deviceColor,
    angleRad
  );

  return canvas;
}

export interface GeneratedStoreSlide {
  index: number;
  filename: string;
  blob: Blob;
  dataUrl: string;
}

/**
 * Generates all slides at 100% store resolution for ZIP packaging.
 */
export async function packageStoreScreenshots(config: AppStoreConfig): Promise<GeneratedStoreSlide[]> {
  const meta = STORE_FORMATS[config.format];
  const results: GeneratedStoreSlide[] = [];

  for (let i = 0; i < config.slides.length; i++) {
    const canvas = await renderStoreSlideCanvas(config, i, 1.0);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => {
        if (b) resolve(b);
        else reject(new Error("Canvas blob conversion failed"));
      }, "image/png");
    });

    const dataUrl = canvas.toDataURL("image/png");
    const num = String(i + 1).padStart(2, "0");
    const prefix = meta.store === "apple" ? "ios" : "play";
    const filename = `${num}_${prefix}_${meta.id}_screenshot.png`;

    results.push({
      index: i + 1,
      filename,
      blob,
      dataUrl,
    });
  }

  return results;
}

/**
 * Creates a ready-to-upload ZIP for App Store Connect or Google Play Console.
 */
export async function exportStoreZip(slides: GeneratedStoreSlide[]): Promise<Blob> {
  const zipEntries = slides.map((s) => ({
    name: s.filename,
    blob: s.blob,
  }));
  return createZip(zipEntries);
}

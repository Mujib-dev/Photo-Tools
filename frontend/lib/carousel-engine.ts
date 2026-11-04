/**
 * Seamless Panoramic Carousel Maker Engine
 *
 * Designed for Instagram, LinkedIn, and Twitter/X multi-slide carousel posts.
 * Generates continuous panoramic images where graphics, backgrounds, and text
 * flow seamlessly across slide seams, with instant slicing to individual slides,
 * ZIP packaging, and multi-page PDF generation for LinkedIn documents.
 */

import { createZip } from "./zip";

export type CarouselFormat = "ig-portrait" | "ig-square" | "ig-story" | "linkedin-doc";

export interface CarouselDimensions {
  width: number;
  height: number;
  label: string;
  ratio: string;
}

export const CAROUSEL_FORMATS: Record<CarouselFormat, CarouselDimensions> = {
  "ig-portrait": { width: 1080, height: 1350, label: "Instagram Portrait (4:5)", ratio: "4:5" },
  "ig-square": { width: 1080, height: 1080, label: "Instagram / Square (1:1)", ratio: "1:1" },
  "ig-story": { width: 1080, height: 1920, label: "Story / Vertical (9:16)", ratio: "9:16" },
  "linkedin-doc": { width: 1080, height: 1350, label: "LinkedIn Document (4:5)", ratio: "4:5" },
};

export type BackgroundType = "gradient" | "solid" | "mesh" | "image";

export interface CarouselGradient {
  name: string;
  from: string;
  to: string;
  via?: string;
  angle: number;
}

export const CAROUSEL_GRADIENTS: CarouselGradient[] = [
  { name: "Midnight Indigo", from: "#0f172a", to: "#1e1b4b", via: "#312e81", angle: 90 },
  { name: "Sunset Horizon", from: "#f97316", to: "#ec4899", via: "#8b5cf6", angle: 90 },
  { name: "Emerald Forest", from: "#064e3b", to: "#022c22", via: "#047857", angle: 90 },
  { name: "Cyber Neon", from: "#050505", to: "#1e1b4b", via: "#06b6d4", angle: 90 },
  { name: "Warm Minimalist", from: "#fafaf9", to: "#e7e5e4", via: "#f5f5f4", angle: 90 },
  { name: "Deep Charcoal", from: "#18181b", to: "#09090b", angle: 90 },
  { name: "Electric Purple", from: "#581c87", to: "#2e1065", via: "#7c3aed", angle: 90 },
  { name: "Ocean Breeze", from: "#0c4a6e", to: "#075985", via: "#0284c7", angle: 90 },
];

export interface SlideContent {
  eyebrow: string;
  title: string;
  body: string;
  badge?: string;
}

export interface FloatingImage {
  id: string;
  src: string;
  xPercent: number; // 0 to 100 relative to full panorama width
  yPercent: number; // 0 to 100 relative to height
  scalePercent: number; // 10 to 200
  rotation: number; // -180 to 180 degrees
  opacity: number; // 0 to 1
  borderRadius: number; // px
  shadow: boolean;
}

export interface CarouselState {
  format: CarouselFormat;
  slideCount: number; // 2 to 10
  bgType: BackgroundType;
  selectedGradientIndex: number;
  customSolidColor: string;
  bgImageUrl: string | null;
  bgImageOpacity: number;
  authorHandle: string;
  showSlideNumbers: boolean;
  showSwipeHint: boolean;
  swipeHintText: string;
  textColor: string;
  accentColor: string;
  slides: SlideContent[];
  floatingImages: FloatingImage[];
}

export const INITIAL_CAROUSEL_STATE: CarouselState = {
  format: "ig-portrait",
  slideCount: 5,
  bgType: "gradient",
  selectedGradientIndex: 0,
  customSolidColor: "#0f172a",
  bgImageUrl: null,
  bgImageOpacity: 0.4,
  authorHandle: "@yourbrand",
  showSlideNumbers: true,
  showSwipeHint: true,
  swipeHintText: "Swipe Next →",
  textColor: "#ffffff",
  accentColor: "#38bdf8",
  slides: [
    {
      eyebrow: "01 / STRATEGY",
      title: "How to Build a Seamless Carousel That Converts",
      body: "Swipe across to discover the 4-step framework used by top creators to capture attention.",
      badge: "FEATURED GUIDE",
    },
    {
      eyebrow: "02 / HOOK & FLOW",
      title: "Step 1: The Visual Seam Crossing",
      body: "Position your hero image right across the seam between slides. The incomplete visual triggers a psychological curiosity loop that forces the reader to swipe.",
    },
    {
      eyebrow: "03 / HIGH VALUE",
      title: "Step 2: One Clear Idea Per Slide",
      body: "Don't overload your slides. High readability with punchy typography keeps retention high through all 5 to 10 slides.",
    },
    {
      eyebrow: "04 / SOCIAL PROOF",
      title: "Step 3: Reinforce With Data",
      body: "Carousels generate 3.1x higher engagement and save rates on LinkedIn and Instagram compared to standard static posts.",
      badge: "3.1X ENGAGEMENT",
    },
    {
      eyebrow: "05 / CALL TO ACTION",
      title: "Ready to Create Your Own?",
      body: "Save this post for your next campaign and share it with a founder or creator who needs this.",
      badge: "SAVE & SHARE",
    },
  ],
  floatingImages: [],
};

export interface CarouselTemplate {
  id: string;
  name: string;
  category: string;
  badge: string;
  state: Partial<CarouselState>;
}

export const CAROUSEL_TEMPLATES: CarouselTemplate[] = [
  {
    id: "creator-growth",
    name: "Viral Carousel Framework",
    category: "Marketing",
    badge: "Marketing",
    state: {
      ...INITIAL_CAROUSEL_STATE,
      selectedGradientIndex: 0,
      accentColor: "#38bdf8",
      authorHandle: "@growthplaybook",
    },
  },
  {
    id: "clean-code",
    name: "Clean Code & Architecture",
    category: "Dev",
    badge: "Engineering",
    state: {
      format: "ig-portrait",
      slideCount: 5,
      bgType: "gradient",
      selectedGradientIndex: 3,
      customSolidColor: "#050505",
      bgImageUrl: null,
      bgImageOpacity: 0.4,
      authorHandle: "@cleancodedev",
      showSlideNumbers: true,
      showSwipeHint: true,
      swipeHintText: "Swipe for Rules →",
      textColor: "#ffffff",
      accentColor: "#22d3ee",
      slides: [
        {
          eyebrow: "01 / ARCHITECTURE",
          title: "5 Clean Code Rules You Should Never Break",
          body: "Write code that humans can understand and maintain years later. Here is the modern engineering playbook.",
          badge: "CODE GUIDE",
        },
        {
          eyebrow: "02 / RULE 1",
          title: "Rule 1: Single-Purpose Small Functions",
          body: "If a function needs more than 20 lines or handles two distinct concerns, split it immediately into atomic helpers.",
        },
        {
          eyebrow: "03 / RULE 2",
          title: "Rule 2: Kill Premature Abstraction",
          body: "Duplication is far cheaper than the wrong abstraction. Wait until the rule of three before generalizing components.",
        },
        {
          eyebrow: "04 / RULE 3",
          title: "Rule 3: Make Errors Impossible to Ignore",
          body: "Avoid silent try-catch blocks or null-coalescing away critical runtime failures. Fail fast and fail explicitly.",
          badge: "CRITICAL",
        },
        {
          eyebrow: "05 / SUMMARY",
          title: "Ship Cleaner Systems Today",
          body: "Bookmark this guide for your next pull request review and share it with your engineering team.",
          badge: "SHARE & SAVE",
        },
      ],
      floatingImages: [],
    },
  },
  {
    id: "indie-hacker",
    name: "0 to $10k MRR Playbook",
    category: "Startups",
    badge: "SaaS & Indie",
    state: {
      format: "ig-portrait",
      slideCount: 5,
      bgType: "gradient",
      selectedGradientIndex: 2,
      customSolidColor: "#022c22",
      bgImageUrl: null,
      bgImageOpacity: 0.4,
      authorHandle: "@indiebootstrapped",
      showSlideNumbers: true,
      showSwipeHint: true,
      swipeHintText: "Swipe for Roadmap →",
      textColor: "#ffffff",
      accentColor: "#34d399",
      slides: [
        {
          eyebrow: "01 / FOUNDER PLAYBOOK",
          title: "From $0 to $10,000 MRR in 6 Months",
          body: "The transparent roadmap of building and monetizing software products without venture capital.",
          badge: "ROADMAP",
        },
        {
          eyebrow: "02 / VALIDATION",
          title: "Phase 1: Pre-Sell Before Writing Code",
          body: "Interview 20 prospective buyers. If at least 5 will not pay upfront for a prototype, rethink your positioning.",
        },
        {
          eyebrow: "03 / TRACTION",
          title: "Phase 2: Own One Organic Channel",
          body: "Do not spread thin across six social networks. Master one high-intent flywheel until you achieve predictable growth.",
        },
        {
          eyebrow: "04 / PRICING",
          title: "Phase 3: Charge More Than You Think",
          body: "Low prices attract high churn and demanding clients. Value-based pricing attracts partners who respect your craftsmanship.",
          badge: "$10K MILESTONE",
        },
        {
          eyebrow: "05 / SUMMARY",
          title: "Your Turn to Build & Launch",
          body: "Save this blueprint for your next launch sprint and tag an indie founder building in public.",
          badge: "SAVE & BUILD",
        },
      ],
      floatingImages: [],
    },
  },
  {
    id: "morning-habits",
    name: "High-Performance Habits",
    category: "Mindset",
    badge: "Productivity",
    state: {
      format: "ig-portrait",
      slideCount: 5,
      bgType: "gradient",
      selectedGradientIndex: 1,
      customSolidColor: "#431407",
      bgImageUrl: null,
      bgImageOpacity: 0.4,
      authorHandle: "@peakperformers",
      showSlideNumbers: true,
      showSwipeHint: true,
      swipeHintText: "Swipe for Habits →",
      textColor: "#ffffff",
      accentColor: "#f97316",
      slides: [
        {
          eyebrow: "01 / PERFORMANCE",
          title: "5 Habits That Unlocked Deep Daily Focus",
          body: "How eliminating cognitive friction transformed creative output and permanently cured digital burnout.",
          badge: "MINDSET",
        },
        {
          eyebrow: "02 / HABIT 1",
          title: "No Screens for First 60 Mins",
          body: "Protect your morning dopamine before algorithmic notifications hijack your focus and attention span.",
        },
        {
          eyebrow: "03 / HABIT 2",
          title: "The 90-Minute Single Task Block",
          body: "Zero browser tabs, phone placed in another room. Complete your highest-leverage task before noon.",
        },
        {
          eyebrow: "04 / HABIT 3",
          title: "Strict High-Signal Information Diet",
          body: "Read foundational books, papers, and docs rather than reacting to transient rage-bait on social media feeds.",
          badge: "DEEP WORK",
        },
        {
          eyebrow: "05 / SUMMARY",
          title: "Reclaim Your Peak Focus Today",
          body: "Pick one habit to test starting tomorrow morning. Save this post for daily accountability.",
          badge: "SAVE & RECLAIM",
        },
      ],
      floatingImages: [],
    },
  },
  {
    id: "ui-ux-design",
    name: "UI/UX Rules for Developers",
    category: "Design",
    badge: "UI / UX",
    state: {
      format: "ig-portrait",
      slideCount: 5,
      bgType: "gradient",
      selectedGradientIndex: 6,
      customSolidColor: "#2e1065",
      bgImageUrl: null,
      bgImageOpacity: 0.4,
      authorHandle: "@uicraftsmanship",
      showSlideNumbers: true,
      showSwipeHint: true,
      swipeHintText: "Swipe for Rules →",
      textColor: "#ffffff",
      accentColor: "#c084fc",
      slides: [
        {
          eyebrow: "01 / DESIGN CRAFT",
          title: "UI/UX Fundamentals Every Developer Needs",
          body: "Transform raw functional prototypes into polished, delightful, world-class user interfaces.",
          badge: "DESIGN SYSTEM",
        },
        {
          eyebrow: "02 / SPACING",
          title: "Rule 1: Strict 8-Point Spacing Grid",
          body: "Never guess margins or paddings. Sticking strictly to multiples of 8 creates subconscious visual balance.",
        },
        {
          eyebrow: "03 / TYPOGRAPHY",
          title: "Rule 2: Limit to Two Type Sizes & Weights",
          body: "Visual hierarchy comes from contrast and font weight, not from sprinkling twelve arbitrary font sizes.",
        },
        {
          eyebrow: "04 / STATES",
          title: "Rule 3: Design Empty & Error States First",
          body: "A dependable app proves its quality when data is loading or network fails, not just when everything goes smoothly.",
          badge: "UX BEST PRACTICE",
        },
        {
          eyebrow: "05 / SUMMARY",
          title: "Level Up Your UI Today",
          body: "Save this cheatsheet for your next product design sprint and share it with your team.",
          badge: "SAVE & APPLY",
        },
      ],
      floatingImages: [],
    },
  },
];

/**
 * Loads an image URL into an HTMLImageElement safely.
 */
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(new Error("Failed to load image: " + src));
    img.src = src;
  });
}

/**
 * Renders the entire continuous panorama canvas containing all slides seamlessly.
 */
export async function renderFullPanoramaCanvas(
  state: CarouselState,
  scale: number = 1
): Promise<HTMLCanvasElement> {
  const dim = CAROUSEL_FORMATS[state.format];
  const slideWidth = dim.width * scale;
  const slideHeight = dim.height * scale;
  const totalWidth = slideWidth * state.slideCount;

  const canvas = document.createElement("canvas");
  canvas.width = totalWidth;
  canvas.height = slideHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get 2D canvas context");

  // 1. Render Seamless Continuous Background
  if (state.bgType === "gradient") {
    const gradDef = CAROUSEL_GRADIENTS[state.selectedGradientIndex] || CAROUSEL_GRADIENTS[0];
    const grad = ctx.createLinearGradient(0, 0, totalWidth, 0);
    grad.addColorStop(0, gradDef.from);
    if (gradDef.via) grad.addColorStop(0.5, gradDef.via);
    grad.addColorStop(1, gradDef.to);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, totalWidth, slideHeight);
  } else if (state.bgType === "solid") {
    ctx.fillStyle = state.customSolidColor;
    ctx.fillRect(0, 0, totalWidth, slideHeight);
  } else if (state.bgType === "mesh") {
    // Render soft ambient mesh gradient across the full width
    ctx.fillStyle = "#09090b";
    ctx.fillRect(0, 0, totalWidth, slideHeight);

    const colors = ["#4f46e5", "#06b6d4", "#ec4899", "#8b5cf6", "#10b981"];
    for (let i = 0; i < state.slideCount; i++) {
      const cx = (i + 0.5) * slideWidth;
      const cy = (i % 2 === 0 ? 0.3 : 0.7) * slideHeight;
      const color = colors[i % colors.length];
      const radGrad = ctx.createRadialGradient(cx, cy, 50 * scale, cx, cy, slideWidth * 0.8);
      radGrad.addColorStop(0, color + "66");
      radGrad.addColorStop(1, "transparent");
      ctx.fillStyle = radGrad;
      ctx.fillRect(0, 0, totalWidth, slideHeight);
    }
  }

  // Optional background image overlay
  if (state.bgImageUrl) {
    try {
      const bgImg = await loadImage(state.bgImageUrl);
      ctx.save();
      ctx.globalAlpha = Math.max(0.05, Math.min(1, state.bgImageOpacity));
      // Draw cover across full panorama
      const hRatio = totalWidth / bgImg.width;
      const vRatio = slideHeight / bgImg.height;
      const coverRatio = Math.max(hRatio, vRatio);
      const drawW = bgImg.width * coverRatio;
      const drawH = bgImg.height * coverRatio;
      const drawX = (totalWidth - drawW) / 2;
      const drawY = (slideHeight - drawH) / 2;
      ctx.drawImage(bgImg, drawX, drawY, drawW, drawH);
      ctx.restore();
    } catch {
      // Ignore background image load errors gracefully
    }
  }

  // 2. Render Floating Images (Seamless panorama items crossing seams)
  for (const item of state.floatingImages) {
    try {
      const img = await loadImage(item.src);
      ctx.save();
      const x = (item.xPercent / 100) * totalWidth;
      const y = (item.yPercent / 100) * slideHeight;
      const scaleFactor = (item.scalePercent / 100) * scale;
      const w = img.width * scaleFactor;
      const h = img.height * scaleFactor;

      ctx.translate(x, y);
      if (item.rotation !== 0) {
        ctx.rotate((item.rotation * Math.PI) / 180);
      }
      ctx.globalAlpha = item.opacity;

      if (item.shadow) {
        ctx.shadowColor = "rgba(0, 0, 0, 0.45)";
        ctx.shadowBlur = 30 * scale;
        ctx.shadowOffsetY = 15 * scale;
      }

      if (item.borderRadius > 0) {
        const r = item.borderRadius * scale;
        ctx.beginPath();
        ctx.roundRect(-w / 2, -h / 2, w, h, r);
        ctx.clip();
      }

      ctx.drawImage(img, -w / 2, -h / 2, w, h);
      ctx.restore();
    } catch {
      // Ignore individual image load failure
    }
  }

  // 3. Render Per-Slide Text and Metadata
  for (let i = 0; i < state.slideCount; i++) {
    const slide = state.slides[i] || {
      eyebrow: `SLIDE 0${i + 1}`,
      title: `Slide ${i + 1} Content`,
      body: "Add your key insights or bullet points here.",
    };
    const slideOffset = i * slideWidth;

    ctx.save();
    ctx.translate(slideOffset, 0);

    // Padding inside slide
    const padX = 80 * scale;
    const padTop = 100 * scale;
    const maxContentWidth = slideWidth - padX * 2;

    // Eyebrow / Category
    if (slide.eyebrow) {
      ctx.font = `700 ${18 * scale}px system-ui, -apple-system, sans-serif`;
      ctx.fillStyle = state.accentColor;
      ctx.letterSpacing = `${2 * scale}px`;
      ctx.fillText(slide.eyebrow.toUpperCase(), padX, padTop);
    }

    // Badge if present
    if (slide.badge) {
      ctx.font = `700 ${14 * scale}px system-ui, -apple-system, sans-serif`;
      const badgeText = slide.badge.toUpperCase();
      const badgeMetrics = ctx.measureText(badgeText);
      const bPadX = 14 * scale;
      const bPadY = 8 * scale;
      const bWidth = badgeMetrics.width + bPadX * 2;
      const bHeight = 28 * scale;
      const bX = slideWidth - padX - bWidth;
      const bY = padTop - 20 * scale;

      ctx.fillStyle = state.accentColor + "22";
      ctx.strokeStyle = state.accentColor;
      ctx.lineWidth = 1.5 * scale;
      ctx.beginPath();
      ctx.roundRect(bX, bY, bWidth, bHeight, 14 * scale);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = state.accentColor;
      ctx.fillText(badgeText, bX + bPadX, bY + bHeight - bPadY - 2 * scale);
    }

    // Headline
    ctx.fillStyle = state.textColor;
    ctx.font = `800 ${52 * scale}px system-ui, -apple-system, sans-serif`;
    ctx.textBaseline = "top";
    let curY = padTop + 45 * scale;

    const titleWords = slide.title.split(" ");
    let line = "";
    const titleLineHeight = 64 * scale;

    for (let wIdx = 0; wIdx < titleWords.length; wIdx++) {
      const testLine = line + titleWords[wIdx] + " ";
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxContentWidth && wIdx > 0) {
        ctx.fillText(line.trim(), padX, curY);
        line = titleWords[wIdx] + " ";
        curY += titleLineHeight;
      } else {
        line = testLine;
      }
    }
    if (line.trim().length > 0) {
      ctx.fillText(line.trim(), padX, curY);
      curY += titleLineHeight + 25 * scale;
    }

    // Body Text
    if (slide.body) {
      ctx.font = `400 ${28 * scale}px system-ui, -apple-system, sans-serif`;
      ctx.fillStyle = state.textColor + "cc"; // slightly softened body text
      const bodyWords = slide.body.split(" ");
      let bodyLine = "";
      const bodyLineHeight = 42 * scale;

      for (let bIdx = 0; bIdx < bodyWords.length; bIdx++) {
        const testBLine = bodyLine + bodyWords[bIdx] + " ";
        const metrics = ctx.measureText(testBLine);
        if (metrics.width > maxContentWidth && bIdx > 0) {
          ctx.fillText(bodyLine.trim(), padX, curY);
          bodyLine = bodyWords[bIdx] + " ";
          curY += bodyLineHeight;
        } else {
          bodyLine = testBLine;
        }
      }
      if (bodyLine.trim().length > 0) {
        ctx.fillText(bodyLine.trim(), padX, curY);
      }
    }

    // Footer - Author Handle
    const footerY = slideHeight - 75 * scale;
    ctx.textBaseline = "middle";
    if (state.authorHandle) {
      ctx.font = `600 ${20 * scale}px system-ui, -apple-system, sans-serif`;
      ctx.fillStyle = state.textColor + "99";
      ctx.fillText(state.authorHandle, padX, footerY);
    }

    // Footer - Slide Counter (e.g., "1 / 5")
    if (state.showSlideNumbers) {
      ctx.font = `600 ${18 * scale}px monospace, system-ui, sans-serif`;
      ctx.fillStyle = state.textColor + "77";
      const counterText = `${i + 1} / ${state.slideCount}`;
      const cMetrics = ctx.measureText(counterText);
      const cX = (slideWidth - cMetrics.width) / 2;
      ctx.fillText(counterText, cX, footerY);
    }

    // Footer - Swipe Hint (only on non-final slides)
    if (state.showSwipeHint && i < state.slideCount - 1) {
      ctx.font = `700 ${18 * scale}px system-ui, -apple-system, sans-serif`;
      ctx.fillStyle = state.accentColor;
      const hintText = state.swipeHintText;
      const hMetrics = ctx.measureText(hintText);
      ctx.fillText(hintText, slideWidth - padX - hMetrics.width, footerY);
    }

    ctx.restore();
  }

  return canvas;
}

export interface SlicedSlide {
  index: number;
  filename: string;
  blob: Blob;
  dataUrl: string;
}

/**
 * Slices the full panorama into individual high-res slide images.
 */
export async function slicePanorama(state: CarouselState): Promise<SlicedSlide[]> {
  const fullCanvas = await renderFullPanoramaCanvas(state, 1.0);
  const dim = CAROUSEL_FORMATS[state.format];
  const slideWidth = dim.width;
  const slideHeight = dim.height;

  const slides: SlicedSlide[] = [];

  for (let i = 0; i < state.slideCount; i++) {
    const slideCanvas = document.createElement("canvas");
    slideCanvas.width = slideWidth;
    slideCanvas.height = slideHeight;
    const sCtx = slideCanvas.getContext("2d");
    if (!sCtx) continue;

    // Crop slice from full canvas
    sCtx.drawImage(
      fullCanvas,
      i * slideWidth,
      0,
      slideWidth,
      slideHeight,
      0,
      0,
      slideWidth,
      slideHeight
    );

    const blob = await new Promise<Blob>((resolve, reject) => {
      slideCanvas.toBlob((b) => {
        if (b) resolve(b);
        else reject(new Error("Slide slice failed"));
      }, "image/png");
    });

    const dataUrl = slideCanvas.toDataURL("image/png");
    const num = String(i + 1).padStart(2, "0");
    const filename = `carousel_slide_${num}.png`;

    slides.push({
      index: i + 1,
      filename,
      blob,
      dataUrl,
    });
  }

  return slides;
}

/**
 * Creates a ZIP archive containing all individual sliced slides.
 */
export async function downloadCarouselZip(slides: SlicedSlide[], baseName = "carousel"): Promise<Blob> {
  const zipEntries = slides.map((s) => ({
    name: s.filename,
    blob: s.blob,
  }));
  return createZip(zipEntries);
}

/**
 * Generates a clean multi-page PDF document for LinkedIn carousels.
 * Encodes each slide as a full-page JPEG/PNG inside a standard PDF 1.4 stream.
 */
export async function generateCarouselPdf(slides: SlicedSlide[], state: CarouselState): Promise<Blob> {
  const dim = CAROUSEL_FORMATS[state.format];
  // Standard PDF 72 DPI points: page size in points (e.g. 1080x1350 px -> 432 x 540 pt)
  const ptWidth = Math.round((dim.width / 1080) * 432);
  const ptHeight = Math.round((dim.height / 1080) * 432);

  // We can render each slide as a JPEG image and embed into standard PDF objects
  const slideImages: { bytes: Uint8Array; width: number; height: number }[] = [];

  for (const slide of slides) {
    const imgData = await slide.blob.arrayBuffer();
    slideImages.push({
      bytes: new Uint8Array(imgData),
      width: dim.width,
      height: dim.height,
    });
  }

  // Build standard PDF structure with objects
  const objects: string[] = [];
  const addObject = (body: string) => {
    objects.push(body);
    return objects.length; // 1-based object number
  };

  // Object 1: Catalog
  // Will reference Pages root (Object 2)
  const catalogObjIndex = addObject(""); // placeholder for Obj 1
  const pagesObjIndex = addObject(""); // placeholder for Obj 2

  const pageObjectIndices: number[] = [];

  for (let i = 0; i < slideImages.length; i++) {
    const imgObjIndex = addObject(
      `<< /Type /XObject /Subtype /Image /Width ${dim.width} /Height ${dim.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /Length ${slideImages[i].bytes.length} >>\nstream\n` +
        // We will output binary streams
        "BINARY_STREAM_" +
        i +
        "\nendstream"
    );

    const contentStream = `q\n${ptWidth} 0 0 ${ptHeight} 0 0 cm\n/Im${i + 1} Do\nQ`;
    const contentObjIndex = addObject(
      `<< /Length ${contentStream.length} >>\nstream\n${contentStream}\nendstream`
    );

    const pageObjIndex = addObject(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${ptWidth} ${ptHeight}] /Contents ${contentObjIndex} 0 R /Resources << /XObject << /Im${i + 1} ${imgObjIndex} 0 R >> >> >>`
    );
    pageObjectIndices.push(pageObjIndex);
  }

  // Now assemble full PDF document
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];

  const writeObj = (index: number, content: string) => {
    offsets[index] = pdf.length;
    pdf += `${index} 0 obj\n${content}\nendobj\n`;
  };

  // 1 Catalog
  writeObj(1, `<< /Type /Catalog /Pages 2 0 R >>`);

  // 2 Pages root
  const kidsStr = pageObjectIndices.map((idx) => `${idx} 0 R`).join(" ");
  writeObj(2, `<< /Type /Pages /Kids [${kidsStr}] /Count ${pageObjectIndices.length} >>`);

  // Simple direct SVG-based / Canvas-based alternative or fallback if binary FlateDecode is complicated:
  // Instead of manual binary PDF assembly that requires Flate stream compression of raw pixels,
  // let's use an HTML-to-print or canvas drawImage method, OR assemble a standard JPEG-based PDF (/Filter /DCTDecode)!
  // DCTDecode (JPEG) requires ZERO compression implementation because the blob is already valid JPEG!
  // Let's create high-quality JPEG blobs for each slide:
  return createDctPdf(slides, ptWidth, ptHeight, dim.width, dim.height);
}

/**
 * Creates a valid multi-page PDF using /DCTDecode (JPEG) streams.
 * Native, 100% standards-compliant PDF 1.4 without third-party dependencies.
 */
async function createDctPdf(
  slides: SlicedSlide[],
  ptWidth: number,
  ptHeight: number,
  pxWidth: number,
  pxHeight: number
): Promise<Blob> {
  // Convert each slide to a JPEG Uint8Array
  const jpegBuffers: Uint8Array[] = [];

  for (const s of slides) {
    const img = await loadImage(s.dataUrl);
    const canvas = document.createElement("canvas");
    canvas.width = pxWidth;
    canvas.height = pxHeight;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(img, 0, 0);
      const jpegBlob = await new Promise<Blob>((resolve) =>
        canvas.toBlob((b) => resolve(b || s.blob), "image/jpeg", 0.95)
      );
      const buf = await jpegBlob.arrayBuffer();
      jpegBuffers.push(new Uint8Array(buf));
    }
  }

  const parts: (string | Uint8Array)[] = [];
  let currentOffset = 0;
  const offsets: number[] = [];

  function append(data: string | Uint8Array) {
    parts.push(data);
    if (typeof data === "string") {
      currentOffset += new TextEncoder().encode(data).length;
    } else {
      currentOffset += data.byteLength;
    }
  }

  append("%PDF-1.4\n%\xFF\xFF\xFF\xFF\n");

  const pageObjCount = slides.length;
  // Obj 1: Catalog
  // Obj 2: Pages
  // Then for each page:
  //   Obj (3 + 3*i): Page
  //   Obj (4 + 3*i): Contents
  //   Obj (5 + 3*i): XObject Image

  const pageIds: number[] = [];
  for (let i = 0; i < pageObjCount; i++) {
    pageIds.push(3 + i * 3);
  }

  // Obj 1: Catalog
  offsets[1] = currentOffset;
  append(`1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`);

  // Obj 2: Pages
  offsets[2] = currentOffset;
  append(
    `2 0 obj\n<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageObjCount} >>\nendobj\n`
  );

  for (let i = 0; i < pageObjCount; i++) {
    const pageId = 3 + i * 3;
    const contentsId = 4 + i * 3;
    const imageId = 5 + i * 3;
    const jpegData = jpegBuffers[i];

    // Page Obj
    offsets[pageId] = currentOffset;
    append(
      `${pageId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${ptWidth} ${ptHeight}] /Contents ${contentsId} 0 R /Resources << /XObject << /Im1 ${imageId} 0 R >> >> >>\nendobj\n`
    );

    // Contents Obj
    const streamContent = `q\n${ptWidth} 0 0 ${ptHeight} 0 0 cm\n/Im1 Do\nQ\n`;
    offsets[contentsId] = currentOffset;
    append(
      `${contentsId} 0 obj\n<< /Length ${streamContent.length} >>\nstream\n${streamContent}endstream\nendobj\n`
    );

    // Image XObject with /Filter /DCTDecode
    offsets[imageId] = currentOffset;
    append(
      `${imageId} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${pxWidth} /Height ${pxHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegData.byteLength} >>\nstream\n`
    );
    append(jpegData);
    append(`\nendstream\nendobj\n`);
  }

  // xref table
  const startXref = currentOffset;
  const totalObjs = 1 + pageObjCount * 3 + 2;
  append(`xref\n0 ${totalObjs}\n`);
  append(`0000000000 65535 f \n`);
  for (let i = 1; i <= 2 + pageObjCount * 3; i++) {
    const offsetStr = String(offsets[i] || 0).padStart(10, "0");
    append(`${offsetStr} 00000 n \n`);
  }

  append(`trailer\n<< /Size ${totalObjs} /Root 1 0 R >>\nstartxref\n${startXref}\n%%EOF\n`);

  return new Blob(parts as BlobPart[], { type: "application/pdf" });
}

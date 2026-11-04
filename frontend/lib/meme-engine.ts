/**
 * AI Animated GIF & Viral Meme Studio Engine
 *
 * Provides:
 * 1. AI Viral Meme Caption & Punchline Generator across tech, work, crypto, and lifestyle
 * 2. Classic Impact Bold Meme & Modern Social Card rendering styles
 * 3. High-resolution canvas snapshot export
 */

export type MemeStyle = "classic-impact" | "modern-card" | "breaking-news" | "retro-vhs";

export interface MemeTemplate {
  id: string;
  name: string;
  topDefault: string;
  bottomDefault: string;
  imageUrl: string;
}

export interface AiMemeSuggestion {
  category: "tech" | "work" | "crypto" | "life";
  topText: string;
  bottomText: string;
}

export const AI_MEME_SUGGESTIONS: AiMemeSuggestion[] = [
  // Tech & Coding
  {
    category: "tech",
    topText: "IT WORKED ON MY LOCAL MACHINE",
    bottomText: "PRODUCTION SERVER IS CURRENTLY ON FIRE",
  },
  {
    category: "tech",
    topText: "ONE DOES NOT SIMPLY",
    bottomText: "PUSH TO MAIN ON A FRIDAY AT 5 PM",
  },
  {
    category: "tech",
    topText: "99 LITTLE BUGS IN THE CODE",
    bottomText: "FIX ONE BUG, 127 BUGS IN THE CODE",
  },
  {
    category: "tech",
    topText: "A PROGRAMMER WILL SPEND 3 DAYS",
    bottomText: "AUTOMATING A TASK THAT TAKES 5 MINUTES",
  },
  {
    category: "tech",
    topText: "GIT COMMIT -M 'MINOR FIX'",
    bottomText: "7,842 FILES CHANGED (+18,290 -9,431)",
  },
  // Work & Remote
  {
    category: "work",
    topText: "SURVIVED ANOTHER MEETING",
    bottomText: "THAT DEFINITELY COULD HAVE BEEN AN EMAIL",
  },
  {
    category: "work",
    topText: "PRETENDING TO BE TYPING FAST",
    bottomText: "WHEN THE BOSS WALKS BY MY SCREEN",
  },
  {
    category: "work",
    topText: "JOINING THE CALL ON MUTE",
    bottomText: "EATING FULL MEAL IN BACKGROUND",
  },
  {
    category: "work",
    topText: "HR: WE ARE LIKE A FAMILY HERE",
    bottomText: "EMPLOYEES: RUN.",
  },
  // Crypto & Finance
  {
    category: "crypto",
    topText: "BOUGHT THE DIP",
    bottomText: "THE DIP KEPT DIPPING",
  },
  {
    category: "crypto",
    topText: "CHECKING MY PORTFOLIO EVERY 4 MINUTES",
    bottomText: "STILL DOWN 82% FROM ALL TIME HIGH",
  },
  // Everyday Life
  {
    category: "life",
    topText: "JUST GOING TO WATCH ONE EPISODE",
    bottomText: "IT IS NOW 4:30 AM AND I HAVE WORK",
  },
  {
    category: "life",
    topText: "I WILL GO TO SLEEP EARLY TONIGHT",
    bottomText: "RESEARCHING RANDOM WIKIPEDIA AT 3 AM",
  },
  {
    category: "life",
    topText: "ME TRYING TO CANCEL A FREE TRIAL",
    bottomText: "BEFORE THEY CHARGE MY CREDIT CARD",
  },
];

export const POPULAR_TEMPLATES: MemeTemplate[] = [
  {
    id: "distracted-bf",
    name: "Distracted Boyfriend",
    topDefault: "ME STARTING A NEW SIDE PROJECT",
    bottomDefault: "MY 5 UNFINISHED SIDE PROJECTS",
    imageUrl: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800&auto=format&fit=crop&q=80",
  },
  {
    id: "success-kid",
    name: "Success Kid",
    topDefault: "FIXED THE BUG",
    bottomDefault: "ON THE VERY FIRST TRY",
    imageUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&auto=format&fit=crop&q=80",
  },
  {
    id: "coding-cat",
    name: "Hacker / Coding Cat",
    topDefault: "WHEN THE CODE COMPILES",
    bottomDefault: "WITH ZERO WARNINGS",
    imageUrl: "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=800&auto=format&fit=crop&q=80",
  },
  {
    id: "drake-approve",
    name: "Drake Reaction",
    topDefault: "READING OFFICIAL DOCUMENTATION",
    bottomDefault: "COPY-PASTING FROM STACK OVERFLOW",
    imageUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&auto=format&fit=crop&q=80",
  },
  {
    id: "two-buttons",
    name: "Daily Struggle",
    topDefault: "FIX EXISTING PRODUCTION BUG",
    bottomDefault: "REWRITE THE WHOLE SYSTEM IN RUST",
    imageUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=800&auto=format&fit=crop&q=80",
  },
  {
    id: "doge-cheems",
    name: "Buff Doge vs Cheems",
    topDefault: "C CODERS IN 1985 (128 KB RAM)",
    bottomDefault: "ME WAITING 4 MINUTES FOR NPM INSTALL",
    imageUrl: "https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?w=800&auto=format&fit=crop&q=80",
  },
];

/**
 * Render meme text on canvas with classic Impact font and black outline
 */
export function drawMemeCanvas(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  img: HTMLImageElement | null,
  topText: string,
  bottomText: string,
  style: MemeStyle = "classic-impact",
  fontSizePercent = 8
) {
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  if (style === "modern-card") {
    // Modern Twitter/Reddit card format: white top header with dark text, image below
    const headerHeight = height * 0.22;

    // Header Background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, headerHeight);

    // Header Text
    ctx.fillStyle = "#0f172a";
    ctx.font = `bold ${Math.round(headerHeight * 0.35)}px system-ui, -apple-system, sans-serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    const headerCaption = `${topText} ${bottomText}`.trim();
    ctx.fillText(headerCaption || "When everything works out...", 24, headerHeight / 2);

    // Draw Image in lower section
    if (img) {
      ctx.drawImage(img, 0, headerHeight, width, height - headerHeight);
    }
    return;
  }

  if (style === "breaking-news") {
    if (img) {
      ctx.drawImage(img, 0, 0, width, height);
    } else {
      ctx.fillStyle = "#1e293b";
      ctx.fillRect(0, 0, width, height);
    }

    const bannerH = height * 0.18;
    const bannerY = height - bannerH;

    // Red Live header
    ctx.fillStyle = "#dc2626";
    ctx.fillRect(0, bannerY, width, bannerH * 0.42);
    ctx.fillStyle = "#ffffff";
    ctx.font = `bold ${Math.round(bannerH * 0.26)}px sans-serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText("🔴 BREAKING NEWS", 20, bannerY + bannerH * 0.21);

    // Black headline ticker
    ctx.fillStyle = "rgba(15, 23, 42, 0.92)";
    ctx.fillRect(0, bannerY + bannerH * 0.42, width, bannerH * 0.58);
    ctx.fillStyle = "#fbbf24";
    ctx.font = `bold ${Math.round(bannerH * 0.28)}px sans-serif`;
    const headline = `${topText} — ${bottomText}`.trim();
    ctx.fillText(headline || "LIVE SATELLITE UPDATE", 20, bannerY + bannerH * 0.71);
    return;
  }

  if (style === "retro-vhs") {
    const barH = height * 0.12;
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, width, height);

    if (img) {
      ctx.drawImage(img, 0, barH, width, height - barH * 2);
    }

    const fontSize = Math.max(18, Math.round((height * fontSizePercent) / 100));
    ctx.font = `bold ${fontSize}px "Courier New", monospace, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const sub = `${topText} ${bottomText}`.trim();
    // Shadow
    ctx.fillStyle = "#000000";
    ctx.fillText(sub, width / 2 + 2, height - barH / 2 + 2);
    // Yellow text
    ctx.fillStyle = "#facc15";
    ctx.fillText(sub, width / 2, height - barH / 2);
    return;
  }

  // Classic Impact Meme Style
  if (img) {
    ctx.drawImage(img, 0, 0, width, height);
  } else {
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(0, 0, width, height);
  }

  const fontSize = Math.max(20, Math.round((height * fontSizePercent) / 100));
  ctx.font = `900 ${fontSize}px Impact, "Arial Black", sans-serif`;
  ctx.textAlign = "center";

  const strokeWidth = Math.max(3, Math.round(fontSize * 0.16));
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = strokeWidth;
  ctx.lineJoin = "round";
  ctx.fillStyle = "#ffffff";

  // Draw Top Text
  if (topText.trim()) {
    ctx.textBaseline = "top";
    const topY = height * 0.05;
    ctx.strokeText(topText.toUpperCase(), width / 2, topY);
    ctx.fillText(topText.toUpperCase(), width / 2, topY);
  }

  // Draw Bottom Text
  if (bottomText.trim()) {
    ctx.textBaseline = "bottom";
    const bottomY = height * 0.95;
    ctx.strokeText(bottomText.toUpperCase(), width / 2, bottomY);
    ctx.fillText(bottomText.toUpperCase(), width / 2, bottomY);
  }
}

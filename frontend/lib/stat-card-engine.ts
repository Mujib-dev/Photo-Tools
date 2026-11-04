/**
 * Social Quote & Stat Card Maker Engine
 *
 * Renders viral social quote, metric, and testimonial cards for LinkedIn, Twitter, and Instagram.
 */

export type StatCardAspect = "1:1" | "16:9" | "4:5";
export type StatCardTheme =
  | "dark-gradient"
  | "cyber-neon"
  | "minimal-white"
  | "sunset-warm"
  | "emerald-growth"
  | "amethyst-royal"
  | "nordic-slate"
  | "crimson-velocity";

export interface StatCardConfig {
  authorName: string;
  authorHandle: string;
  quoteText: string;
  statMetric?: string;
  statLabel?: string;
  hasVerifiedBadge: boolean;
  aspect: StatCardAspect;
  theme: StatCardTheme;
}

export const STAT_CARD_THEMES: Array<{
  id: StatCardTheme;
  name: string;
  preview: string;
}> = [
  { id: "dark-gradient", name: "Midnight Navy", preview: "linear-gradient(135deg, #0f172a, #020617)" },
  { id: "cyber-neon", name: "Cyber Neon", preview: "linear-gradient(135deg, #1e1b4b, #311042)" },
  { id: "minimal-white", name: "Studio Light", preview: "linear-gradient(135deg, #ffffff, #f1f5f9)" },
  { id: "sunset-warm", name: "Sunset Terracotta", preview: "linear-gradient(135deg, #7c2d12, #431407)" },
  { id: "emerald-growth", name: "Emerald SaaS", preview: "linear-gradient(135deg, #064e3b, #022c22)" },
  { id: "amethyst-royal", name: "Amethyst Royal", preview: "linear-gradient(135deg, #3b0764, #1e1b4b)" },
  { id: "nordic-slate", name: "Nordic Slate", preview: "linear-gradient(135deg, #1e293b, #0f172a)" },
  { id: "crimson-velocity", name: "Crimson Velocity", preview: "linear-gradient(135deg, #881337, #4c0519)" },
];

export interface StatCardTemplate {
  id: string;
  name: string;
  tag: string;
  config: Partial<StatCardConfig>;
}

export const STAT_CARD_TEMPLATES: StatCardTemplate[] = [
  {
    id: "saas-mrr",
    name: "SaaS MRR Milestone",
    tag: "Founder",
    config: {
      authorName: "Sarah Chen",
      authorHandle: "@sarahbuilds • Bootstrapped Founder",
      quoteText: "We just crossed $50,000 MRR with 0 VC funding. The biggest lesson? Build features your top 10 power users scream for.",
      statMetric: "$50K MRR",
      statLabel: "Monthly Recurring Revenue",
      theme: "emerald-growth",
      hasVerifiedBadge: true,
    },
  },
  {
    id: "engineering-wisdom",
    name: "Engineering Wisdom",
    tag: "Tech",
    config: {
      authorName: "Dan Abramov",
      authorHandle: "@dan_abramov • Software Engineer",
      quoteText: "Premature optimization is the root of all evil, but premature abstraction is what actually kills developer velocity 2 years later.",
      statMetric: "99.99%",
      statLabel: "System Reliability Maintained",
      theme: "dark-gradient",
      hasVerifiedBadge: true,
    },
  },
  {
    id: "github-milestone",
    name: "Open Source Launch",
    tag: "Dev",
    config: {
      authorName: "Core Maintainers",
      authorHandle: "@core_maintainers • GitHub",
      quoteText: "10,000 GitHub stars in our first month. Thank you to the open source community for trusting and contributing to our vision.",
      statMetric: "10,000+",
      statLabel: "GitHub Stars & 450 PRs",
      theme: "amethyst-royal",
      hasVerifiedBadge: true,
    },
  },
  {
    id: "customer-review",
    name: "Customer Testimonial",
    tag: "Review",
    config: {
      authorName: "Elena Rostova",
      authorHandle: "@elena_design • Head of Creative",
      quoteText: "This tool replaced 4 separate subscription apps and cut our creative team's production time in half. Absolute game changer.",
      statMetric: "5.0 ★",
      statLabel: "Verified Enterprise Review",
      theme: "sunset-warm",
      hasVerifiedBadge: true,
    },
  },
  {
    id: "habit-streak",
    name: "Discipline & Fitness",
    tag: "Mindset",
    config: {
      authorName: "Marcus Vance",
      authorHandle: "@marcusvance • Endurance Athlete",
      quoteText: "Day 365 of consistent morning training. Discipline will always take you places where fleeting motivation can never reach.",
      statMetric: "365",
      statLabel: "Consecutive Days Active",
      theme: "crimson-velocity",
      hasVerifiedBadge: true,
    },
  },
  {
    id: "solopreneur-insight",
    name: "Indie Hacker Insight",
    tag: "Solopreneur",
    config: {
      authorName: "Pieter Levels",
      authorHandle: "@levelsio • Indie Hacker",
      quoteText: "You don't need a 50-person office to build a multimillion-dollar business anymore. You need high-leverage tools and relentless execution.",
      statMetric: "1 Person",
      statLabel: "Global Customer Base",
      theme: "nordic-slate",
      hasVerifiedBadge: true,
    },
  },
];

export const DEFAULT_STAT_CARD: StatCardConfig = {
  authorName: "Alex Rivera",
  authorHandle: "@alexrivera • Founder",
  quoteText: "The fastest way to build a great product is to iterate in public and talk to real users every single day.",
  statMetric: "10x",
  statLabel: "Faster Iteration Cycles",
  hasVerifiedBadge: true,
  aspect: "1:1",
  theme: "dark-gradient",
};

/**
 * Render complete social stat card onto canvas
 */
export function drawStatCard(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  config: StatCardConfig,
  avatarImg: HTMLImageElement | null
) {
  // 1. Draw Background
  let accentColor = "#38bdf8";

  if (config.theme === "minimal-white") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    accentColor = "#2563eb";
  } else {
    const grad = ctx.createLinearGradient(0, 0, width, height);
    if (config.theme === "cyber-neon") {
      grad.addColorStop(0, "#1e1b4b");
      grad.addColorStop(0.5, "#311042");
      grad.addColorStop(1, "#09090b");
      accentColor = "#22d3ee";
    } else if (config.theme === "sunset-warm") {
      grad.addColorStop(0, "#7c2d12");
      grad.addColorStop(0.5, "#431407");
      grad.addColorStop(1, "#09090b");
      accentColor = "#fb923c";
    } else if (config.theme === "emerald-growth") {
      grad.addColorStop(0, "#064e3b");
      grad.addColorStop(0.5, "#022c22");
      grad.addColorStop(1, "#041f18");
      accentColor = "#34d399";
    } else if (config.theme === "amethyst-royal") {
      grad.addColorStop(0, "#3b0764");
      grad.addColorStop(0.5, "#1e1b4b");
      grad.addColorStop(1, "#0a0414");
      accentColor = "#c084fc";
    } else if (config.theme === "nordic-slate") {
      grad.addColorStop(0, "#1e293b");
      grad.addColorStop(0.5, "#0f172a");
      grad.addColorStop(1, "#020617");
      accentColor = "#38bdf8";
    } else if (config.theme === "crimson-velocity") {
      grad.addColorStop(0, "#881337");
      grad.addColorStop(0.5, "#4c0519");
      grad.addColorStop(1, "#120207");
      accentColor = "#fb7185";
    } else {
      // dark-gradient
      grad.addColorStop(0, "#0f172a");
      grad.addColorStop(0.5, "#090d16");
      grad.addColorStop(1, "#020617");
      accentColor = "#38bdf8";
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  }

  const isLight = config.theme === "minimal-white";
  const primaryText = isLight ? "#0f172a" : "#ffffff";
  const subText = isLight ? "#64748b" : "#94a3b8";

  // Card Inner Border
  ctx.save();
  ctx.strokeStyle = isLight ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.08)";
  ctx.lineWidth = 2;
  ctx.strokeRect(40, 40, width - 80, height - 80);
  ctx.restore();

  // 2. Author Header
  const headerX = 90;
  const headerY = 90;
  const avatarSize = 72;

  ctx.save();
  ctx.beginPath();
  ctx.arc(headerX + avatarSize / 2, headerY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
  ctx.clip();

  if (avatarImg) {
    ctx.drawImage(avatarImg, headerX, headerY, avatarSize, avatarSize);
  } else {
    // Default Avatar Gradient
    const avGrad = ctx.createLinearGradient(headerX, headerY, headerX + avatarSize, headerY + avatarSize);
    avGrad.addColorStop(0, "#38bdf8");
    avGrad.addColorStop(1, "#818cf8");
    ctx.fillStyle = avGrad;
    ctx.fillRect(headerX, headerY, avatarSize, avatarSize);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 28px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(config.authorName.charAt(0) || "U", headerX + avatarSize / 2, headerY + avatarSize / 2);
  }
  ctx.restore();

  // Author Name & Verified Badge
  ctx.fillStyle = primaryText;
  ctx.font = "bold 24px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  const nameX = headerX + avatarSize + 20;
  ctx.fillText(config.authorName, nameX, headerY + 12);

  if (config.hasVerifiedBadge) {
    const nameWidth = ctx.measureText(config.authorName).width;
    const badgeX = nameX + nameWidth + 8;
    const badgeY = headerY + 16;
    // Blue check badge
    ctx.fillStyle = "#38bdf8";
    ctx.beginPath();
    ctx.arc(badgeX + 8, badgeY + 8, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 12px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("✓", badgeX + 8, badgeY + 12);
  }

  // Handle
  ctx.fillStyle = subText;
  ctx.font = "16px system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(config.authorHandle, nameX, headerY + 44);

  // 3. Big Quotation Mark Icon
  ctx.fillStyle = isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.06)";
  ctx.font = "bold 160px serif";
  ctx.fillText("“", headerX, headerY + 160);

  // 4. Quote Body Text (Wrapped lines)
  ctx.fillStyle = primaryText;
  const quoteFontSize = width > 1000 ? 32 : 26;
  ctx.font = `500 ${quoteFontSize}px "Segoe UI", system-ui, -apple-system, sans-serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";

  const quoteX = headerX;
  const quoteY = headerY + 140;
  const maxW = width - 180;
  const lineHeight = quoteFontSize * 1.5;

  const words = config.quoteText.split(" ");
  let line = "";
  let currentY = quoteY;

  for (const word of words) {
    const testLine = line + word + " ";
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxW && line !== "") {
      ctx.fillText(line, quoteX, currentY);
      line = word + " ";
      currentY += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, quoteX, currentY);

  // 5. Stat Metric Callout if present
  if (config.statMetric?.trim()) {
    const metricY = height - 160;
    ctx.fillStyle = accentColor;
    ctx.font = "black 56px system-ui, Impact, sans-serif";
    ctx.fillText(config.statMetric, headerX, metricY);

    if (config.statLabel?.trim()) {
      ctx.fillStyle = subText;
      ctx.font = "bold 16px system-ui, sans-serif";
      ctx.fillText(config.statLabel.toUpperCase(), headerX, metricY + 65);
    }
  }
}

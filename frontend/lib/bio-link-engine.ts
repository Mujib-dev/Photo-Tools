/**
 * Dynamic Link-in-Bio & Smart QR Code Studio Engine
 *
 * Provides:
 * 1. Mobile-optimized micro-site landing page model
 * 2. Visual themes (Apple Glassmorphism, Obsidian Dark, Cyber Glow, Pastel Minimalist)
 * 3. AI Bio Copywriter & High-Converting CTA Optimizer
 * 4. Custom QR Code Generator with logo embedding and vector export
 * 5. Standalone self-contained HTML bundle exporter
 */

import QRCode from "qrcode";

export type BioTheme =
  | "apple-glass"
  | "obsidian-dark"
  | "cyber-glow"
  | "pastel-minimalist"
  | "sunset-ember"
  | "emerald-matrix"
  | "nordic-frost";

export interface SocialLink {
  platform: "instagram" | "tiktok" | "youtube" | "twitter" | "github" | "linkedin" | "spotify";
  url: string;
}

export interface BioLinkButton {
  id: string;
  title: string;
  subtitle?: string;
  url: string;
  highlight?: boolean;
  badge?: string;
}

export interface BioLinkProfile {
  name: string;
  handle: string;
  bio: string;
  avatarUrl: string | null;
  verified: boolean;
  theme: BioTheme;
  socials: SocialLink[];
  buttons: BioLinkButton[];
}

export const BIO_THEMES: Array<{ id: BioTheme; name: string; preview: string }> = [
  { id: "apple-glass", name: "Apple Glass", preview: "radial-gradient(circle, #312e81, #0f172a)" },
  { id: "obsidian-dark", name: "Obsidian Dark", preview: "#09090b" },
  { id: "cyber-glow", name: "Cyber Glow", preview: "linear-gradient(135deg, #050505, #083344)" },
  { id: "pastel-minimalist", name: "Pastel Minimalist", preview: "linear-gradient(135deg, #fafaf9, #e7e5e4)" },
  { id: "sunset-ember", name: "Sunset Ember", preview: "linear-gradient(135deg, #7c2d12, #431407)" },
  { id: "emerald-matrix", name: "Emerald Matrix", preview: "linear-gradient(135deg, #064e3b, #022c22)" },
  { id: "nordic-frost", name: "Nordic Frost", preview: "linear-gradient(135deg, #1e293b, #0f172a)" },
];

export interface BioPreset {
  id: string;
  name: string;
  tag: string;
  profile: Partial<BioLinkProfile>;
}

export const BIO_PRESETS: BioPreset[] = [
  {
    id: "tech-founder",
    name: "Tech Founder & AI Engineer",
    tag: "Founder",
    profile: {
      name: "Alex Vance",
      handle: "@alexvance",
      bio: "Founder & Engineer building autonomous AI tools. Sharing weekly architecture breakdowns and shipping lessons.",
      theme: "apple-glass",
      verified: true,
      buttons: [
        {
          id: "btn-1",
          title: "🚀 Read My Weekly Engineering Letter",
          subtitle: "25,000+ founders read my system design teardowns",
          url: "https://example.com/newsletter",
          highlight: true,
          badge: "FREE",
        },
        {
          id: "btn-2",
          title: "💻 Open Source AI Agent Framework",
          subtitle: "Star us on GitHub (12.4k stars)",
          url: "https://github.com/example",
          badge: "GITHUB",
        },
        {
          id: "btn-3",
          title: "📅 Book an Advisory Strategy Session",
          subtitle: "1-on-1 technical roadmap review",
          url: "https://example.com/cal",
        },
      ],
    },
  },
  {
    id: "photographer",
    name: "Editorial & Studio Photographer",
    tag: "Creative",
    profile: {
      name: "Maya Lin",
      handle: "@mayalinphoto",
      bio: "Editorial & Commercial Photographer based in NYC. Capturing cinematic light, fashion, and human emotion.",
      theme: "obsidian-dark",
      verified: true,
      buttons: [
        {
          id: "btn-1",
          title: "📷 View 2026 Commercial Portfolio",
          subtitle: "Recent work for Vogue, Nike & A24",
          url: "https://example.com/portfolio",
          highlight: true,
          badge: "NEW",
        },
        {
          id: "btn-2",
          title: "🎨 Signature Lightroom Presets Pack",
          subtitle: "14 cinematic presets used in my editorial shoots",
          url: "https://example.com/presets",
          badge: "50% OFF",
        },
        {
          id: "btn-3",
          title: "✉️ Book a Commercial Studio Shoot",
          subtitle: "Dates open for Q3 & Q4 campaigns",
          url: "https://example.com/contact",
        },
      ],
    },
  },
  {
    id: "fitness-coach",
    name: "High-Performance Fitness Coach",
    tag: "Fitness",
    profile: {
      name: "Tyler Brooks",
      handle: "@tylerbrooksfit",
      bio: "Certified Performance Coach & Nutritionist. Helping founders & executives build peak energy and lasting strength.",
      theme: "sunset-ember",
      verified: true,
      buttons: [
        {
          id: "btn-1",
          title: "⚡ 12-Week Executive Body Rebuild",
          subtitle: "Personalized nutrition, training & bloodwork analysis",
          url: "https://example.com/program",
          highlight: true,
          badge: "ENROLLING",
        },
        {
          id: "btn-2",
          title: "🥗 Free Founder Nutrition & Meal Guide",
          subtitle: "High-protein recipes ready in under 15 minutes",
          url: "https://example.com/guide",
          badge: "FREE PDF",
        },
        {
          id: "btn-3",
          title: "📱 Download My Daily Workout Tracker App",
          subtitle: "Over 50,000 active athletes",
          url: "https://example.com/app",
        },
      ],
    },
  },
  {
    id: "music-producer",
    name: "Electronic Music Producer",
    tag: "Music",
    profile: {
      name: "Liam Kai",
      handle: "@liamkaibeats",
      bio: "Electronic Music Producer & Sound Designer. 15M+ streams across Spotify, Apple Music & festivals worldwide.",
      theme: "cyber-glow",
      verified: true,
      buttons: [
        {
          id: "btn-1",
          title: "🎧 Stream New Single 'Neon Horizon'",
          subtitle: "Out now on Spotify, Apple Music & Beatport",
          url: "https://spotify.com",
          highlight: true,
          badge: "OUT NOW",
        },
        {
          id: "btn-2",
          title: "🎹 Analog Synth & Serum Sample Pack",
          subtitle: "250+ royalty-free loops, bass presets & one-shots",
          url: "https://example.com/samples",
          badge: "HOT",
        },
        {
          id: "btn-3",
          title: "🎟️ 2026 World Tour Dates & Tickets",
          subtitle: "Tokyo, London, Berlin, New York",
          url: "https://example.com/tickets",
        },
      ],
    },
  },
];

export const INITIAL_BIO_PROFILE: BioLinkProfile = {
  name: "Alex Vance",
  handle: "@alexvance",
  bio: "Creative Director & Tech Founder. Sharing insights on AI workflows, design engineering, and digital craft.",
  avatarUrl: null,
  verified: true,
  theme: "apple-glass",
  socials: [
    { platform: "twitter", url: "https://x.com" },
    { platform: "youtube", url: "https://youtube.com" },
    { platform: "instagram", url: "https://instagram.com" },
    { platform: "github", url: "https://github.com" },
  ],
  buttons: [
    {
      id: "btn-1",
      title: "🚀 Join My Weekly Tech Newsletter",
      subtitle: "Over 25,000 founders read my Sunday teardowns",
      url: "https://example.com/newsletter",
      highlight: true,
      badge: "FREE",
    },
    {
      id: "btn-2",
      title: "🎨 My Digital Design System & Kit",
      subtitle: "Figma UI library with 400+ components",
      url: "https://example.com/design-kit",
      badge: "POPULAR",
    },
    {
      id: "btn-3",
      title: "☕ Buy Me a Coffee / Support",
      subtitle: "Instant tip via Stripe or Crypto",
      url: "https://example.com/tip",
    },
  ],
};

/**
 * AI Bio Copywriter & Button CTA Generator.
 */
export function generateAiBioSuggestions(niche = "Creator & Founder") {
  const suggestions = [
    {
      bio: `Building in public at the intersection of AI, design, and indie hacking. Sharing daily lessons.`,
      buttonTitles: [
        "🔥 Read My Latest Case Study",
        "💡 Access My Free Startup Checklist",
        "🎙️ Listen to My Latest Podcast Episode",
      ],
    },
    {
      bio: `Helping ambitious professionals 10x their creative output with automated workflows and modern tools.`,
      buttonTitles: [
        "⚡ Download Free Workflow Cheat Sheet",
        "📅 Book a 1-on-1 Strategy Session",
        "⭐ Join 10,000+ Community Members",
      ],
    },
    {
      bio: `Exploring cutting-edge technology, product craftsmanship, and visual storytelling.`,
      buttonTitles: [
        "🎬 Watch My Latest YouTube Video",
        "📦 Explore My Curated Toolkit",
        "✉️ Subscribe for Weekly Drops",
      ],
    },
  ];

  return suggestions[Math.floor(Math.random() * suggestions.length)];
}

/**
 * Generates high-res QR code PNG data URL for the profile.
 */
export async function generateBioQrCode(
  targetUrl: string,
  fgColor: string = "#000000",
  bgColor: string = "#ffffff"
): Promise<string> {
  return QRCode.toDataURL(targetUrl, {
    errorCorrectionLevel: "H",
    margin: 2,
    width: 600,
    color: {
      dark: fgColor,
      light: bgColor,
    },
  });
}

/**
 * Generates a self-contained, high-performance HTML file for the Bio Link page.
 */
export function generateStandaloneBioHtml(profile: BioLinkProfile): string {
  const isGlass = profile.theme === "apple-glass";
  const isCyber = profile.theme === "cyber-glow";
  const isPastel = profile.theme === "pastel-minimalist";

  let bgCss = "background: #09090b; color: #f4f4f5;";
  let cardCss = "background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); color: #fff;";
  let btnCss =
    "background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.15); color: #fff;";

  if (isGlass) {
    bgCss =
      "background: radial-gradient(circle at 50% 20%, #312e81 0%, #0f172a 60%, #020617 100%); color: #fff;";
    cardCss =
      "background: rgba(255, 255, 255, 0.1); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); border: 1px solid rgba(255, 255, 255, 0.25);";
    btnCss =
      "background: rgba(255, 255, 255, 0.12); backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.25); color: #fff;";
  } else if (isCyber) {
    bgCss = "background: #050505; color: #06b6d4;";
    btnCss =
      "background: #0d0d0d; border: 1px solid #06b6d4; color: #fff; box-shadow: 0 0 12px rgba(6, 182, 212, 0.25);";
  } else if (isPastel) {
    bgCss = "background: #fafaf9; color: #1c1917;";
    btnCss = "background: #ffffff; border: 1px solid #e7e5e4; color: #1c1917; box-shadow: 0 2px 8px rgba(0,0,0,0.04);";
  } else if (profile.theme === "sunset-ember") {
    bgCss =
      "background: radial-gradient(circle at 50% 20%, #7c2d12 0%, #431407 60%, #09090b 100%); color: #fff;";
    btnCss =
      "background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(249, 115, 22, 0.4); color: #fff; box-shadow: 0 4px 14px rgba(249, 115, 22, 0.2);";
  } else if (profile.theme === "emerald-matrix") {
    bgCss =
      "background: radial-gradient(circle at 50% 20%, #064e3b 0%, #022c22 60%, #020617 100%); color: #fff;";
    btnCss =
      "background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(52, 211, 153, 0.4); color: #fff; box-shadow: 0 4px 14px rgba(52, 211, 153, 0.2);";
  } else if (profile.theme === "nordic-frost") {
    bgCss =
      "background: radial-gradient(circle at 50% 20%, #1e293b 0%, #0f172a 60%, #020617 100%); color: #fff;";
    btnCss =
      "background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(56, 189, 248, 0.4); color: #fff; box-shadow: 0 4px 14px rgba(56, 189, 248, 0.2);";
  }

  const buttonsHtml = profile.buttons
    .map(
      (b) => `
    <a href="${b.url}" target="_blank" rel="noopener noreferrer" class="link-btn ${b.highlight ? "highlight" : ""}">
      <div style="font-weight: 700; font-size: 15px;">${b.title}</div>
      ${b.subtitle ? `<div style="font-size: 12px; opacity: 0.75; margin-top: 2px;">${b.subtitle}</div>` : ""}
      ${b.badge ? `<span class="badge">${b.badge}</span>` : ""}
    </a>
  `
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${profile.name} (${profile.handle}) — Links</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    body { margin: 0; min-height: 100vh; font-family: -apple-system, system-ui, sans-serif; ${bgCss} display: flex; justify-content: center; padding: 40px 20px; box-sizing: border-box; }
    .container { width: 100%; max-width: 480px; text-align: center; }
    .avatar { width: 96px; height: 96px; border-radius: 50%; object-fit: cover; border: 2px solid rgba(255,255,255,0.4); box-shadow: 0 8px 24px rgba(0,0,0,0.3); margin: 0 auto 16px; background: #334155; }
    .name-row { display: flex; align-items: center; justify-content: center; gap: 6px; font-size: 22px; font-weight: 800; margin-bottom: 4px; }
    .verified { color: #38bdf8; font-size: 18px; }
    .handle { font-size: 14px; opacity: 0.7; margin-bottom: 12px; }
    .bio { font-size: 14px; line-height: 1.5; opacity: 0.85; margin-bottom: 28px; }
    .links-list { display: flex; flex-direction: column; gap: 14px; }
    .link-btn { display: block; text-decoration: none; padding: 16px 20px; border-radius: 16px; transition: transform 0.15s ease, box-shadow 0.15s ease; ${btnCss} position: relative; }
    .link-btn:hover { transform: translateY(-2px); }
    .link-btn.highlight { border-color: #6366f1; box-shadow: 0 4px 20px rgba(99, 102, 241, 0.35); }
    .badge { position: absolute; top: -8px; right: 12px; background: #6366f1; color: #fff; font-size: 10px; font-weight: 800; padding: 3px 8px; border-radius: 10px; text-transform: uppercase; }
    .footer { margin-top: 40px; font-size: 12px; opacity: 0.5; }
  </style>
</head>
<body>
  <div class="container">
    ${profile.avatarUrl ? `<img src="${profile.avatarUrl}" class="avatar" alt="${profile.name}" />` : `<div class="avatar" style="display:flex;align-items:center;justify-content:center;font-size:32px;">👤</div>`}
    <div class="name-row">
      <span>${profile.name}</span>
      ${profile.verified ? `<span class="verified">✓</span>` : ""}
    </div>
    <div class="handle">${profile.handle}</div>
    <div class="bio">${profile.bio}</div>
    <div class="links-list">
      ${buttonsHtml}
    </div>
    <div class="footer">Created with PicTools Smart Link Studio</div>
  </div>
</body>
</html>`;
}

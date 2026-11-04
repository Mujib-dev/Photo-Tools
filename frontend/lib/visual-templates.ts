export type VisualTemplateStyle = "default" | "neon" | "editorial" | "mono" | "soft" | "organic";

export type VisualTokenKey =
  | "background"
  | "foreground"
  | "card"
  | "card-foreground"
  | "popover"
  | "popover-foreground"
  | "primary"
  | "primary-foreground"
  | "primary-container"
  | "on-primary-container"
  | "secondary"
  | "secondary-foreground"
  | "muted"
  | "muted-foreground"
  | "accent"
  | "accent-foreground"
  | "destructive"
  | "destructive-foreground"
  | "border"
  | "input"
  | "ring"
  | "outline"
  | "outline-variant"
  | "on-surface-variant"
  | "surface-container-lowest"
  | "surface-container-high"
  | "inverse-surface"
  | "inverse-on-surface"
  | "inverse-primary"
  | "on-secondary-container"
  | "canvas";

export type VisualTokens = Partial<Record<VisualTokenKey, string>>;

export interface VisualTemplate {
  id: string;
  name: string;
  tagline: string;
  description: string;
  style: VisualTemplateStyle;
  preview: string;
  swatches: string[];
  bestFor: string[];
  light: VisualTokens;
  dark: VisualTokens;
  radius?: string;
  displayFont?: string;
}

export const VISUAL_TEMPLATE_STORAGE_KEY = "pictools_visual_template";

export const VISUAL_TEMPLATES: VisualTemplate[] = [
  {
    id: "studio",
    name: "Optical Studio",
    tagline: "The default PicTools look",
    description: "Balanced optical blue with crisp surfaces and the familiar rounded panels.",
    style: "default",
    preview: "linear-gradient(135deg,#004ac6,#2563eb 55%,#93c5fd)",
    swatches: ["#004ac6", "#2563eb", "#93c5fd", "#f8fafc"],
    bestFor: ["All tools"],
    light: {},
    dark: {},
    radius: "0.75rem",
  },
  {
    id: "neon-pulse",
    name: "Neon Pulse",
    tagline: "Electric violet + cyan glow",
    description: "A dark, creator-focused palette with luminous accents that make previews pop.",
    style: "neon",
    preview: "linear-gradient(135deg,#7c3aed,#a855f7 45%,#22d3ee)",
    swatches: ["#7c3aed", "#a855f7", "#22d3ee", "#090514"],
    bestFor: ["Effects", "Video", "Images"],
    light: {
      background: "250 100% 99%",
      foreground: "252 30% 11%",
      card: "0 0% 100%",
      "card-foreground": "252 30% 11%",
      primary: "265 92% 56%",
      "primary-foreground": "0 0% 100%",
      "primary-container": "278 96% 62%",
      "on-primary-container": "0 0% 100%",
      secondary: "265 42% 94%",
      "secondary-foreground": "252 25% 15%",
      muted: "265 38% 95%",
      "muted-foreground": "255 14% 36%",
      accent: "190 88% 90%",
      "accent-foreground": "222 30% 12%",
      border: "265 32% 83%",
      input: "265 32% 83%",
      ring: "265 92% 56%",
      outline: "260 12% 50%",
      "outline-variant": "265 32% 84%",
      "on-surface-variant": "255 14% 36%",
      "surface-container-lowest": "0 0% 100%",
      "surface-container-high": "265 42% 93%",
      "inverse-surface": "252 30% 14%",
      "inverse-on-surface": "265 60% 96%",
      "inverse-primary": "190 90% 82%",
      canvas: "265 38% 94%",
    },
    dark: {
      background: "255 60% 6%",
      foreground: "260 60% 96%",
      card: "258 42% 12%",
      "card-foreground": "260 60% 96%",
      popover: "258 42% 12%",
      "popover-foreground": "260 60% 96%",
      primary: "265 100% 75%",
      "primary-foreground": "258 60% 8%",
      "primary-container": "265 95% 58%",
      "on-primary-container": "0 0% 100%",
      secondary: "260 35% 18%",
      "secondary-foreground": "260 30% 86%",
      muted: "260 35% 16%",
      "muted-foreground": "260 20% 70%",
      accent: "190 85% 22%",
      "accent-foreground": "190 90% 90%",
      border: "260 30% 23%",
      input: "260 30% 28%",
      ring: "265 100% 70%",
      outline: "260 20% 65%",
      "outline-variant": "260 30% 25%",
      "on-surface-variant": "260 20% 70%",
      "surface-container-lowest": "258 45% 10%",
      "surface-container-high": "260 35% 18%",
      "inverse-surface": "260 60% 96%",
      "inverse-on-surface": "258 50% 8%",
      "inverse-primary": "265 95% 58%",
      "on-secondary-container": "260 22% 72%",
      canvas: "258 45% 8%",
    },
    radius: "0.9rem",
  },
  {
    id: "warm-editorial",
    name: "Warm Editorial",
    tagline: "Cream + terracotta, magazine feel",
    description: "A warm, editorial palette with serif display type for documents and storytelling.",
    style: "editorial",
    preview: "linear-gradient(135deg,#c2410c,#f59e0b 55%,#fef3c7)",
    swatches: ["#c2410c", "#f59e0b", "#fef3c7", "#292018"],
    bestFor: ["Documents", "Images"],
    light: {
      background: "40 45% 98%",
      foreground: "25 25% 14%",
      card: "0 0% 100%",
      "card-foreground": "25 25% 14%",
      primary: "18 78% 45%",
      "primary-foreground": "0 0% 100%",
      "primary-container": "32 92% 55%",
      "on-primary-container": "25 30% 12%",
      secondary: "35 45% 92%",
      "secondary-foreground": "25 25% 18%",
      muted: "38 35% 94%",
      "muted-foreground": "25 12% 36%",
      accent: "45 65% 90%",
      "accent-foreground": "25 25% 15%",
      border: "30 28% 81%",
      input: "30 28% 81%",
      ring: "18 78% 45%",
      outline: "25 10% 48%",
      "outline-variant": "30 28% 83%",
      "on-surface-variant": "25 12% 36%",
      "surface-container-lowest": "0 0% 100%",
      "surface-container-high": "35 45% 92%",
      canvas: "38 35% 94%",
    },
    dark: {
      background: "24 22% 8%",
      foreground: "40 32% 94%",
      card: "24 18% 12%",
      "card-foreground": "40 32% 94%",
      popover: "24 18% 12%",
      "popover-foreground": "40 32% 94%",
      primary: "32 92% 62%",
      "primary-foreground": "24 35% 8%",
      "primary-container": "20 80% 50%",
      "on-primary-container": "0 0% 100%",
      secondary: "24 16% 18%",
      "secondary-foreground": "35 30% 86%",
      muted: "24 15% 16%",
      "muted-foreground": "35 15% 68%",
      accent: "18 42% 22%",
      "accent-foreground": "35 60% 88%",
      border: "24 15% 25%",
      input: "24 15% 30%",
      ring: "32 92% 62%",
      outline: "35 12% 62%",
      "outline-variant": "24 15% 27%",
      "on-surface-variant": "35 15% 68%",
      "surface-container-lowest": "24 18% 10%",
      "surface-container-high": "24 16% 18%",
      "inverse-surface": "40 32% 94%",
      "inverse-on-surface": "24 22% 8%",
      "inverse-primary": "20 80% 50%",
      "on-secondary-container": "35 18% 62%",
      canvas: "24 18% 9%",
    },
    radius: "0.25rem",
    displayFont: "Georgia, 'Times New Roman', serif",
  },
  {
    id: "mono-precision",
    name: "Mono Precision",
    tagline: "Black, white and zero radius",
    description: "A sharp monochrome system for technical tools, specs and high-contrast workspaces.",
    style: "mono",
    preview: "linear-gradient(135deg,#111111,#525252 55%,#e5e5e5)",
    swatches: ["#111111", "#525252", "#e5e5e5", "#ffffff"],
    bestFor: ["Documents", "Images"],
    light: {
      background: "0 0% 99%",
      foreground: "0 0% 9%",
      card: "0 0% 100%",
      "card-foreground": "0 0% 9%",
      primary: "0 0% 12%",
      "primary-foreground": "0 0% 100%",
      "primary-container": "0 0% 20%",
      "on-primary-container": "0 0% 100%",
      secondary: "0 0% 92%",
      "secondary-foreground": "0 0% 12%",
      muted: "0 0% 94%",
      "muted-foreground": "0 0% 35%",
      accent: "0 0% 90%",
      "accent-foreground": "0 0% 10%",
      border: "0 0% 82%",
      input: "0 0% 82%",
      ring: "0 0% 12%",
      outline: "0 0% 45%",
      "outline-variant": "0 0% 84%",
      "on-surface-variant": "0 0% 35%",
      "surface-container-lowest": "0 0% 100%",
      "surface-container-high": "0 0% 93%",
      canvas: "0 0% 95%",
    },
    dark: {
      background: "0 0% 5%",
      foreground: "0 0% 96%",
      card: "0 0% 9%",
      "card-foreground": "0 0% 96%",
      popover: "0 0% 9%",
      "popover-foreground": "0 0% 96%",
      primary: "0 0% 95%",
      "primary-foreground": "0 0% 5%",
      "primary-container": "0 0% 80%",
      "on-primary-container": "0 0% 5%",
      secondary: "0 0% 14%",
      "secondary-foreground": "0 0% 88%",
      muted: "0 0% 13%",
      "muted-foreground": "0 0% 65%",
      accent: "0 0% 18%",
      "accent-foreground": "0 0% 92%",
      border: "0 0% 22%",
      input: "0 0% 28%",
      ring: "0 0% 80%",
      outline: "0 0% 60%",
      "outline-variant": "0 0% 24%",
      "on-surface-variant": "0 0% 65%",
      "surface-container-lowest": "0 0% 8%",
      "surface-container-high": "0 0% 15%",
      "inverse-surface": "0 0% 96%",
      "inverse-on-surface": "0 0% 5%",
      "inverse-primary": "0 0% 80%",
      "on-secondary-container": "0 0% 62%",
      canvas: "0 0% 7%",
    },
    radius: "0rem",
  },
  {
    id: "ocean-calm",
    name: "Ocean Calm",
    tagline: "Soft teal + airy surfaces",
    description: "A calm, modern palette with generous rounding for photo and video workflows.",
    style: "soft",
    preview: "linear-gradient(135deg,#0f766e,#06b6d4 55%,#cffafe)",
    swatches: ["#0f766e", "#06b6d4", "#cffafe", "#f0fdfa"],
    bestFor: ["Images", "Video"],
    light: {
      background: "195 55% 98%",
      foreground: "200 30% 12%",
      card: "0 0% 100%",
      "card-foreground": "200 30% 12%",
      primary: "192 90% 32%",
      "primary-foreground": "0 0% 100%",
      "primary-container": "188 85% 42%",
      "on-primary-container": "0 0% 100%",
      secondary: "190 35% 92%",
      "secondary-foreground": "200 25% 16%",
      muted: "192 30% 94%",
      "muted-foreground": "200 15% 36%",
      accent: "190 48% 90%",
      "accent-foreground": "200 30% 14%",
      border: "190 28% 81%",
      input: "190 28% 81%",
      ring: "192 90% 32%",
      outline: "195 10% 48%",
      "outline-variant": "190 28% 83%",
      "on-surface-variant": "200 15% 36%",
      "surface-container-lowest": "0 0% 100%",
      "surface-container-high": "190 35% 92%",
      canvas: "192 30% 94%",
    },
    dark: {
      background: "200 50% 6%",
      foreground: "190 40% 95%",
      card: "200 40% 11%",
      "card-foreground": "190 40% 95%",
      popover: "200 40% 11%",
      "popover-foreground": "190 40% 95%",
      primary: "188 90% 60%",
      "primary-foreground": "200 50% 6%",
      "primary-container": "192 90% 40%",
      "on-primary-container": "0 0% 100%",
      secondary: "200 30% 17%",
      "secondary-foreground": "195 25% 86%",
      muted: "200 30% 15%",
      "muted-foreground": "195 20% 68%",
      accent: "190 38% 22%",
      "accent-foreground": "190 45% 90%",
      border: "200 25% 23%",
      input: "200 25% 28%",
      ring: "188 90% 60%",
      outline: "195 15% 62%",
      "outline-variant": "200 25% 25%",
      "on-surface-variant": "195 20% 68%",
      "surface-container-lowest": "200 40% 9%",
      "surface-container-high": "200 30% 17%",
      "inverse-surface": "190 40% 95%",
      "inverse-on-surface": "200 50% 6%",
      "inverse-primary": "192 90% 40%",
      "on-secondary-container": "195 18% 62%",
      canvas: "200 40% 8%",
    },
    radius: "1rem",
  },
  {
    id: "sunset-pop",
    name: "Sunset Pop",
    tagline: "Pink + orange, social-first",
    description: "A punchy gradient-friendly palette built for thumbnails, reels and social posts.",
    style: "soft",
    preview: "linear-gradient(135deg,#db2777,#f97316 55%,#fde68a)",
    swatches: ["#db2777", "#f97316", "#fde68a", "#2a0716"],
    bestFor: ["Effects", "Video", "Images"],
    light: {
      background: "20 100% 99%",
      foreground: "340 25% 12%",
      card: "0 0% 100%",
      "card-foreground": "340 25% 12%",
      primary: "330 85% 50%",
      "primary-foreground": "0 0% 100%",
      "primary-container": "15 90% 55%",
      "on-primary-container": "0 0% 100%",
      secondary: "20 45% 93%",
      "secondary-foreground": "340 22% 16%",
      muted: "25 40% 95%",
      "muted-foreground": "340 10% 36%",
      accent: "45 90% 88%",
      "accent-foreground": "340 30% 15%",
      border: "20 32% 82%",
      input: "20 32% 82%",
      ring: "330 85% 50%",
      outline: "340 10% 50%",
      "outline-variant": "20 32% 84%",
      "on-surface-variant": "340 10% 36%",
      "surface-container-lowest": "0 0% 100%",
      "surface-container-high": "20 45% 93%",
      canvas: "25 40% 95%",
    },
    dark: {
      background: "340 40% 6%",
      foreground: "20 50% 96%",
      card: "340 30% 11%",
      "card-foreground": "20 50% 96%",
      popover: "340 30% 11%",
      "popover-foreground": "20 50% 96%",
      primary: "330 95% 68%",
      "primary-foreground": "340 40% 6%",
      "primary-container": "15 90% 55%",
      "on-primary-container": "0 0% 100%",
      secondary: "340 25% 17%",
      "secondary-foreground": "20 30% 86%",
      muted: "340 25% 15%",
      "muted-foreground": "20 20% 70%",
      accent: "15 48% 22%",
      "accent-foreground": "25 70% 90%",
      border: "340 20% 24%",
      input: "340 20% 29%",
      ring: "330 95% 68%",
      outline: "20 15% 64%",
      "outline-variant": "340 20% 26%",
      "on-surface-variant": "20 20% 70%",
      "surface-container-lowest": "340 30% 9%",
      "surface-container-high": "340 25% 17%",
      "inverse-surface": "20 50% 96%",
      "inverse-on-surface": "340 40% 6%",
      "inverse-primary": "15 90% 55%",
      "on-secondary-container": "20 22% 62%",
      canvas: "340 30% 8%",
    },
    radius: "1rem",
  },
  {
    id: "forest-studio",
    name: "Forest Studio",
    tagline: "Deep emerald, organic calm",
    description: "A grounded green palette for photo editing, documents and everyday productivity.",
    style: "organic",
    preview: "linear-gradient(135deg,#047857,#22c55e 55%,#dcfce7)",
    swatches: ["#047857", "#22c55e", "#dcfce7", "#052e16"],
    bestFor: ["Images", "Documents", "Audio"],
    light: {
      background: "140 35% 98%",
      foreground: "150 25% 10%",
      card: "0 0% 100%",
      "card-foreground": "150 25% 10%",
      primary: "152 72% 28%",
      "primary-foreground": "0 0% 100%",
      "primary-container": "150 65% 38%",
      "on-primary-container": "0 0% 100%",
      secondary: "145 28% 92%",
      "secondary-foreground": "150 22% 16%",
      muted: "145 22% 94%",
      "muted-foreground": "150 12% 34%",
      accent: "140 38% 90%",
      "accent-foreground": "150 24% 14%",
      border: "145 22% 80%",
      input: "145 22% 80%",
      ring: "152 72% 28%",
      outline: "150 10% 48%",
      "outline-variant": "145 22% 82%",
      "on-surface-variant": "150 12% 34%",
      "surface-container-lowest": "0 0% 100%",
      "surface-container-high": "145 28% 92%",
      canvas: "145 22% 94%",
    },
    dark: {
      background: "155 45% 5%",
      foreground: "140 32% 95%",
      card: "155 35% 10%",
      "card-foreground": "140 32% 95%",
      popover: "155 35% 10%",
      "popover-foreground": "140 32% 95%",
      primary: "150 75% 60%",
      "primary-foreground": "155 45% 5%",
      "primary-container": "152 72% 35%",
      "on-primary-container": "0 0% 100%",
      secondary: "155 25% 16%",
      "secondary-foreground": "145 22% 86%",
      muted: "155 25% 14%",
      "muted-foreground": "145 15% 68%",
      accent: "150 32% 20%",
      "accent-foreground": "145 40% 90%",
      border: "155 20% 23%",
      input: "155 20% 28%",
      ring: "150 75% 60%",
      outline: "145 12% 62%",
      "outline-variant": "155 20% 25%",
      "on-surface-variant": "145 15% 68%",
      "surface-container-lowest": "155 35% 8%",
      "surface-container-high": "155 25% 16%",
      "inverse-surface": "140 32% 95%",
      "inverse-on-surface": "155 45% 5%",
      "inverse-primary": "152 72% 35%",
      "on-secondary-container": "145 18% 62%",
      canvas: "155 35% 7%",
    },
    radius: "0.5rem",
  },
];

export const CUSTOM_TEMPLATE_ID = "custom";
export const CUSTOM_PRIMARY_STORAGE_KEY = "pictools_custom_primary";
export const CUSTOM_ACCENT_STORAGE_KEY = "pictools_custom_accent";

export interface CustomVisualColors {
  primary: string;
  accent: string;
}

export const DEFAULT_CUSTOM_COLORS: CustomVisualColors = {
  primary: "#7c3aed",
  accent: "#06b6d4",
};

const CUSTOM_TEMPLATE: VisualTemplate = {
  id: CUSTOM_TEMPLATE_ID,
  name: "Custom color",
  tagline: "Your own palette",
  description: "Build a personal color pair and apply it across every tool.",
  style: "soft",
  preview: "linear-gradient(135deg,#7c3aed,#a855f7 45%,#06b6d4)",
  swatches: ["#7c3aed", "#a855f7", "#06b6d4", "#f8fafc"],
  bestFor: ["All tools"],
  light: {},
  dark: {},
};

const MANAGED_KEYS: VisualTokenKey[] = [
  "background",
  "foreground",
  "card",
  "card-foreground",
  "popover",
  "popover-foreground",
  "primary",
  "primary-foreground",
  "primary-container",
  "on-primary-container",
  "secondary",
  "secondary-foreground",
  "muted",
  "muted-foreground",
  "accent",
  "accent-foreground",
  "destructive",
  "destructive-foreground",
  "border",
  "input",
  "ring",
  "outline",
  "outline-variant",
  "on-surface-variant",
  "surface-container-lowest",
  "surface-container-high",
  "inverse-surface",
  "inverse-on-surface",
  "inverse-primary",
  "on-secondary-container",
  "canvas",
];

interface HslColor {
  h: number;
  s: number;
  l: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeHex(value: string | null | undefined, fallback: string): string {
  if (!value) return fallback;
  const trimmed = value.trim();
  if (/^#[0-9a-f]{6}$/i.test(trimmed)) return trimmed.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(trimmed)) {
    return `#${trimmed
      .slice(1)
      .split("")
      .map((char) => `${char}${char}`)
      .join("")
      .toLowerCase()}`;
  }
  return fallback;
}

function hexToHsl(hex: string): HslColor {
  const normalized = normalizeHex(hex, "#7c3aed").slice(1);
  const r = parseInt(normalized.slice(0, 2), 16) / 255;
  const g = parseInt(normalized.slice(2, 4), 16) / 255;
  const b = parseInt(normalized.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  const l = (max + min) / 2;

  let h = 0;
  let s = 0;

  if (delta !== 0) {
    s = delta / (1 - Math.abs(2 * l - 1));
    if (max === r) h = ((g - b) / delta) % 6;
    else if (max === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
    h *= 60;
    if (h < 0) h += 360;
  }

  return { h, s: s * 100, l: l * 100 };
}

function hslToRgb({ h, s, l }: HslColor): [number, number, number] {
  const hue = ((h % 360) + 360) % 360;
  const saturation = clamp(s, 0, 100) / 100;
  const lightness = clamp(l, 0, 100) / 100;
  const c = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = lightness - c / 2;

  let r = 0;
  let g = 0;
  let b = 0;
  if (hue < 60) [r, g, b] = [c, x, 0];
  else if (hue < 120) [r, g, b] = [x, c, 0];
  else if (hue < 180) [r, g, b] = [0, c, x];
  else if (hue < 240) [r, g, b] = [0, x, c];
  else if (hue < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];

  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

function relativeLuminance({ h, s, l }: HslColor): number {
  const [r, g, b] = hslToRgb({ h, s, l }).map((channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function foregroundFor(color: HslColor): string {
  return relativeLuminance(color) > 0.45 ? "228 16% 10%" : "0 0% 100%";
}

function hslTriplet({ h, s, l }: HslColor): string {
  return `${Math.round(h)} ${Math.round(clamp(s, 0, 100))}% ${Math.round(clamp(l, 0, 100))}%`;
}

function buildCustomTokens(colors: CustomVisualColors, dark: boolean): VisualTokens {
  const primaryHex = normalizeHex(colors.primary, DEFAULT_CUSTOM_COLORS.primary);
  const accentHex = normalizeHex(colors.accent, DEFAULT_CUSTOM_COLORS.accent);
  const primary = hexToHsl(primaryHex);
  const accent = hexToHsl(accentHex);

  const primaryL = dark ? clamp(primary.l, 58, 78) : clamp(primary.l, 30, 52);
  const containerL = dark ? clamp(primaryL - 10, 45, 66) : clamp(primaryL + 8, 42, 62);
  const primaryAdjusted = { ...primary, l: primaryL };
  const containerAdjusted = { ...primary, l: containerL };

  const secondaryL = dark ? 18 : 93;
  const secondary = { h: primary.h, s: clamp(primary.s, 25, 45), l: secondaryL };
  const softAccent = {
    h: accent.h,
    s: clamp(accent.s, 38, 78),
    l: dark ? 20 : 92,
  };
  const accentForeground = {
    h: accent.h,
    s: clamp(accent.s, 42, 82),
    l: dark ? 88 : 22,
  };
  const secondaryText = {
    h: primary.h,
    s: clamp(primary.s, 20, 50),
    l: dark ? 70 : 30,
  };

  return {
    primary: hslTriplet(primaryAdjusted),
    "primary-foreground": foregroundFor(primaryAdjusted),
    "primary-container": hslTriplet(containerAdjusted),
    "on-primary-container": foregroundFor(containerAdjusted),
    ring: hslTriplet(primaryAdjusted),
    "inverse-primary": hslTriplet(containerAdjusted),
    secondary: hslTriplet(secondary),
    "secondary-foreground": dark ? "240 30% 88%" : "228 16% 12%",
    accent: hslTriplet(softAccent),
    "accent-foreground": hslTriplet(accentForeground),
    "on-secondary-container": hslTriplet(secondaryText),
  };
}

export function getVisualTemplate(id: string): VisualTemplate {
  if (id === CUSTOM_TEMPLATE_ID) return CUSTOM_TEMPLATE;
  return VISUAL_TEMPLATES.find((template) => template.id === id) ?? VISUAL_TEMPLATES[0];
}

export function applyVisualTemplate(
  id: string,
  dark: boolean,
  customColors: CustomVisualColors = DEFAULT_CUSTOM_COLORS,
): VisualTemplate {
  const template = getVisualTemplate(id);
  if (typeof document === "undefined") return template;

  const root = document.documentElement;
  const body = document.body;

  for (const key of MANAGED_KEYS) {
    root.style.removeProperty(`--${key}`);
  }
  root.style.removeProperty("--radius");
  body?.style.removeProperty("--font-display");

  root.removeAttribute("data-template");
  root.removeAttribute("data-template-style");

  if (template.id === "studio") return template;

  const tokens =
    template.id === CUSTOM_TEMPLATE_ID ? buildCustomTokens(customColors, dark) : dark ? template.dark : template.light;
  for (const key of MANAGED_KEYS) {
    const value = tokens[key];
    if (value) root.style.setProperty(`--${key}`, value);
  }

  if (template.radius) root.style.setProperty("--radius", template.radius);
  if (template.displayFont && body) body.style.setProperty("--font-display", template.displayFont);

  root.setAttribute("data-template", template.id);
  root.setAttribute("data-template-style", template.style);

  return template;
}

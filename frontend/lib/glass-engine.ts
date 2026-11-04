/**
 * CSS Box Shadow, Mesh Gradient & 3D Glass Studio Engine
 *
 * Provides:
 * 1. Apple VisionOS-style Frosted Glassmorphism (blur, saturation, specular border)
 * 2. Harmonic Multi-Layer Diffuse Shadow calculation (Josh Comeau / Stripe style)
 * 3. Multi-point vibrant mesh gradient canvas synthesis
 * 4. 1-Click Code Exporters for Tailwind CSS, Raw CSS, and React Style Objects
 */

export type StudioMode = "glassmorphism" | "multi-shadow" | "mesh-gradient";

export interface GlassConfig {
  blurPx: number;
  bgRgba: string; // e.g. "rgba(255, 255, 255, 0.15)"
  borderColor: string; // e.g. "rgba(255, 255, 255, 0.25)"
  borderWidth: number; // px
  borderRadius: number; // px
  saturationPercent: number; // 100 to 200
  innerGlow: boolean;
}

export interface ShadowLayer {
  x: number;
  y: number;
  blur: number;
  spread: number;
  color: string;
}

export interface ShadowConfig {
  elevation: number; // 1 to 10
  layersCount: number; // 3 to 6
  baseColor: string; // hex or rgba
  opacity: number; // 0.05 to 0.4
  angleDeg: number; // light direction
  softness: number; // blur scaling factor
}

export interface MeshPoint {
  x: number; // 0 to 100%
  y: number; // 0 to 100%
  color: string;
  radius: number; // px
}

export interface MeshConfig {
  bgColor: string;
  points: MeshPoint[];
}

export interface StudioState {
  mode: StudioMode;
  glass: GlassConfig;
  shadow: ShadowConfig;
  mesh: MeshConfig;
  backgroundTheme: "dark-mesh" | "vibrant-rainbow" | "modern-architecture" | "monochrome-grid";
}

export const INITIAL_STUDIO_STATE: StudioState = {
  mode: "glassmorphism",
  glass: {
    blurPx: 16,
    bgRgba: "rgba(255, 255, 255, 0.12)",
    borderColor: "rgba(255, 255, 255, 0.28)",
    borderWidth: 1,
    borderRadius: 24,
    saturationPercent: 180,
    innerGlow: true,
  },
  shadow: {
    elevation: 4,
    layersCount: 5,
    baseColor: "#0f172a",
    opacity: 0.15,
    angleDeg: 65,
    softness: 1.2,
  },
  mesh: {
    bgColor: "#030712",
    points: [
      { x: 25, y: 30, color: "#4f46e5", radius: 300 },
      { x: 75, y: 25, color: "#ec4899", radius: 340 },
      { x: 50, y: 70, color: "#06b6d4", radius: 380 },
      { x: 80, y: 80, color: "#8b5cf6", radius: 280 },
    ],
  },
  backgroundTheme: "dark-mesh",
};

/**
 * Calculates harmonic multi-layer shadow layers using exponential power law.
 */
export function calculateHarmonicShadows(cfg: ShadowConfig): ShadowLayer[] {
  const layers: ShadowLayer[] = [];
  const rad = (cfg.angleDeg * Math.PI) / 180;
  const dirX = Math.cos(rad);
  const dirY = Math.sin(rad);

  const n = cfg.layersCount;
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    // Exponential growth for natural light diffusion
    const distance = Math.pow(t, 2.2) * (cfg.elevation * 12);
    const blur = Math.pow(t, 2.0) * (cfg.elevation * 16 * cfg.softness);
    const spread = (t - 0.5) * (cfg.elevation * 1.5);

    // Layer opacity tapers smoothly
    const layerAlpha = (cfg.opacity / n) * (1.6 - t * 0.6);

    const x = Math.round(dirX * distance * 10) / 10;
    const y = Math.round(dirY * distance * 10) / 10;

    // Convert baseColor to rgba
    const rgba = hexToRgba(cfg.baseColor, layerAlpha);

    layers.push({
      x,
      y,
      blur: Math.round(blur * 10) / 10,
      spread: Math.round(spread * 10) / 10,
      color: rgba,
    });
  }

  return layers;
}

function hexToRgba(hexOrRgba: string, alpha: number): string {
  if (hexOrRgba.startsWith("rgba") || hexOrRgba.startsWith("rgb")) {
    return hexOrRgba;
  }
  const clean = hexOrRgba.replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16) || 0;
  const g = parseInt(clean.substring(2, 4), 16) || 0;
  const b = parseInt(clean.substring(4, 6), 16) || 0;
  return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(3)})`;
}

/**
 * Generates the CSS box-shadow string for multi-layer harmonic shadow.
 */
export function getHarmonicShadowCss(layers: ShadowLayer[]): string {
  return layers
    .map((l) => `${l.x}px ${l.y}px ${l.blur}px ${l.spread}px ${l.color}`)
    .join(",\n  ");
}

/**
 * Generates Tailwind CSS classes for current glass & shadow setup.
 */
export function generateTailwindClasses(state: StudioState): string {
  const g = state.glass;
  const shadowLayers = calculateHarmonicShadows(state.shadow);
  const shadowStr = shadowLayers
    .map((l) => `${l.x}px_${l.y}px_${l.blur}px_${l.color}`)
    .join(",");

  const classes = [
    `backdrop-blur-[${g.blurPx}px]`,
    `backdrop-saturate-[${g.saturationPercent}%]`,
    `bg-white/10`,
    `border`,
    `border-white/20`,
    `rounded-[${g.borderRadius}px]`,
    `shadow-[${shadowStr}]`,
  ];

  return classes.join(" ");
}

/**
 * Generates pure CSS code with vendor prefixes.
 */
export function generateRawCss(state: StudioState): string {
  const g = state.glass;
  const layers = calculateHarmonicShadows(state.shadow);
  const shadowCss = getHarmonicShadowCss(layers);

  return `.glass-card {
  background: ${g.bgRgba};
  backdrop-filter: blur(${g.blurPx}px) saturate(${g.saturationPercent}%);
  -webkit-backdrop-filter: blur(${g.blurPx}px) saturate(${g.saturationPercent}%);
  border: ${g.borderWidth}px solid ${g.borderColor};
  border-radius: ${g.borderRadius}px;
  box-shadow: ${shadowCss};
}`;
}

/**
 * Generates React inline style object.
 */
export function generateReactStyles(state: StudioState): string {
  const g = state.glass;
  const layers = calculateHarmonicShadows(state.shadow);
  const shadowCss = layers
    .map((l) => `${l.x}px ${l.y}px ${l.blur}px ${l.spread}px ${l.color}`)
    .join(", ");

  return `const glassCardStyle: React.CSSProperties = {
  background: "${g.bgRgba}",
  backdropFilter: "blur(${g.blurPx}px) saturate(${g.saturationPercent}%)",
  WebkitBackdropFilter: "blur(${g.blurPx}px) saturate(${g.saturationPercent}%)",
  border: "${g.borderWidth}px solid ${g.borderColor}",
  borderRadius: "${g.borderRadius}px",
  boxShadow: "${shadowCss}",
};`;
}

/**
 * Renders a high-resolution mesh gradient artwork to canvas.
 */
export function renderMeshCanvas(
  canvas: HTMLCanvasElement,
  mesh: MeshConfig,
  width: number,
  height: number
) {
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // Base background
  ctx.fillStyle = mesh.bgColor;
  ctx.fillRect(0, 0, width, height);

  // Radial mesh points
  for (const pt of mesh.points) {
    const cx = (pt.x / 100) * width;
    const cy = (pt.y / 100) * height;

    const radGrad = ctx.createRadialGradient(cx, cy, 10, cx, cy, pt.radius);
    radGrad.addColorStop(0, pt.color);
    radGrad.addColorStop(0.5, pt.color + "99");
    radGrad.addColorStop(1, "transparent");

    ctx.fillStyle = radGrad;
    ctx.fillRect(0, 0, width, height);
  }

  // Subtle organic noise texture overlay
  const imgData = ctx.getImageData(0, 0, width, height);
  const d = imgData.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * 8;
    d[i] = Math.max(0, Math.min(255, d[i] + n));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n));
  }
  ctx.putImageData(imgData, 0, 0);
}

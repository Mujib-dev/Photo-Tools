/**
 * AI Virtual Studio Relighter Engine
 * Simulates directional 3D studio lighting, Phong diffuse reflection,
 * specular cheekbone highlights, ambient fill, and secondary rim lighting.
 */

export type RelightPreset =
  | "custom"
  | "linkedin"
  | "golden-hour"
  | "cyber-neon"
  | "cinematic-noir"
  | "ring-light";

export interface LightSource {
  x: number; // 0 to 1 normalized horizontal position
  y: number; // 0 to 1 normalized vertical position
  distance: number; // 0.2 to 2.0 (depth / elevation from face)
  color: string; // hex color e.g. "#ffffff", "#fef3c7"
  intensity: number; // 0 to 2.0
}

export interface RelightSettings {
  preset: RelightPreset;
  primaryLight: LightSource;
  enableRimLight: boolean;
  rimLightColor: string;
  rimLightIntensity: number;
  ambientIntensity: number; // 0.2 to 1.0 baseline ambient fill
  shininess: number; // specular glossiness
  depthRelief: number; // surface bump depth scale
}

export const RELIGHT_PRESETS: Record<
  Exclude<RelightPreset, "custom">,
  {
    label: string;
    icon: string;
    desc: string;
    settings: Omit<RelightSettings, "preset">;
  }
> = {
  linkedin: {
    label: "LinkedIn Executive",
    icon: "👔",
    desc: "Clean dual-softbox 5600K daylight key with balanced neutral fill",
    settings: {
      primaryLight: { x: 0.35, y: 0.28, distance: 0.85, color: "#ffffff", intensity: 1.15 },
      enableRimLight: true,
      rimLightColor: "#f1f5f9",
      rimLightIntensity: 0.45,
      ambientIntensity: 0.65,
      shininess: 24,
      depthRelief: 1.2,
    },
  },
  "golden-hour": {
    label: "Golden Hour Glow",
    icon: "🌟",
    desc: "Warm 45° sunset sunlight with glowing amber rim radiance",
    settings: {
      primaryLight: { x: 0.22, y: 0.3, distance: 0.9, color: "#fef08a", intensity: 1.35 },
      enableRimLight: true,
      rimLightColor: "#fbbf24",
      rimLightIntensity: 0.85,
      ambientIntensity: 0.55,
      shininess: 18,
      depthRelief: 1.4,
    },
  },
  "cyber-neon": {
    label: "Cyberpunk Dual-Neon",
    icon: "🟣",
    desc: "Vibrant neon magenta key light paired with crisp cyan rim light",
    settings: {
      primaryLight: { x: 0.2, y: 0.35, distance: 0.75, color: "#ec4899", intensity: 1.4 },
      enableRimLight: true,
      rimLightColor: "#06b6d4",
      rimLightIntensity: 1.25,
      ambientIntensity: 0.45,
      shininess: 32,
      depthRelief: 1.5,
    },
  },
  "cinematic-noir": {
    label: "Cinematic Noir",
    icon: "🎬",
    desc: "High-contrast dramatic split lighting with deep shadow falloff",
    settings: {
      primaryLight: { x: 0.15, y: 0.4, distance: 0.65, color: "#ffffff", intensity: 1.6 },
      enableRimLight: false,
      rimLightColor: "#94a3b8",
      rimLightIntensity: 0.2,
      ambientIntensity: 0.35,
      shininess: 28,
      depthRelief: 1.8,
    },
  },
  "ring-light": {
    label: "Glamour Ring Light",
    icon: "💡",
    desc: "Centrally balanced shadowless front illumination with soft facial glow",
    settings: {
      primaryLight: { x: 0.5, y: 0.45, distance: 0.5, color: "#fffbeb", intensity: 1.1 },
      enableRimLight: false,
      rimLightColor: "#ffffff",
      rimLightIntensity: 0.3,
      ambientIntensity: 0.75,
      shininess: 16,
      depthRelief: 0.8,
    },
  },
};

export const DEFAULT_RELIGHT_SETTINGS: RelightSettings = {
  preset: "linkedin",
  ...RELIGHT_PRESETS.linkedin.settings,
};

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const num = parseInt(clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

/**
 * Computes 3D relighted pixels using estimated surface normal gradients
 * and Phong diffuse + specular reflectance.
 */
export function relightImageData(
  source: ImageData,
  settings: RelightSettings,
): ImageData {
  const w = source.width;
  const h = source.height;
  const src = source.data;

  const output = new ImageData(new Uint8ClampedArray(src), w, h);
  const dst = output.data;

  // Primary light properties
  const [lR, lG, lB] = hexToRgb(settings.primaryLight.color);
  const pX = settings.primaryLight.x;
  const pY = settings.primaryLight.y;
  const pZ = settings.primaryLight.distance;
  const pInt = settings.primaryLight.intensity;

  // Rim light properties
  const [rR, rG, rB] = hexToRgb(settings.rimLightColor);
  const rimInt = settings.enableRimLight ? settings.rimLightIntensity : 0;
  const rimX = 1.0 - pX;
  const rimY = pY * 0.9;
  const rimZ = pZ * 1.1;

  const ambient = settings.ambientIntensity;
  const depthScale = settings.depthRelief;
  const shininess = settings.shininess;

  // Pre-calculate luminance buffer for fast normal estimation
  const lumBuf = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const idx = i * 4;
    lumBuf[i] = (0.299 * src[idx] + 0.587 * src[idx + 1] + 0.114 * src[idx + 2]) / 255;
  }

  for (let y = 0; y < h; y++) {
    const normY = y / h;
    const yAbove = Math.max(0, y - 1);
    const yBelow = Math.min(h - 1, y + 1);

    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const normX = x / w;

      const xLeft = Math.max(0, x - 1);
      const xRight = Math.min(w - 1, x + 1);

      // Estimate surface normal via central difference Sobel gradients
      const dx = (lumBuf[y * w + xRight] - lumBuf[y * w + xLeft]) * depthScale;
      const dy = (lumBuf[yBelow * w + x] - lumBuf[yAbove * w + x]) * depthScale;

      let nx = -dx;
      let ny = -dy;
      let nz = 1.0;
      const nLen = Math.hypot(nx, ny, nz) || 1.0;
      nx /= nLen;
      ny /= nLen;
      nz /= nLen;

      // 1. Primary Light Vector from pixel to light source
      const lx = pX - normX;
      const ly = pY - normY;
      const lz = pZ;
      const lDist = Math.hypot(lx, ly, lz) || 1.0;
      const dirX = lx / lDist;
      const dirY = ly / lDist;
      const dirZ = lz / lDist;

      // Attenuation falloff
      const att = 1.0 / (1.0 + 0.8 * lDist * lDist);

      // Diffuse factor (Lambertian: N · L)
      const nDotL = Math.max(0, nx * dirX + ny * dirY + nz * dirZ);
      const diffuse = nDotL * att * pInt;

      // Specular highlight factor (Blinn-Phong)
      // Half-vector between light and camera view (0, 0, 1)
      const hx = dirX;
      const hy = dirY;
      const hz = dirZ + 1.0;
      const hLen = Math.hypot(hx, hy, hz) || 1.0;
      const nDotH = Math.max(0, nx * (hx / hLen) + ny * (hy / hLen) + nz * (hz / hLen));
      const specular = Math.pow(nDotH, shininess) * att * (pInt * 0.7);

      // 2. Secondary Rim Light Vector
      let rimDiffuse = 0;
      let rimSpecular = 0;
      if (rimInt > 0) {
        const rlx = rimX - normX;
        const rly = rimY - normY;
        const rlz = rimZ;
        const rDist = Math.hypot(rlx, rly, rlz) || 1.0;
        const rDirX = rlx / rDist;
        const rDirY = rly / rDist;
        const rDirZ = rlz / rDist;

        // Grazing edge rim lighting: peaks when surface is angled away from camera
        const grazing = Math.pow(1.0 - Math.max(0, nz), 2.2);
        const rDotL = Math.max(0, nx * rDirX + ny * rDirY + nz * rDirZ);
        rimDiffuse = (rDotL * 0.5 + grazing * 0.8) * rimInt;

        const rhx = rDirX;
        const rhy = rDirY;
        const rhz = rDirZ + 1.0;
        const rhLen = Math.hypot(rhx, rhy, rhz) || 1.0;
        rimSpecular = Math.pow(Math.max(0, nx * (rhx / rhLen) + ny * (rhy / rhLen) + nz * (rhz / rhLen)), 20) * rimInt;
      }

      // Combine Lighting Equations
      const origR = src[idx];
      const origG = src[idx + 1];
      const origB = src[idx + 2];

      // Primary Light Contribution
      const primaryR = (origR * (lR / 255) * diffuse) + (lR * specular);
      const primaryG = (origG * (lG / 255) * diffuse) + (lG * specular);
      const primaryB = (origB * (lB / 255) * diffuse) + (lB * specular);

      // Rim Light Contribution
      const rimLightR = (origR * (rR / 255) * rimDiffuse) + (rR * rimSpecular);
      const rimLightG = (origG * (rG / 255) * rimDiffuse) + (rG * rimSpecular);
      const rimLightB = (origB * (rB / 255) * rimDiffuse) + (rB * rimSpecular);

      // Ambient Base
      const ambR = origR * ambient;
      const ambG = origG * ambient;
      const ambB = origB * ambient;

      const finalR = Math.max(0, Math.min(255, Math.round(ambR + primaryR + rimLightR)));
      const finalG = Math.max(0, Math.min(255, Math.round(ambG + primaryG + rimLightG)));
      const finalB = Math.max(0, Math.min(255, Math.round(ambB + primaryB + rimLightB)));

      dst[idx] = finalR;
      dst[idx + 1] = finalG;
      dst[idx + 2] = finalB;
      dst[idx + 3] = src[idx + 3]; // Preserve original alpha
    }
  }

  return output;
}

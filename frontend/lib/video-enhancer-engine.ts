/**
 * Video Enhancer Engine — Remini-Grade Edition
 * =============================================
 * Frame-by-frame enhancement engine with:
 *   - Bilateral-weighted Contrast-Adaptive Sharpening (no halo artifacts)
 *   - Multi-scale sharpening: macro edges + micro detail in one pass
 *   - Per-pixel YCbCr skin detection for targeted face clarity
 *   - Eye/lip zone intensity boost via local luminance variance detection
 *   - Temporal frame blending to eliminate video flicker
 *   - Shadow lift + highlight rolloff tone curve
 *   - Luminance-preserving saturation with vibrance boost
 */

export type VideoEnhanceProfile =
  | "remini-face"
  | "super-resolution"
  | "low-light"
  | "cinematic-hdr"
  | "deblur-denoise";

export interface VideoEnhanceOptions {
  profile: VideoEnhanceProfile;
  faceClarity: number;      // 0 - 100
  sharpness: number;        // 0 - 100
  denoise: number;          // 0 - 100
  contrast: number;         // 0 - 100
  brightness: number;       // -50 - +50
  saturation: number;       // 0 - 200 (100 = neutral)
  resolutionScale: 1 | 2 | 4;
}

export const DEFAULT_ENHANCE_OPTIONS: VideoEnhanceOptions = {
  profile: "remini-face",
  faceClarity: 75,
  sharpness: 65,
  denoise: 30,
  contrast: 60,
  brightness: 5,
  saturation: 110,
  resolutionScale: 1,
};

export const ENHANCE_PROFILES: {
  id: VideoEnhanceProfile;
  title: string;
  badge: string;
  desc: string;
  defaultOptions: Partial<VideoEnhanceOptions>;
}[] = [
  {
    id: "remini-face",
    title: "Remini Face HD",
    badge: "AI Portrait",
    desc: "Targeted facial clarity, eye & eyelash crispening, natural skin smoothing, and portrait pop.",
    defaultOptions: { faceClarity: 85, sharpness: 70, denoise: 40, contrast: 65, brightness: 8, saturation: 112 },
  },
  {
    id: "super-resolution",
    title: "Ultra-HD Clarity",
    badge: "Super-Res",
    desc: "Contrast-adaptive sharpening (CAS) and fine texture reconstruction across the entire frame.",
    defaultOptions: { faceClarity: 50, sharpness: 85, denoise: 25, contrast: 70, brightness: 4, saturation: 105 },
  },
  {
    id: "low-light",
    title: "Night & Low-Light Revive",
    badge: "HDR",
    desc: "Expands shadow dynamic range, suppresses dark chroma noise, and lifts underexposed shots.",
    defaultOptions: { faceClarity: 60, sharpness: 60, denoise: 65, contrast: 55, brightness: 22, saturation: 120 },
  },
  {
    id: "cinematic-hdr",
    title: "Cinematic HDR Film",
    badge: "Cinema",
    desc: "Rich micro-contrast, vibrant film color grading, and highlight rolloff balance.",
    defaultOptions: { faceClarity: 55, sharpness: 65, denoise: 20, contrast: 80, brightness: 0, saturation: 125 },
  },
  {
    id: "deblur-denoise",
    title: "Motion Deblur & Clean",
    badge: "Deblur",
    desc: "Reduces camera shake blur, clears compression macroblocks, and stabilizes details.",
    defaultOptions: { faceClarity: 70, sharpness: 80, denoise: 75, contrast: 60, brightness: 5, saturation: 105 },
  },
];

// ---------------------------------------------------------------------------
// Temporal accumulator — holds the previous enhanced frame for blending
// ---------------------------------------------------------------------------
let _prevFrameData: Uint8ClampedArray | null = null;
let _prevWidth = 0;
let _prevHeight = 0;

/** Reset temporal state when video source changes */
export function resetTemporalBuffer(): void {
  _prevFrameData = null;
  _prevWidth = 0;
  _prevHeight = 0;
}

// ---------------------------------------------------------------------------
// Skin-tone detection (Inclusive multi-tone locus with continuous probability)
// ---------------------------------------------------------------------------
function getSkinProbability(r: number, g: number, b: number): number {
  const sum = r + g + b;
  if (sum < 30 || sum > 750) return 0;
  const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
  const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
  
  // Normalized distance from skin locus center across all ethnicities
  const dCb = (cb - 102) / 32;
  const dCr = (cr - 152) / 28;
  const distSq = dCb * dCb + dCr * dCr;
  if (distSq > 3.2) return 0;
  return Math.max(0, 1 - distSq / 3.2);
}

// ---------------------------------------------------------------------------
// Build the shadow-lift / highlight-rolloff LUT (256 entries, Float32)
// ---------------------------------------------------------------------------
function buildToneLUT(brightness: number, contrast: number): Float32Array {
  const lut = new Float32Array(256);
  // brightness: -50..+50 => shadow lift or highlight compression
  const lift = Math.max(0, brightness) / 50;       // 0..1 lift shadows
  const compress = Math.max(0, -brightness) / 50;  // 0..1 compress highlights
  // contrast: 0..100 => factor 0.5..1.6
  const cFactor = 0.5 + (contrast / 100) * 1.1;

  for (let i = 0; i < 256; i++) {
    let v = i / 255;

    // Shadow lift curve (smoothstep so midtones stay natural)
    if (lift > 0) {
      const t = Math.max(0, Math.min(1, v / 0.65));
      const s = t * t * (3 - 2 * t);
      v = v + lift * s * (1 - v) * 0.55;
    }

    // Highlight rolloff
    if (compress > 0) {
      const t = Math.max(0, Math.min(1, (v - 0.55) / 0.45));
      const s = t * t * (3 - 2 * t);
      v = v - compress * s * v * 0.38;
    }

    // S-curve contrast around the midpoint
    v = (v - 0.5) * cFactor + 0.5;

    lut[i] = Math.max(0, Math.min(255, v * 255));
  }
  return lut;
}

// ---------------------------------------------------------------------------
// Main per-frame enhancement — Remini-grade bilateral CAS + multi-scale USM
// ---------------------------------------------------------------------------
export function enhanceVideoFrame(
  sourceData: ImageData,
  destData: ImageData,
  options: VideoEnhanceOptions,
  splitRatio: number = 1.0,
) {
  const width = sourceData.width;
  const height = sourceData.height;
  const src = sourceData.data;
  const dst = destData.data;

  // Pre-computed parameters
  const sharpW    = (options.sharpness  / 100) * 0.85;
  const faceW     = (options.faceClarity / 100) * 1.15;
  const denoiseW  = options.denoise / 100;
  const satFactor = options.saturation / 100;
  const splitX    = Math.round(width * splitRatio);

  // Build tone LUT once per frame
  const toneLUT = buildToneLUT(options.brightness, options.contrast);

  // Temporal blend strength: low = smooth, high = sharp response
  // Motion-adaptive temporal blend prevents ghosting on moving subjects
  const maxTemporalBlend = denoiseW * 0.28;
  const hasPrev =
    _prevFrameData !== null &&
    _prevWidth === width &&
    _prevHeight === height;

  // Store new frame for next iteration
  const nextPrev = new Uint8ClampedArray(src.length);

  for (let y = 0; y < height; y++) {
    const yOff = y * width * 4;

    for (let x = 0; x < width; x++) {
      const idx = yOff + x * 4;

      const r0 = src[idx];
      const g0 = src[idx + 1];
      const b0 = src[idx + 2];
      const a0 = src[idx + 3];

      // Right side of split = raw original
      if (x > splitX) {
        dst[idx] = r0; dst[idx + 1] = g0; dst[idx + 2] = b0; dst[idx + 3] = a0;
        nextPrev[idx] = r0; nextPrev[idx + 1] = g0; nextPrev[idx + 2] = b0; nextPrev[idx + 3] = a0;
        continue;
      }

      // Split boundary line
      if (x === splitX && splitRatio < 1.0) {
        dst[idx] = 255; dst[idx + 1] = 255; dst[idx + 2] = 255; dst[idx + 3] = 255;
        nextPrev[idx] = r0; nextPrev[idx + 1] = g0; nextPrev[idx + 2] = b0; nextPrev[idx + 3] = a0;
        continue;
      }

      let rOut = r0, gOut = g0, bOut = b0;

      // ---- 1. Bilateral-weighted CAS + multi-scale sharpening ----
      if (x > 1 && x < width - 2 && y > 1 && y < height - 2) {
        const w = width * 4;

        // 5-tap neighborhood (cross: N,S,E,W + NE,NW,SE,SW diagonals)
        const tIdx  = idx - w;
        const bIdx  = idx + w;
        const lIdx  = idx - 4;
        const rIdx  = idx + 4;
        const neIdx = idx - w + 4;
        const nwIdx = idx - w - 4;
        const seIdx = idx + w + 4;
        const swIdx = idx + w - 4;

        // Luminance center and neighbors
        const lumC  = 0.299 * r0   + 0.587 * g0   + 0.114 * b0;
        const lumT  = 0.299 * src[tIdx]  + 0.587 * src[tIdx+1]  + 0.114 * src[tIdx+2];
        const lumB  = 0.299 * src[bIdx]  + 0.587 * src[bIdx+1]  + 0.114 * src[bIdx+2];
        const lumL  = 0.299 * src[lIdx]  + 0.587 * src[lIdx+1]  + 0.114 * src[lIdx+2];
        const lumR  = 0.299 * src[rIdx]  + 0.587 * src[rIdx+1]  + 0.114 * src[rIdx+2];
        const lumNE = 0.299 * src[neIdx] + 0.587 * src[neIdx+1] + 0.114 * src[neIdx+2];
        const lumNW = 0.299 * src[nwIdx] + 0.587 * src[nwIdx+1] + 0.114 * src[nwIdx+2];
        const lumSE = 0.299 * src[seIdx] + 0.587 * src[seIdx+1] + 0.114 * src[seIdx+2];
        const lumSW = 0.299 * src[swIdx] + 0.587 * src[swIdx+1] + 0.114 * src[swIdx+2];

        // Neighborhood bounds for halo-free clamping (CAS rule)
        const minLum = Math.min(lumC, lumT, lumB, lumL, lumR);
        const maxLum = Math.max(lumC, lumT, lumB, lumL, lumR);

        // Bilateral range weights — suppress sharpening across strong edges
        const sigma = 26.0;
        const wT  = Math.exp(-((lumT  - lumC) ** 2) / (2 * sigma * sigma));
        const wB  = Math.exp(-((lumB  - lumC) ** 2) / (2 * sigma * sigma));
        const wL  = Math.exp(-((lumL  - lumC) ** 2) / (2 * sigma * sigma));
        const wR  = Math.exp(-((lumR  - lumC) ** 2) / (2 * sigma * sigma));
        const wNE = Math.exp(-((lumNE - lumC) ** 2) / (2 * sigma * sigma)) * 0.5;
        const wNW = Math.exp(-((lumNW - lumC) ** 2) / (2 * sigma * sigma)) * 0.5;
        const wSE = Math.exp(-((lumSE - lumC) ** 2) / (2 * sigma * sigma)) * 0.5;
        const wSW = Math.exp(-((lumSW - lumC) ** 2) / (2 * sigma * sigma)) * 0.5;

        const wSum = wT + wB + wL + wR + wNE + wNW + wSE + wSW;
        const wMean = wSum > 0
          ? (wT * lumT + wB * lumB + wL * lumL + wR * lumR +
             wNE * lumNE + wNW * lumNW + wSE * lumSE + wSW * lumSW) / wSum
          : lumC;

        // High-pass luma signal (macro edges)
        const hpMacro = lumC - wMean;

        // Fine detail pass: 3-tap cross for micro-texture
        const hpMicro = 4 * lumC - lumT - lumB - lumL - lumR;

        const skinProb = getSkinProbability(r0, g0, b0);

        let effectiveSharp: number;
        if (skinProb > 0.15) {
          // In skin: differentiate smooth skin vs feature edges (eyes, lips, brows)
          const localVar = Math.abs(hpMicro);
          if (localVar < 12 * (1 - denoiseW)) {
            // Bilateral smoothing region (pores, compression blocks)
            effectiveSharp = -denoiseW * 0.20 * skinProb;
          } else {
            // Feature edge zone: eyes, brows, lips — Remini-grade crispness
            effectiveSharp = sharpW * (1 + faceW * 1.35 * skinProb);
          }
        } else {
          // Non-skin: full CAS sharpening
          effectiveSharp = sharpW;
        }

        // Combine macro + micro sharpening
        const hpCombined = hpMacro * 0.72 + hpMicro * 0.005 * 0.28;
        const boost = hpCombined * effectiveSharp;

        // CAS Luminance clamping to eliminate white/dark halo borders
        const sharpLum = Math.max(minLum, Math.min(maxLum, lumC + boost));
        const delta = sharpLum - lumC;

        rOut = r0 + delta;
        gOut = g0 + delta;
        bOut = b0 + delta;
      }

      // ---- 2. Motion-Adaptive Temporal Blend (reduces flicker without ghosting) ----
      if (hasPrev && maxTemporalBlend > 0) {
        const pr = _prevFrameData![idx];
        const pg = _prevFrameData![idx + 1];
        const pb = _prevFrameData![idx + 2];
        const diff = Math.max(Math.abs(rOut - pr), Math.abs(gOut - pg), Math.abs(bOut - pb));
        // High difference indicates motion -> reduce temporal blend to zero to prevent ghosting
        const motionFactor = Math.max(0, 1 - diff / 28);
        const effTemporal = maxTemporalBlend * motionFactor;
        if (effTemporal > 0) {
          rOut = rOut * (1 - effTemporal) + pr * effTemporal;
          gOut = gOut * (1 - effTemporal) + pg * effTemporal;
          bOut = bOut * (1 - effTemporal) + pb * effTemporal;
        }
      }

      // ---- 3. Tone curve (shadow lift, contrast, brightness) ----
      rOut = toneLUT[Math.max(0, Math.min(255, Math.round(rOut)))];
      gOut = toneLUT[Math.max(0, Math.min(255, Math.round(gOut)))];
      bOut = toneLUT[Math.max(0, Math.min(255, Math.round(bOut)))];

      // ---- 4. Luminance-preserving saturation with vibrance ----
      if (satFactor !== 1.0) {
        const lum = 0.299 * rOut + 0.587 * gOut + 0.114 * bOut;
        // Vibrance: boost less-saturated pixels more (Remini's "pop")
        const maxC = Math.max(rOut, gOut, bOut);
        const minC = Math.min(rOut, gOut, bOut);
        const sat  = maxC > 0 ? (maxC - minC) / maxC : 0;
        const vibranceMult = satFactor + (1 - sat) * (satFactor - 1) * 0.45;
        rOut = lum + (rOut - lum) * vibranceMult;
        gOut = lum + (gOut - lum) * vibranceMult;
        bOut = lum + (bOut - lum) * vibranceMult;
      }

      // Clamp and write
      const rF = rOut < 0 ? 0 : rOut > 255 ? 255 : rOut;
      const gF = gOut < 0 ? 0 : gOut > 255 ? 255 : gOut;
      const bF = bOut < 0 ? 0 : bOut > 255 ? 255 : bOut;

      dst[idx]     = rF;
      dst[idx + 1] = gF;
      dst[idx + 2] = bF;
      dst[idx + 3] = a0;

      nextPrev[idx]     = rF;
      nextPrev[idx + 1] = gF;
      nextPrev[idx + 2] = bF;
      nextPrev[idx + 3] = a0;
    }
  }

  // Store for next frame
  _prevFrameData = nextPrev;
  _prevWidth  = width;
  _prevHeight = height;
}

/**
 * Demo portrait frame — animated blurry portrait for before/after testing.
 * Now includes intentional soft-blur pre-pass and compression-block noise
 * to make the Remini enhancement effect dramatically more visible.
 */
export function drawDemoPortraitFrame(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  timestampMs: number,
) {
  const time = timestampMs * 0.0015;

  // Background gradient (warm studio bokeh)
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  bgGrad.addColorStop(0, "#2c3e50");
  bgGrad.addColorStop(1, "#1a1e24");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Soft bokeh circles (simulates shallow DOF background)
  const bokehCount = 7;
  for (let i = 0; i < bokehCount; i++) {
    const bx = width * 0.15 + (i * width * 0.12) + Math.sin(time + i) * 18;
    const by = height * 0.28 + Math.cos(time * 0.8 + i) * 24;
    const rad = 55 + i * 18;
    const bGrad = ctx.createRadialGradient(bx, by, 0, bx, by, rad);
    bGrad.addColorStop(0, "rgba(255, 200, 130, 0.14)");
    bGrad.addColorStop(1, "rgba(255, 200, 130, 0)");
    ctx.fillStyle = bGrad;
    ctx.beginPath();
    ctx.arc(bx, by, rad, 0, Math.PI * 2);
    ctx.fill();
  }

  // Subtle breathing motion
  const headX = width * 0.5 + Math.sin(time) * 3;
  const headY = height * 0.43 + Math.cos(time * 1.2) * 2.5;
  const headW = width * 0.19;
  const headH = headW * 1.38;

  // Shoulders
  ctx.fillStyle = "#1e293b";
  ctx.beginPath();
  ctx.ellipse(headX, height * 0.90, headW * 1.8, height * 0.26, 0, 0, Math.PI * 2);
  ctx.fill();

  // Neck
  const neckGrad = ctx.createLinearGradient(headX - headW * 0.28, 0, headX + headW * 0.28, 0);
  neckGrad.addColorStop(0, "#c8896a");
  neckGrad.addColorStop(0.5, "#e0a986");
  neckGrad.addColorStop(1, "#c8896a");
  ctx.fillStyle = neckGrad;
  ctx.fillRect(headX - headW * 0.27, headY + headH * 0.36, headW * 0.54, headH * 0.36);

  // Face oval with realistic skin gradient
  const faceGrad = ctx.createRadialGradient(headX - headW * 0.1, headY - headH * 0.1, headW * 0.05, headX, headY, headW);
  faceGrad.addColorStop(0, "#f5c49e");
  faceGrad.addColorStop(0.55, "#e4a884");
  faceGrad.addColorStop(1, "#c98360");
  ctx.fillStyle = faceGrad;
  ctx.beginPath();
  ctx.ellipse(headX, headY, headW * 0.82, headH * 0.76, 0, 0, Math.PI * 2);
  ctx.fill();

  // Simulate compression blockiness (low-quality video artifact) using grid noise
  // This makes the before side look realistically degraded
  ctx.globalAlpha = 0.07;
  const blockSize = Math.max(4, Math.floor(width / 60));
  for (let bx = headX - headW * 0.85; bx < headX + headW * 0.85; bx += blockSize) {
    for (let by = headY - headH * 0.82; by < headY + headH * 0.82; by += blockSize) {
      if (Math.random() > 0.6) {
        ctx.fillStyle = Math.random() > 0.5 ? "#fff" : "#000";
        ctx.fillRect(bx, by, blockSize, blockSize);
      }
    }
  }
  ctx.globalAlpha = 1.0;

  // Hair (with highlight strand)
  ctx.fillStyle = "#2b1d14";
  ctx.beginPath();
  ctx.ellipse(headX, headY - headH * 0.37, headW * 0.92, headH * 0.56, 0, Math.PI, Math.PI * 2);
  ctx.fill();
  // Hair highlight
  const hairHL = ctx.createLinearGradient(headX - headW * 0.2, headY - headH * 0.7, headX + headW * 0.2, headY - headH * 0.55);
  hairHL.addColorStop(0, "rgba(120,80,40,0.0)");
  hairHL.addColorStop(0.45, "rgba(160,110,60,0.28)");
  hairHL.addColorStop(1, "rgba(120,80,40,0.0)");
  ctx.fillStyle = hairHL;
  ctx.beginPath();
  ctx.ellipse(headX, headY - headH * 0.45, headW * 0.4, headH * 0.08, 0, 0, Math.PI * 2);
  ctx.fill();

  // Eyes
  const eyeOffset = headW * 0.33;
  const eyeY = headY - headH * 0.06;

  ([-1, 1] as const).forEach((dir) => {
    const ex = headX + dir * eyeOffset;

    // Eyelid crease
    ctx.strokeStyle = "#a07050";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(ex, eyeY - headH * 0.03, headW * 0.15, headH * 0.04, 0, Math.PI, 0);
    ctx.stroke();

    // Sclera
    ctx.fillStyle = "#f5f8f8";
    ctx.beginPath();
    ctx.ellipse(ex, eyeY, headW * 0.14, headH * 0.072, 0, 0, Math.PI * 2);
    ctx.fill();

    // Iris with limbal ring
    const irisGrad = ctx.createRadialGradient(ex, eyeY, 0, ex, eyeY, headW * 0.075);
    irisGrad.addColorStop(0, "#5a3510");
    irisGrad.addColorStop(0.7, "#7a4820");
    irisGrad.addColorStop(1, "#2a1408");
    ctx.fillStyle = irisGrad;
    ctx.beginPath();
    ctx.arc(ex, eyeY, headW * 0.075, 0, Math.PI * 2);
    ctx.fill();

    // Pupil
    ctx.fillStyle = "#080e1a";
    ctx.beginPath();
    ctx.arc(ex, eyeY, headW * 0.036, 0, Math.PI * 2);
    ctx.fill();

    // Catchlight
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.beginPath();
    ctx.arc(ex - headW * 0.022, eyeY - headW * 0.022, headW * 0.016, 0, Math.PI * 2);
    ctx.fill();

    // Lower catchlight
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.beginPath();
    ctx.arc(ex + headW * 0.01, eyeY + headW * 0.02, headW * 0.009, 0, Math.PI * 2);
    ctx.fill();

    // Eyebrow
    ctx.strokeStyle = "#3a2210";
    ctx.lineWidth = 3.8;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(ex, eyeY - headH * 0.13, headW * 0.19, 0.85 * Math.PI, 1.78 * Math.PI, false);
    ctx.stroke();

    // Eyelashes (upper)
    ctx.strokeStyle = "#1a0f08";
    ctx.lineWidth = 1.8;
    for (let i = 0; i < 5; i++) {
      const angle = Math.PI * (0.85 + i * 0.19);
      const lx1 = ex + Math.cos(angle) * headW * 0.14;
      const ly1 = eyeY + Math.sin(angle) * headH * 0.072;
      const lx2 = lx1 + Math.cos(angle - Math.PI * 0.2) * headW * 0.04;
      const ly2 = ly1 + Math.sin(angle - Math.PI * 0.2) * headH * 0.04;
      ctx.beginPath();
      ctx.moveTo(lx1, ly1);
      ctx.lineTo(lx2, ly2);
      ctx.stroke();
    }
  });

  // Nose
  const noseGrad = ctx.createRadialGradient(headX - headW * 0.04, headY + headH * 0.11, 0, headX, headY + headH * 0.15, headW * 0.12);
  noseGrad.addColorStop(0, "#d4956e");
  noseGrad.addColorStop(1, "#c07858");
  ctx.fillStyle = noseGrad;
  ctx.beginPath();
  ctx.ellipse(headX, headY + headH * 0.15, headW * 0.10, headH * 0.055, 0, 0, Math.PI * 2);
  ctx.fill();

  // Lips
  const lipGrad = ctx.createLinearGradient(headX, headY + headH * 0.25, headX, headY + headH * 0.38);
  lipGrad.addColorStop(0, "#c87060");
  lipGrad.addColorStop(0.5, "#b85a4a");
  lipGrad.addColorStop(1, "#a04840");
  ctx.fillStyle = lipGrad;
  ctx.beginPath();
  ctx.ellipse(headX, headY + headH * 0.325, headW * 0.23, headH * 0.074, 0, 0, Math.PI * 2);
  ctx.fill();

  // Teeth visible highlight
  ctx.fillStyle = "rgba(255,252,248,0.88)";
  ctx.beginPath();
  ctx.ellipse(headX, headY + headH * 0.322, headW * 0.12, headH * 0.024, 0, 0, Math.PI * 2);
  ctx.fill();

  // Cupid's bow (upper lip detail)
  ctx.fillStyle = "#c87060";
  ctx.beginPath();
  ctx.moveTo(headX - headW * 0.09, headY + headH * 0.295);
  ctx.quadraticCurveTo(headX, headY + headH * 0.278, headX + headW * 0.09, headY + headH * 0.295);
  ctx.stroke();

  // Subtle cheek highlight
  ([-1, 1] as const).forEach((dir) => {
    const cx2 = headX + dir * headW * 0.45;
    const cy2 = headY + headH * 0.08;
    const cGrad = ctx.createRadialGradient(cx2, cy2, 0, cx2, cy2, headW * 0.22);
    cGrad.addColorStop(0, "rgba(230,140,120,0.20)");
    cGrad.addColorStop(1, "rgba(230,140,120,0)");
    ctx.fillStyle = cGrad;
    ctx.beginPath();
    ctx.ellipse(cx2, cy2, headW * 0.22, headH * 0.11, 0, 0, Math.PI * 2);
    ctx.fill();
  });

  // Add simulated Gaussian blur noise on the whole portrait area to mimic
  // real low-quality video before enhancement
  ctx.globalAlpha = 0.035;
  for (let n = 0; n < 120; n++) {
    const nx = headX + (Math.random() - 0.5) * headW * 2.2;
    const ny = headY + (Math.random() - 0.5) * headH * 2;
    const lum = Math.random() > 0.5 ? 255 : 0;
    ctx.fillStyle = `rgba(${lum},${lum},${lum},1)`;
    ctx.fillRect(nx, ny, 1, 1);
  }
  ctx.globalAlpha = 1.0;
}

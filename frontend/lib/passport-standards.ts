/**
 * Biometric Passport & Visa Photo Standards
 * Dimensions, head-height bounds, eye-level rules, and 4x6 print layouts.
 */

export interface PassportStandard {
  id: string;
  country: string;
  label: string;
  widthMm: number;
  heightMm: number;
  widthPx: number; // at 300 DPI
  heightPx: number; // at 300 DPI
  headHeightMinPercent: number; // percentage of photo height
  headHeightMaxPercent: number;
  eyeLevelMinPercent: number; // from bottom
  eyeLevelMaxPercent: number;
  bgColor: string; // standard official background
  flag: string;
}

export const PASSPORT_STANDARDS: PassportStandard[] = [
  {
    id: "us",
    country: "United States",
    label: "US Passport & Visa (2x2 in / 51x51 mm)",
    widthMm: 51,
    heightMm: 51,
    widthPx: 600,
    heightPx: 600,
    headHeightMinPercent: 50,
    headHeightMaxPercent: 69,
    eyeLevelMinPercent: 56,
    eyeLevelMaxPercent: 69,
    bgColor: "#ffffff",
    flag: "🇺🇸",
  },
  {
    id: "eu",
    country: "Schengen / EU",
    label: "Schengen / EU / Germany / France (35x45 mm)",
    widthMm: 35,
    heightMm: 45,
    widthPx: 413,
    heightPx: 531,
    headHeightMinPercent: 70,
    headHeightMaxPercent: 80,
    eyeLevelMinPercent: 50,
    eyeLevelMaxPercent: 65,
    bgColor: "#ffffff",
    flag: "🇪🇺",
  },
  {
    id: "uk",
    country: "United Kingdom",
    label: "UK Passport & Visa (35x45 mm)",
    widthMm: 35,
    heightMm: 45,
    widthPx: 413,
    heightPx: 531,
    headHeightMinPercent: 64,
    headHeightMaxPercent: 76,
    eyeLevelMinPercent: 52,
    eyeLevelMaxPercent: 66,
    bgColor: "#f1f5f9",
    flag: "🇬🇧",
  },
  {
    id: "ca",
    country: "Canada",
    label: "Canada Passport (50x70 mm)",
    widthMm: 50,
    heightMm: 70,
    widthPx: 590,
    heightPx: 826,
    headHeightMinPercent: 44,
    headHeightMaxPercent: 51,
    eyeLevelMinPercent: 52,
    eyeLevelMaxPercent: 68,
    bgColor: "#ffffff",
    flag: "🇨🇦",
  },
  {
    id: "in",
    country: "India",
    label: "India Passport & OCI (2x2 in / 51x51 mm)",
    widthMm: 51,
    heightMm: 51,
    widthPx: 600,
    heightPx: 600,
    headHeightMinPercent: 50,
    headHeightMaxPercent: 70,
    eyeLevelMinPercent: 55,
    eyeLevelMaxPercent: 70,
    bgColor: "#ffffff",
    flag: "🇮🇳",
  },
  {
    id: "au",
    country: "Australia",
    label: "Australia Passport (35x45 mm)",
    widthMm: 35,
    heightMm: 45,
    widthPx: 413,
    heightPx: 531,
    headHeightMinPercent: 71,
    headHeightMaxPercent: 80,
    eyeLevelMinPercent: 52,
    eyeLevelMaxPercent: 66,
    bgColor: "#ffffff",
    flag: "🇦🇺",
  },
  {
    id: "cn",
    country: "China",
    label: "China Visa & Passport (33x48 mm)",
    widthMm: 33,
    heightMm: 48,
    widthPx: 390,
    heightPx: 567,
    headHeightMinPercent: 58,
    headHeightMaxPercent: 68,
    eyeLevelMinPercent: 52,
    eyeLevelMaxPercent: 65,
    bgColor: "#ffffff",
    flag: "🇨🇳",
  },
  {
    id: "jp",
    country: "Japan",
    label: "Japan Passport (35x45 mm)",
    widthMm: 35,
    heightMm: 45,
    widthPx: 413,
    heightPx: 531,
    headHeightMinPercent: 71,
    headHeightMaxPercent: 80,
    eyeLevelMinPercent: 52,
    eyeLevelMaxPercent: 66,
    bgColor: "#ffffff",
    flag: "🇯🇵",
  },
  {
    id: "sg",
    country: "Singapore",
    label: "Singapore Passport (35x45 mm)",
    widthMm: 35,
    heightMm: 45,
    widthPx: 413,
    heightPx: 531,
    headHeightMinPercent: 70,
    headHeightMaxPercent: 80,
    eyeLevelMinPercent: 52,
    eyeLevelMaxPercent: 65,
    bgColor: "#ffffff",
    flag: "🇸🇬",
  },
  {
    id: "ae",
    country: "UAE / Dubai",
    label: "UAE / Dubai Visa & ID (40x60 mm)",
    widthMm: 40,
    heightMm: 60,
    widthPx: 472,
    heightPx: 708,
    headHeightMinPercent: 65,
    headHeightMaxPercent: 78,
    eyeLevelMinPercent: 50,
    eyeLevelMaxPercent: 65,
    bgColor: "#ffffff",
    flag: "🇦🇪",
  },
  {
    id: "sa",
    country: "Saudi Arabia",
    label: "Saudi Arabia / Umrah / Hajj (2x2 in / 51x51 mm)",
    widthMm: 51,
    heightMm: 51,
    widthPx: 600,
    heightPx: 600,
    headHeightMinPercent: 50,
    headHeightMaxPercent: 69,
    eyeLevelMinPercent: 56,
    eyeLevelMaxPercent: 69,
    bgColor: "#ffffff",
    flag: "🇸🇦",
  },
  {
    id: "kr",
    country: "South Korea",
    label: "South Korea Passport (35x45 mm)",
    widthMm: 35,
    heightMm: 45,
    widthPx: 413,
    heightPx: 531,
    headHeightMinPercent: 71,
    headHeightMaxPercent: 80,
    eyeLevelMinPercent: 52,
    eyeLevelMaxPercent: 66,
    bgColor: "#ffffff",
    flag: "🇰🇷",
  },
  {
    id: "br",
    country: "Brazil",
    label: "Brazil Passport (50x70 mm)",
    widthMm: 50,
    heightMm: 70,
    widthPx: 590,
    heightPx: 826,
    headHeightMinPercent: 50,
    headHeightMaxPercent: 65,
    eyeLevelMinPercent: 50,
    eyeLevelMaxPercent: 68,
    bgColor: "#ffffff",
    flag: "🇧🇷",
  },
  {
    id: "mx",
    country: "Mexico",
    label: "Mexico Passport (35x45 mm)",
    widthMm: 35,
    heightMm: 45,
    widthPx: 413,
    heightPx: 531,
    headHeightMinPercent: 65,
    headHeightMaxPercent: 75,
    eyeLevelMinPercent: 52,
    eyeLevelMaxPercent: 66,
    bgColor: "#ffffff",
    flag: "🇲🇽",
  },
  {
    id: "ph",
    country: "Philippines",
    label: "Philippines Passport (35x45 mm)",
    widthMm: 35,
    heightMm: 45,
    widthPx: 413,
    heightPx: 531,
    headHeightMinPercent: 70,
    headHeightMaxPercent: 80,
    eyeLevelMinPercent: 52,
    eyeLevelMaxPercent: 65,
    bgColor: "#ffffff",
    flag: "🇵🇭",
  },
  {
    id: "tr",
    country: "Turkey",
    label: "Turkey Passport & Biometric (50x60 mm)",
    widthMm: 50,
    heightMm: 60,
    widthPx: 590,
    heightPx: 708,
    headHeightMinPercent: 60,
    headHeightMaxPercent: 75,
    eyeLevelMinPercent: 52,
    eyeLevelMaxPercent: 66,
    bgColor: "#ffffff",
    flag: "🇹🇷",
  },
  {
    id: "custom",
    country: "Custom",
    label: "Custom Biometric Size",
    widthMm: 35,
    heightMm: 45,
    widthPx: 413,
    heightPx: 531,
    headHeightMinPercent: 65,
    headHeightMaxPercent: 75,
    eyeLevelMinPercent: 50,
    eyeLevelMaxPercent: 65,
    bgColor: "#ffffff",
    flag: "🌐",
  },
];

/** Standard 4x6 inch print sheet generator */
export async function generatePrintSheet4x6(
  tileCanvas: HTMLCanvasElement,
  standard: PassportStandard,
): Promise<Blob> {
  const sheetW = 1800; // 6 inches at 300 DPI
  const sheetH = 1200; // 4 inches at 300 DPI

  const canvas = document.createElement("canvas");
  canvas.width = sheetW;
  canvas.height = sheetH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create print sheet canvas");

  // Solid white sheet background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, sheetW, sheetH);

  const tW = standard.widthPx;
  const tH = standard.heightPx;

  // Determine grid capacity on 4x6
  let cols = Math.floor(sheetW / (tW + 20));
  let rows = Math.floor(sheetH / (tH + 20));

  // Minimum sensible count
  cols = Math.max(1, cols);
  rows = Math.max(1, rows);

  // If 2x2 in (600x600 px): 2 rows x 3 cols = 6 photos
  if (tW === 600 && tH === 600) {
    cols = 3;
    rows = 2;
  }
  // If 35x45 mm (413x531 px): 2 rows x 4 cols = 8 photos
  else if (tW <= 420 && tH <= 540) {
    cols = 4;
    rows = 2;
  }
  // If 50x70 mm (590x826 px): 1 row x 2 cols or 1 row x 3 cols
  else if (tH > 750) {
    cols = Math.min(cols, 2);
    rows = 1;
  }

  const gap = 16;
  const totalGridW = cols * tW + (cols - 1) * gap;
  const totalGridH = rows * tH + (rows - 1) * gap;
  const offsetX = Math.floor((sheetW - totalGridW) / 2);
  const offsetY = Math.floor((sheetH - totalGridH) / 2);

  // Draw photos with subtle cutting guides
  ctx.lineWidth = 1;
  ctx.strokeStyle = "#cbd5e1";

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = offsetX + c * (tW + gap);
      const y = offsetY + r * (tH + gap);

      // Draw photo
      ctx.drawImage(tileCanvas, x, y, tW, tH);

      // Draw subtle cut-corner tick marks or border
      ctx.strokeStyle = "#94a3b8";
      ctx.strokeRect(x, y, tW, tH);

      // Corner cross-hair ticks for precision scissors/guillotine
      const tick = 10;
      ctx.strokeStyle = "#64748b";
      ctx.beginPath();
      // Top-left
      ctx.moveTo(x - tick, y); ctx.lineTo(x, y);
      ctx.moveTo(x, y - tick); ctx.lineTo(x, y);
      // Top-right
      ctx.moveTo(x + tW + tick, y); ctx.lineTo(x + tW, y);
      ctx.moveTo(x + tW, y - tick); ctx.lineTo(x + tW, y);
      // Bottom-left
      ctx.moveTo(x - tick, y + tH); ctx.lineTo(x, y + tH);
      ctx.moveTo(x, y + tH + tick); ctx.lineTo(x, y + tH);
      // Bottom-right
      ctx.moveTo(x + tW + tick, y + tH); ctx.lineTo(x + tW, y + tH);
      ctx.moveTo(x + tW, y + tH + tick); ctx.lineTo(x + tW, y + tH);
      ctx.stroke();
    }
  }

  // Header caption for photo lab / printing
  ctx.fillStyle = "#64748b";
  ctx.font = "bold 22px system-ui, -apple-system, sans-serif";
  ctx.fillText(
    `PIC TOOLS PASSPORT STUDIO • 4×6 INCH PRINT SHEET • ${standard.label.toUpperCase()} (${cols * rows} PHOTOS)`,
    offsetX,
    Math.max(38, offsetY - 24),
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Sheet export failed"))),
      "image/jpeg",
      0.98,
    );
  });
}

/**
 * Biometric Auto-Alignment & Framing Engine
 * Detects the subject's face bounding oval and automatically computes the optimal
 * zoom scale and (X, Y) pan offsets to conform to official ICAO 9303 / US State Department
 * head height ratio (50-80%) and centered eye-line standards.
 */
export function autoAlignBiometricPhoto(
  img: HTMLImageElement,
  standard: PassportStandard,
): { zoom: number; panX: number; panY: number } {
  const nw = img.naturalWidth || img.width;
  const nh = img.naturalHeight || img.height;
  const sW = standard.widthPx;
  const sH = standard.heightPx;

  // Fallback defaults if dimensions are missing
  if (!nw || !nh) return { zoom: 1, panX: 0, panY: 0 };

  const defaultScale = Math.max(sW / nw, sH / nh) * 1.15;
  const defaultPanX = (sW - nw * defaultScale) / 2;
  const defaultPanY = (sH - nh * defaultScale) / 2;

  try {
    const smallCanvas = document.createElement("canvas");
    const sampleMax = 320;
    const scale = Math.min(1.0, sampleMax / Math.max(nw, nh));
    const sw = Math.round(nw * scale);
    const sh = Math.round(nh * scale);
    smallCanvas.width = sw;
    smallCanvas.height = sh;

    const ctx = smallCanvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return { zoom: defaultScale, panX: defaultPanX, panY: defaultPanY };

    ctx.drawImage(img, 0, 0, sw, sh);
    const data = ctx.getImageData(0, 0, sw, sh).data;

    let topHeadY = sh;
    let botChinY = 0;
    let sumX = 0;
    let skinCount = 0;

    for (let y = 0; y < sh; y++) {
      const yOff = y * sw;
      for (let x = 0; x < sw; x++) {
        const idx = (yOff + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];

        // Robust human skin locus in RGB
        if (
          r > 60 &&
          g > 40 &&
          b > 20 &&
          r > g &&
          g > b &&
          r - g >= 10 &&
          r - b >= 14
        ) {
          if (y < topHeadY) topHeadY = y;
          if (y > botChinY) botChinY = y;
          sumX += x;
          skinCount++;
        }
      }
    }

    // Confident facial detection
    if (skinCount > sw * sh * 0.02 && botChinY > topHeadY + 16) {
      const faceHeightNorm = (botChinY - topHeadY) / scale;
      const faceCenterX = (sumX / skinCount) / scale;
      const faceCenterY = ((topHeadY + botChinY) * 0.5) / scale;

      const targetHeadH =
        sH * ((standard.headHeightMinPercent + standard.headHeightMaxPercent) / 200.0);
      const idealZoom = Math.max(
        sW / nw,
        targetHeadH / Math.max(1, faceHeightNorm)
      );

      // Target eye level on canvas (measured from top)
      const targetEyeLevelFromBottom =
        (standard.eyeLevelMinPercent + standard.eyeLevelMaxPercent) * 0.5;
      const targetEyeY = sH * (1.0 - targetEyeLevelFromBottom / 100.0);

      const panX = sW * 0.5 - faceCenterX * idealZoom;
      const panY = targetEyeY - faceCenterY * idealZoom;

      return { zoom: idealZoom, panX, panY };
    }
  } catch {
    // Graceful fallback
  }

  return { zoom: defaultScale, panX: defaultPanX, panY: defaultPanY };
}

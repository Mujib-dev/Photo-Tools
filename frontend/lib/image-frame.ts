/**
 * Client-side frame + caption renderer.
 *
 * Draws a border (optionally rounded) around a photo and stamps a wrapped text
 * overlay at any of nine anchor points. Runs entirely on a canvas in the
 * browser — images are never uploaded.
 */

export type FrameAnchor =
  | "top-left"
  | "top-center"
  | "top-right"
  | "middle-left"
  | "middle-center"
  | "middle-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

export type FrameFont = "sans" | "serif" | "mono";

export interface FrameOptions {
  /** Border thickness in pixels. */
  borderWidth: number;
  borderColor: string;
  /** Rounded-corner radius in pixels. */
  radius: number;
  /** Overlay caption (empty = none). */
  text: string;
  anchor: FrameAnchor;
  fontSize: number;
  font: FrameFont;
  textColor: string;
  bold: boolean;
  /** Draw a filled box behind the caption for legibility. */
  textBackground: boolean;
  textBgColor: string;
  textBgOpacity: number;
  /** Distance from the image edge, in pixels. */
  margin: number;
}

export const DEFAULT_FRAME: FrameOptions = {
  borderWidth: 24,
  borderColor: "#ffffff",
  radius: 0,
  text: "",
  anchor: "bottom-center",
  fontSize: 48,
  font: "sans",
  textColor: "#ffffff",
  bold: true,
  textBackground: true,
  textBgColor: "#000000",
  textBgOpacity: 0.5,
  margin: 32,
};

export const FRAME_FONTS: { value: FrameFont; label: string; stack: string }[] = [
  { value: "sans", label: "Sans", stack: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" },
  { value: "serif", label: "Serif", stack: "Georgia, 'Times New Roman', serif" },
  { value: "mono", label: "Mono", stack: "ui-monospace, 'Cascadia Code', Consolas, monospace" },
];

export const FRAME_ANCHORS: FrameAnchor[] = [
  "top-left",
  "top-center",
  "top-right",
  "middle-left",
  "middle-center",
  "middle-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
];

export const FRAME_SWATCHES = ["#ffffff", "#000000", "#f1f5f9", "#0f172a", "#ef4444", "#3b82f6"];

function fontStack(font: FrameFont): string {
  return FRAME_FONTS.find((f) => f.value === font)?.stack ?? FRAME_FONTS[0].stack;
}

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
): void {
  const r = Math.max(0, Math.min(radius, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const paragraphs = text.split("\n");
  const lines: string[] = [];
  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push("");
      continue;
    }
    let current = words[0];
    for (let i = 1; i < words.length; i++) {
      const candidate = `${current} ${words[i]}`;
      if (ctx.measureText(candidate).width <= maxWidth) {
        current = candidate;
      } else {
        lines.push(current);
        current = words[i];
      }
    }
    lines.push(current);
  }
  return lines;
}

function drawCaption(
  ctx: CanvasRenderingContext2D,
  opts: FrameOptions,
  imageW: number,
  imageH: number,
  scale: number,
): void {
  const text = opts.text.trim();
  const fontSize = opts.fontSize * scale;
  if (!text || fontSize <= 0) return;

  const margin = opts.margin * scale;
  ctx.font = `${opts.bold ? "700" : "400"} ${fontSize}px ${fontStack(opts.font)}`;
  ctx.textBaseline = "top";

  const maxWidth = Math.max(1, imageW - margin * 2);
  const lines = wrapLines(ctx, text, maxWidth);
  const lineHeight = fontSize * 1.25;
  const blockHeight = lines.length * lineHeight;
  const blockWidth = Math.max(...lines.map((l) => ctx.measureText(l).width), 1);

  const [vertical, horizontal] = opts.anchor.split("-");

  const x =
    horizontal === "left" ? margin : horizontal === "right" ? imageW - margin : imageW / 2;
  ctx.textAlign = horizontal === "left" ? "left" : horizontal === "right" ? "right" : "center";

  const y =
    vertical === "top"
      ? margin
      : vertical === "bottom"
        ? imageH - margin - blockHeight
        : (imageH - blockHeight) / 2;

  if (opts.textBackground) {
    const pad = fontSize * 0.4;
    const boxX =
      horizontal === "left"
        ? x - pad
        : horizontal === "right"
          ? x - blockWidth - pad
          : x - blockWidth / 2 - pad;
    const boxY = y - pad;
    const boxW = blockWidth + pad * 2;
    const boxH = blockHeight + pad * 2;
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, opts.textBgOpacity));
    ctx.fillStyle = opts.textBgColor;
    roundRectPath(ctx, boxX, boxY, boxW, boxH, fontSize * 0.35);
    ctx.fill();
    ctx.restore();
  }

  ctx.fillStyle = opts.textColor;
  lines.forEach((line, i) => {
    if (line) ctx.fillText(line, x, y + i * lineHeight + (lineHeight - fontSize) / 2);
  });
}

/**
 * Render `img` with its border and caption. When `maxSize` is supplied the
 * whole result is scaled down proportionally to fit (used for the preview).
 */
export function renderFramed(
  img: HTMLImageElement,
  opts: FrameOptions,
  maxSize?: number,
): HTMLCanvasElement {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;

  const fullW = iw + opts.borderWidth * 2;
  const fullH = ih + opts.borderWidth * 2;
  const scale = maxSize && Math.max(fullW, fullH) > maxSize ? maxSize / Math.max(fullW, fullH) : 1;

  const border = opts.borderWidth * scale;
  const imageW = iw * scale;
  const imageH = ih * scale;
  const width = Math.max(1, Math.round(imageW + border * 2));
  const height = Math.max(1, Math.round(imageH + border * 2));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is unavailable in this browser.");
  ctx.imageSmoothingQuality = "high";

  ctx.save();
  if (opts.radius > 0) {
    roundRectPath(ctx, 0, 0, width, height, opts.radius * scale);
    ctx.clip();
  }
  if (border > 0) {
    ctx.fillStyle = opts.borderColor;
    ctx.fillRect(0, 0, width, height);
  }
  ctx.drawImage(img, 0, 0, iw, ih, border, border, imageW, imageH);
  ctx.restore();

  ctx.save();
  ctx.translate(border, border);
  drawCaption(ctx, opts, imageW, imageH, scale);
  ctx.restore();

  return canvas;
}

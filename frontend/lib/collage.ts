/**
 * Client-side collage composer.
 *
 * Arranges images into a grid, a single row or a single column and renders the
 * result on a canvas. Nothing is uploaded — composition happens in the browser.
 */

export type CollageLayout = "grid" | "horizontal" | "vertical";
export type CollageFit = "cover" | "contain";

export interface CollageOptions {
  layout: CollageLayout;
  /** Columns used when `layout === "grid"` (1–6). */
  columns: number;
  /** Side length of each square cell, in pixels. */
  cellSize: number;
  /** Space between cells, in pixels. */
  gap: number;
  /** Space around the whole collage, in pixels. */
  padding: number;
  /** Corner rounding of each cell, in pixels. */
  radius: number;
  /** Background colour (CSS hex). */
  background: string;
  /** Leave the background fully transparent instead of filling it. */
  transparent: boolean;
  /** How an image fills its cell. */
  fit: CollageFit;
}

export const DEFAULT_COLLAGE: CollageOptions = {
  layout: "grid",
  columns: 2,
  cellSize: 480,
  gap: 12,
  padding: 12,
  radius: 0,
  background: "#ffffff",
  transparent: false,
  fit: "cover",
};

export const COLLAGE_LAYOUTS: { value: CollageLayout; label: string }[] = [
  { value: "grid", label: "Grid" },
  { value: "horizontal", label: "Row" },
  { value: "vertical", label: "Stack" },
];

export const COLLAGE_FITS: { value: CollageFit; label: string }[] = [
  { value: "cover", label: "Fill" },
  { value: "contain", label: "Fit" },
];

export const COLLAGE_SWATCHES = ["#ffffff", "#000000", "#f1f5f9", "#0f172a", "#fef3c7", "#dbeafe"];

/** Column/row breakdown for a given number of images. */
export function collageGrid(opts: CollageOptions, count: number): { cols: number; rows: number } {
  const n = Math.max(1, count);
  if (opts.layout === "horizontal") return { cols: n, rows: 1 };
  if (opts.layout === "vertical") return { cols: 1, rows: n };
  const cols = Math.max(1, Math.min(opts.columns, n));
  return { cols, rows: Math.ceil(n / cols) };
}

/** Full-resolution output size for the current options. */
export function collageDimensions(
  opts: CollageOptions,
  count: number,
): { cols: number; rows: number; width: number; height: number } {
  const { cols, rows } = collageGrid(opts, count);
  const width = opts.padding * 2 + cols * opts.cellSize + (cols - 1) * opts.gap;
  const height = opts.padding * 2 + rows * opts.cellSize + (rows - 1) * opts.gap;
  return { cols, rows, width, height };
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

/**
 * Render the collage to a canvas. When `maxSize` is given the whole layout is
 * scaled down proportionally so it fits (used for the live preview).
 */
export function renderCollage(
  images: HTMLImageElement[],
  opts: CollageOptions,
  maxSize?: number,
): HTMLCanvasElement {
  const count = images.length;
  const { cols, rows } = collageGrid(opts, count);

  const rawWidth = opts.padding * 2 + cols * opts.cellSize + (cols - 1) * opts.gap;
  const rawHeight = opts.padding * 2 + rows * opts.cellSize + (rows - 1) * opts.gap;
  const scale =
    maxSize && Math.max(rawWidth, rawHeight) > maxSize ? maxSize / Math.max(rawWidth, rawHeight) : 1;

  const cell = opts.cellSize * scale;
  const gap = opts.gap * scale;
  const padding = opts.padding * scale;
  const radius = opts.radius * scale;

  const width = Math.max(1, Math.round(padding * 2 + cols * cell + (cols - 1) * gap));
  const height = Math.max(1, Math.round(padding * 2 + rows * cell + (rows - 1) * gap));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is unavailable in this browser.");
  ctx.imageSmoothingQuality = "high";

  if (!opts.transparent) {
    ctx.fillStyle = opts.background;
    ctx.fillRect(0, 0, width, height);
  }

  images.forEach((img, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    const cellX = padding + col * (cell + gap);
    const cellY = padding + row * (cell + gap);

    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;
    if (!iw || !ih) return;

    const cover = opts.fit === "cover";
    const s = cover ? Math.max(cell / iw, cell / ih) : Math.min(cell / iw, cell / ih);
    const dw = iw * s;
    const dh = ih * s;
    const dx = cellX + (cell - dw) / 2;
    const dy = cellY + (cell - dh) / 2;

    ctx.save();
    if (radius > 0) {
      roundRectPath(ctx, cellX, cellY, cell, cell, radius);
      ctx.clip();
    }
    ctx.drawImage(img, 0, 0, iw, ih, dx, dy, dw, dh);
    ctx.restore();
  });

  return canvas;
}

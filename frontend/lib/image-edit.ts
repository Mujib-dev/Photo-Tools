/**
 * Client-side image transform + export helpers.
 *
 * Everything here runs on a canvas in the browser: images are never uploaded,
 * so crop, rotate and flip stay fully offline like the Screenshot Studio.
 */

export type Rotation = 0 | 90 | 180 | 270;

export interface Transform {
  rotate: Rotation;
  flipH: boolean;
  flipV: boolean;
}

export const IDENTITY_TRANSFORM: Transform = { rotate: 0, flipH: false, flipV: false };

/** A crop rectangle in normalised (0–1) coordinates of the transformed image. */
export interface NormRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const FULL_RECT: NormRect = { x: 0, y: 0, width: 1, height: 1 };

export interface OutputFormat {
  value: string;
  label: string;
  mime: string;
  ext: string;
  lossy: boolean;
}

export const OUTPUT_FORMATS: OutputFormat[] = [
  { value: "png", label: "PNG", mime: "image/png", ext: "png", lossy: false },
  { value: "jpeg", label: "JPG", mime: "image/jpeg", ext: "jpg", lossy: true },
  { value: "webp", label: "WEBP", mime: "image/webp", ext: "webp", lossy: true },
];

export function getOutputFormat(value: string): OutputFormat {
  return OUTPUT_FORMATS.find((f) => f.value === value) ?? OUTPUT_FORMATS[0];
}

export function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not read that image file."));
    img.src = src;
  });
}

export function rotateBy(rotate: Rotation, delta: 90 | -90): Rotation {
  return ((((rotate + delta) % 360) + 360) % 360) as Rotation;
}

export function transformedSize(
  width: number,
  height: number,
  transform: Transform,
): { width: number; height: number } {
  const swap = transform.rotate === 90 || transform.rotate === 270;
  return swap ? { width: height, height: width } : { width, height };
}

/**
 * Draw `img` into a fresh canvas with the given rotate/flip applied. When
 * `maxSize` is set the output is scaled down to fit (used for fast previews).
 */
export function renderTransformed(
  img: HTMLImageElement,
  transform: Transform,
  maxSize?: number,
): HTMLCanvasElement {
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  const { width: tw, height: th } = transformedSize(w, h, transform);

  const scale = maxSize && Math.max(tw, th) > maxSize ? maxSize / Math.max(tw, th) : 1;
  const outW = Math.max(1, Math.round(tw * scale));
  const outH = Math.max(1, Math.round(th * scale));

  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is unavailable in this browser.");
  ctx.imageSmoothingQuality = "high";
  ctx.save();
  ctx.translate(outW / 2, outH / 2);
  ctx.rotate((transform.rotate * Math.PI) / 180);
  ctx.scale(transform.flipH ? -1 : 1, transform.flipV ? -1 : 1);
  const dw = w * scale;
  const dh = h * scale;
  ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
  ctx.restore();
  return canvas;
}

/** Crop a normalised rectangle out of an already-rendered canvas. */
export function cropCanvas(source: HTMLCanvasElement, rect: NormRect): HTMLCanvasElement {
  const w = source.width;
  const h = source.height;
  let x = Math.round(rect.x * w);
  let y = Math.round(rect.y * h);
  let cw = Math.round(rect.width * w);
  let ch = Math.round(rect.height * h);
  x = Math.max(0, Math.min(w - 1, x));
  y = Math.max(0, Math.min(h - 1, y));
  cw = Math.max(1, Math.min(w - x, cw));
  ch = Math.max(1, Math.min(h - y, ch));

  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is unavailable in this browser.");
  ctx.drawImage(source, x, y, cw, ch, 0, 0, cw, ch);
  return canvas;
}

export function canvasToBlob(canvas: HTMLCanvasElement, format: OutputFormat, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not export the image."))),
      format.mime,
      format.lossy ? Math.min(1, Math.max(0.1, quality)) : undefined,
    );
  });
}

/**
 * Largest rectangle centred in the unit square whose normalised width/height
 * ratio equals `normAspect`.
 */
export function fitAspectRect(normAspect: number): NormRect {
  if (!Number.isFinite(normAspect) || normAspect <= 0) return { ...FULL_RECT };
  if (normAspect >= 1) {
    const width = 1;
    const height = 1 / normAspect;
    return { x: 0, y: (1 - height) / 2, width, height };
  }
  const height = 1;
  const width = normAspect;
  return { x: (1 - width) / 2, y: 0, width, height };
}

export function baseName(name: string): string {
  return name.replace(/\.[^.]+$/, "") || "image";
}

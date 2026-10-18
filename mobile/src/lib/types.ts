/**
 * Wire contracts for the Photo Tools backend.
 *
 * These mirror `backend/src/api/jobs.routes.ts` (toPublicRecord) and the
 * per-tool settings validators. Keep in sync with `frontend/lib/types.ts`.
 */

export type JobState = "queued" | "processing" | "completed" | "failed";

export interface AuthUser {
  id: string;
  email: string;
}

export interface HealthInfo {
  status: string;
  queue: string;
  maxConcurrentJobs: number;
}

/**
 * Note: the backend reports "removebg" (no hyphen) for the remove-bg route,
 * and additionally reports "pdf" for PDF jobs.
 */
export type ToolOperation =
  | "resize"
  | "convert"
  | "enhance"
  | "scan"
  | "removebg"
  | "compress"
  | "watermark"
  | "pdf";

export interface JobRecord {
  id: string;
  operation: ToolOperation;
  state: JobState;
  /** Free-text human label such as "Resizing". Display only, never parse. */
  stage: string;
  error: string | null;
  inputFilename: string;
  inputSize: number;
  inputFormat: string;
  outputFilename: string | null;
  outputSize: number | null;
  outputFormat: string | null;
  /** Preferred download name; null unless the job completed. */
  downloadName: string | null;
  /** Epoch milliseconds. */
  createdAt: number;
  updatedAt: number;
  processedAt: number | null;
}

export interface SubmitResponse {
  jobId: string;
  status: JobState;
  operation: ToolOperation;
}

export interface ScanDetection {
  corners: [number, number][] | null;
}

/* ------------------------------------------------------------------ */
/* Per-tool settings (sent as the `settings` multipart field)          */
/* ------------------------------------------------------------------ */

export type ResizeMode = "cm" | "px";
export interface ResizeSettings {
  mode: ResizeMode;
  /** Centimetres when mode is "cm", otherwise pixels. */
  width: number;
  height: number;
  dpi: number;
  format: "jpg" | "png" | "bmp" | "tiff";
}

export interface ConvertSettings {
  sizes: number[];
  format: "ico" | "png" | "jpg" | "bmp" | "tiff" | "webp" | "gif";
}

export type EnhanceOutputFormat = "jpg" | "png" | "bmp" | "tiff" | "webp" | "gif";
export interface EnhanceSettings {
  auto: boolean;
  sharpness: number;
  contrast: number;
  saturation: number;
  brightness: number;
  denoise: 0 | 1 | 2;
  scale: number;
  aiUpscale?: 0 | 2 | 4;
  format: EnhanceOutputFormat;
}

export type RemoveBgBackground = "transparent" | "white" | "black";
export type RemoveBgOutputFormat = "png" | "jpg" | "webp";
export interface RemoveBgSettings {
  background: RemoveBgBackground;
  format: RemoveBgOutputFormat;
}

export type CompressOutputFormat = "keep" | "jpg" | "webp";
export interface CompressSettings {
  targetKb: number;
  format: CompressOutputFormat;
}

export type WatermarkPosition =
  | "center"
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right"
  | "tile";
export interface WatermarkSettings {
  text: string;
  position: WatermarkPosition;
  opacity: number;
  size: number;
  color: "white" | "black";
  format: EnhanceOutputFormat;
}

export type ScanMode = "auto" | "original" | "bw" | "grayscale" | "color" | "magic" | "removebg";
export type ScanRotation = 0 | 90 | 180 | 270;
export type ScanOutputFormat = "jpg" | "png" | "webp";

export interface ScanPageSettings {
  /** TL, TR, BR, BL corners in the displayed (rotated) image space. */
  corners: [number, number][] | null;
  rotate: ScanRotation;
  mode: ScanMode;
}

export interface ScanSettings {
  mode: ScanMode;
  format: ScanOutputFormat;
  pages: ScanPageSettings[];
}

export type PdfOp = "convert" | "merge" | "split" | "tojpg";

export type ToolSettings =
  | ResizeSettings
  | ConvertSettings
  | EnhanceSettings
  | RemoveBgSettings
  | CompressSettings
  | WatermarkSettings
  | ScanSettings
  | { op: PdfOp };

/* ------------------------------------------------------------------ */
/* Option catalogues — shared by the tool screens                      */
/* ------------------------------------------------------------------ */

export const ICO_SIZES = [16, 32, 48, 64, 128, 256] as const;

export interface ResizePreset {
  id: string;
  label: string;
  width: number;
  height: number;
  dpi: number;
  mode: ResizeMode;
}

export const RESIZE_PRESETS: ResizePreset[] = [
  { id: "passport", label: "Passport", width: 3.5, height: 4.5, dpi: 300, mode: "cm" },
  { id: "visa", label: "Visa", width: 3, height: 4, dpi: 300, mode: "cm" },
  { id: "email", label: "Email", width: 180, height: 180, dpi: 72, mode: "px" },
  { id: "linkedin", label: "LinkedIn", width: 400, height: 400, dpi: 72, mode: "px" },
  { id: "custom", label: "Custom", width: 640, height: 640, dpi: 96, mode: "px" },
];

export const RESIZE_FORMATS: { value: ResizeSettings["format"]; label: string }[] = [
  { value: "jpg", label: "JPG" },
  { value: "png", label: "PNG" },
  { value: "bmp", label: "BMP" },
  { value: "tiff", label: "TIFF" },
];

export const CONVERT_FORMATS: { value: ConvertSettings["format"]; label: string }[] = [
  { value: "ico", label: "ICO icon" },
  { value: "png", label: "PNG" },
  { value: "jpg", label: "JPG" },
  { value: "webp", label: "WebP" },
  { value: "gif", label: "GIF" },
  { value: "bmp", label: "BMP" },
  { value: "tiff", label: "TIFF" },
];

export const ENHANCE_FORMATS: { value: EnhanceOutputFormat; label: string }[] = [
  { value: "jpg", label: "JPG" },
  { value: "png", label: "PNG" },
  { value: "webp", label: "WebP" },
  { value: "gif", label: "GIF" },
  { value: "bmp", label: "BMP" },
  { value: "tiff", label: "TIFF" },
];

export const UPSCALE_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: "1x" },
  { value: 2, label: "2x" },
  { value: 4, label: "4x" },
];

export const AI_UPSCALE_OPTIONS: { value: 0 | 2 | 4; label: string }[] = [
  { value: 0, label: "Off" },
  { value: 2, label: "2x" },
  { value: 4, label: "4x" },
];

export const REMOVEBG_BACKGROUNDS: { value: RemoveBgBackground; label: string }[] = [
  { value: "transparent", label: "Transparent" },
  { value: "white", label: "White" },
  { value: "black", label: "Black" },
];

export const REMOVEBG_FORMATS: { value: RemoveBgOutputFormat; label: string }[] = [
  { value: "png", label: "PNG" },
  { value: "jpg", label: "JPG" },
  { value: "webp", label: "WebP" },
];

export const COMPRESS_FORMATS: { value: CompressOutputFormat; label: string }[] = [
  { value: "keep", label: "Keep format" },
  { value: "jpg", label: "JPG" },
  { value: "webp", label: "WebP" },
];

export const COMPRESS_PRESETS = [50, 100, 200, 500, 1000] as const;

export const WATERMARK_POSITIONS: { value: WatermarkPosition; label: string }[] = [
  { value: "center", label: "Centre" },
  { value: "top-left", label: "Top left" },
  { value: "top-right", label: "Top right" },
  { value: "bottom-left", label: "Bottom left" },
  { value: "bottom-right", label: "Bottom right" },
  { value: "tile", label: "Tiled" },
];

export const WATERMARK_COLORS: { value: "white" | "black"; label: string }[] = [
  { value: "white", label: "White" },
  { value: "black", label: "Black" },
];

export const SCAN_MODES: { value: ScanMode; label: string; desc: string }[] = [
  { value: "auto", label: "Auto", desc: "Let the engine choose per page" },
  { value: "original", label: "Original", desc: "Keep the photo as captured" },
  { value: "bw", label: "B & W", desc: "Pure black and white" },
  { value: "grayscale", label: "Greyscale", desc: "Shades of grey" },
  { value: "color", label: "Colour", desc: "Full colour" },
  { value: "magic", label: "Magic", desc: "Clean up and sharpen" },
  { value: "removebg", label: "No background", desc: "Remove the background" },
];

export const SCAN_FORMATS: { value: ScanOutputFormat; label: string }[] = [
  { value: "jpg", label: "JPG" },
  { value: "png", label: "PNG" },
  { value: "webp", label: "WebP" },
];

export const PDF_TOOLS: { op: PdfOp; label: string; desc: string }[] = [
  { op: "convert", label: "PDF to images", desc: "Render each page to an image" },
  { op: "merge", label: "Merge PDFs", desc: "Combine several PDFs into one" },
  { op: "split", label: "Split PDF", desc: "Split a PDF into separate files" },
  { op: "tojpg", label: "PDF to JPG", desc: "Render each page as a JPG" },
];

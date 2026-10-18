export type JobState = "queued" | "processing" | "completed" | "failed";

export interface AuthUser {
  id: string;
  email: string;
}

export type ToolOperation =
  | "resize"
  | "convert"
  | "enhance"
  | "scan"
  | "removebg"
  | "compress"
  | "watermark"
  | "video";

export interface JobRecord {
  id: string;
  operation: ToolOperation;
  state: JobState;
  stage: string;
  error: string | null;
  inputFilename: string;
  inputSize: number;
  inputFormat: string;
  outputFilename: string | null;
  outputSize: number | null;
  outputFormat: string | null;
  downloadName: string | null;
  createdAt: number;
  updatedAt: number;
  processedAt: number | null;
}

export interface SubmitResponse {
  jobId: string;
  status: JobState;
  operation: ToolOperation;
}

export type ResizeMode = "cm" | "px";

export interface ResizeSettings {
  mode: ResizeMode;
  width: number;
  height: number;
  dpi: number;
  format: "jpg" | "png" | "bmp" | "tiff";
}

export interface ConvertSettings {
  sizes: number[];
  format: "ico" | "png" | "jpg" | "bmp" | "tiff" | "webp" | "gif";
}

export const CONVERT_FORMATS: { value: ConvertSettings["format"]; label: string }[] = [
  { value: "ico", label: "ICO — multi-size icon" },
  { value: "jpg", label: "JPEG" },
  { value: "png", label: "PNG" },
  { value: "bmp", label: "BMP" },
  { value: "tiff", label: "TIFF" },
  { value: "webp", label: "WEBP" },
  { value: "gif", label: "GIF" },
];

export type EnhanceOutputFormat = "jpg" | "png" | "bmp" | "tiff" | "webp" | "gif";

/** Normalized (0..1) rectangle relative to the image, used for selective enhance. */
export interface EnhanceRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

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
  /** When set, only this area of the photo is enhanced. */
  region?: EnhanceRegion | null;
}

export const ENHANCE_FORMATS: { value: EnhanceOutputFormat; label: string }[] = [
  { value: "jpg", label: "JPEG" },
  { value: "png", label: "PNG" },
  { value: "webp", label: "WEBP" },
  { value: "bmp", label: "BMP" },
  { value: "tiff", label: "TIFF" },
  { value: "gif", label: "GIF" },
];

export const UPSCALE_OPTIONS = [1, 1.5, 2, 3, 4] as const;

export const AI_UPSCALE_OPTIONS: { value: 0 | 2 | 4; label: string }[] = [
  { value: 0, label: "Off" },
  { value: 2, label: "AI 2x" },
  { value: 4, label: "AI 4x" },
];

export type PdfOp = "convert" | "merge" | "split" | "tojpg" | "edit";

export interface PdfTool {
  op: PdfOp;
  label: string;
  desc: string;
}

export const PDF_TOOLS: PdfTool[] = [
  { op: "convert", label: "PDF to Word", desc: "Turn a PDF into an editable .docx document." },
  { op: "merge", label: "Merge PDFs", desc: "Combine several PDFs into one file." },
  { op: "split", label: "Split PDF", desc: "Split a PDF into single-page files (ZIP)." },
  { op: "tojpg", label: "PDF to JPG", desc: "Render every page as a JPG image (ZIP)." },
  {
    op: "edit",
    label: "Edit PDF",
    desc: "Reorder, rotate or delete pages, add text, images and drawings.",
  },
];

// --- PDF editor ---------------------------------------------------------
// The editor works in PDF points with the origin at the top-left of the
// rotated page, which is what the engine and the preview images both use.

export type PdfEditFont = "helv" | "hebo" | "cour" | "cobo";

export interface PdfEditPage {
  src: number;
  rotate: 0 | 90 | 180 | 270;
}

interface PdfEditBase {
  page: number;
}

export interface PdfEditText extends PdfEditBase {
  kind: "text";
  x: number;
  y: number;
  size: number;
  font: PdfEditFont;
  color: string;
  text: string;
}

export interface PdfEditImage extends PdfEditBase {
  kind: "image";
  x: number;
  y: number;
  w: number;
  h: number;
  /** Filename of the uploaded overlay; sent alongside the PDF. */
  asset: string;
}

export interface PdfEditStroke extends PdfEditBase {
  kind: "draw" | "highlight";
  color: string;
  width: number;
  opacity: number;
  points: [number, number][];
}

/**
 * Rewrites text that is already in the document. The engine finds `find` on
 * the page, paints over the original glyphs and redraws `text` on the same
 * baseline, so the line keeps flowing like a document instead of getting an
 * overlay pasted on top of it.
 */
export interface PdfEditReplace extends PdfEditBase {
  kind: "replace";
  /** Existing text to look for. */
  find: string;
  /** Replacement text; an empty string deletes the match. */
  text: string;
  /** 0-based match index, or -1 to replace every occurrence on the page. */
  occurrence: number;
  /** Overrides; omitted means reuse the original face, size and colour. */
  size?: number;
  color?: string;
  /** Background painted over the original glyphs. */
  bg?: string;
}

export type PdfEditAnnotation =
  | PdfEditText
  | PdfEditImage
  | PdfEditStroke
  | PdfEditReplace;

export interface PdfEditPlan {
  pages: PdfEditPage[];
  annotations: PdfEditAnnotation[];
  metadata: { title?: string; author?: string; subject?: string; keywords?: string };
}

/** One line of text already present in the PDF, in page points. */
export interface PdfTextLine {
  text: string;
  /** [x0, y0, x1, y1] of the line box. */
  bbox: [number, number, number, number];
  /** Baseline start point: [x, y] of the first character. */
  origin: [number, number];
  size: number;
  font: string;
  /** Packed sRGB integer as reported by the engine. */
  color: number;
}

export interface PdfPreviewPage {
  index: number;
  /** Page size in PDF points. */
  width: number;
  height: number;
  /** Existing text, used for click-to-edit. May be capped for huge pages. */
  lines?: PdfTextLine[];
  /** Total line count, which can exceed `lines.length`. */
  lineCount?: number;
}

export interface PdfPreview {
  token: string;
  dpi: number;
  pages: PdfPreviewPage[];
}

export const RESIZE_PRESETS: {
  id: string;
  label: string;
  mode: ResizeMode;
  width: number;
  height: number;
  dpi: number;
}[] = [
  { id: "passport", label: "Passport (3.5 × 4.5 cm)", mode: "cm", width: 3.5, height: 4.5, dpi: 300 },
  { id: "visa", label: "Visa (3 × 4 cm)", mode: "cm", width: 3.0, height: 4.0, dpi: 300 },
  { id: "us-passport", label: "US Passport (2 × 2 in / 5.1 × 5.1 cm)", mode: "cm", width: 5.08, height: 5.08, dpi: 300 },
  { id: "email", label: "Avatar / Icon (180 × 180)", mode: "px", width: 180, height: 180, dpi: 72 },
  { id: "linkedin", label: "Profile / Headshot (400 × 400)", mode: "px", width: 400, height: 400, dpi: 72 },
  { id: "ig-square", label: "Instagram Square (1080 × 1080)", mode: "px", width: 1080, height: 1080, dpi: 72 },
  { id: "ig-portrait", label: "Instagram Portrait (1080 × 1350)", mode: "px", width: 1080, height: 1350, dpi: 72 },
  { id: "yt-thumb", label: "YouTube Thumbnail (1280 × 720)", mode: "px", width: 1280, height: 720, dpi: 72 },
  { id: "story", label: "Story / TikTok (1080 × 1920)", mode: "px", width: 1080, height: 1920, dpi: 72 },
  { id: "custom", label: "Custom", mode: "px", width: 640, height: 640, dpi: 96 },
];

export const ICO_SIZES = [16, 32, 48, 64, 128, 256];

export type ScanMode = "auto" | "original" | "bw" | "grayscale" | "color" | "magic" | "removebg";export type ScanRotation = 0 | 90 | 180 | 270;
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

export const SCAN_MODES: { value: ScanMode; label: string; desc: string }[] = [
  { value: "auto", label: "Auto", desc: "Shadow removal, contrast and sharpening tuned per page." },
  { value: "original", label: "Original", desc: "No enhancement — only perspective correction." },
  { value: "bw", label: "Black & White", desc: "Clean binary text for crisp printouts." },
  { value: "grayscale", label: "Grayscale", desc: "Neutral gray scan with smooth tones." },
  { value: "color", label: "Color", desc: "Natural colour balance preserved." },
  { value: "magic", label: "Magic Color", desc: "Strong shadow removal + vivid colour." },
  { value: "removebg", label: "Remove BG", desc: "Pure white background with text and colours preserved." },
];

export const SCAN_FORMATS: { value: ScanOutputFormat; label: string }[] = [
  { value: "jpg", label: "JPEG" },
  { value: "png", label: "PNG" },
  { value: "webp", label: "WEBP" },
];

export type RemoveBgBackground = "transparent" | "white" | "black" | "custom";
export type RemoveBgOutputFormat = "png" | "jpg" | "webp";

export interface RemoveBgSettings {
  background: RemoveBgBackground;
  format: RemoveBgOutputFormat;
  /** Custom background color as 'r,g,b' or 'r,g,b,a' (0-255) when background="custom". */
  customColor?: string;
}

export const REMOVEBG_BACKGROUNDS: { value: RemoveBgBackground; label: string; desc: string }[] = [
  { value: "transparent", label: "Transparent", desc: "PNG/WebP with an alpha channel — drop the cut-out onto anything." },
  { value: "white", label: "White", desc: "Subject on a clean white background (passport-style)." },
  { value: "black", label: "Black", desc: "Subject on a solid black background." },
  { value: "custom", label: "Custom", desc: "Pick any solid color for the background." },
];

export const REMOVEBG_FORMATS: { value: RemoveBgOutputFormat; label: string }[] = [
  { value: "png", label: "PNG — keeps transparency" },
  { value: "jpg", label: "JPEG — white background" },
  { value: "webp", label: "WEBP — keeps transparency" },
];

export type CompressOutputFormat = "keep" | "jpg" | "webp";

export interface CompressSettings {
  targetKb: number;
  format: CompressOutputFormat;
}

export const COMPRESS_FORMATS: { value: CompressOutputFormat; label: string }[] = [
  { value: "keep", label: "Same as input" },
  { value: "jpg", label: "Force JPEG" },
  { value: "webp", label: "Force WEBP" },
];

export const COMPRESS_PRESETS = [50, 100, 200, 500, 1000] as const;

export type VideoMode = "target" | "quality";
export type VideoResolution = "source" | "2160" | "1080" | "720" | "480" | "360";
export type VideoFormat = "keep" | "mp4" | "webm";
export type VideoAudioMode = "keep" | "strip" | "bitrate";
export type VideoOutputKind = "video" | "gif" | "thumbnail" | "audio" | "frames";
export type VideoSpeed = 0.5 | 1 | 1.5 | 2;
export type VideoFps = 8 | 10 | 12 | 15 | 20 | 24;
export type ThumbnailFormat = "jpg" | "png";
export type VideoAudioFormat = "mp3" | "m4a" | "wav";
export type FrameFormat = "jpg" | "png";

export interface VideoSettings {
  output: VideoOutputKind;
  mode: VideoMode;
  targetKb: number;
  crf: number;
  resolution: VideoResolution;
  format: VideoFormat;
  audioMode: VideoAudioMode;
  audioKbps: number;
  trimStart: number;
  trimEnd: number;
  speed: VideoSpeed;
  fps: VideoFps;
  frameTime: number;
  thumbFormat: ThumbnailFormat;
  audioFormat: VideoAudioFormat;
  framesInterval: number;
  framesFormat: FrameFormat;
  framesMax: number;
}

export const VIDEO_TARGET_PRESETS = [5120, 10240, 25600, 51200, 102400] as const;

export const VIDEO_OUTPUT_KINDS: { value: VideoOutputKind; label: string }[] = [
  { value: "video", label: "Video" },
  { value: "gif", label: "GIF" },
  { value: "thumbnail", label: "Thumbnail" },
  { value: "audio", label: "Audio" },
  { value: "frames", label: "Frames" },
];

export const AUDIO_FORMATS: { value: VideoAudioFormat; label: string }[] = [
  { value: "mp3", label: "MP3" },
  { value: "m4a", label: "M4A (AAC)" },
  { value: "wav", label: "WAV" },
];

export const FRAME_FORMATS: { value: FrameFormat; label: string }[] = [
  { value: "jpg", label: "JPEG" },
  { value: "png", label: "PNG" },
];

export const FRAME_INTERVALS = [0.5, 1, 2, 5, 10, 30] as const;

export const VIDEO_SPEEDS: { value: VideoSpeed; label: string }[] = [
  { value: 0.5, label: "0.5× slow" },
  { value: 1, label: "Normal" },
  { value: 1.5, label: "1.5× fast" },
  { value: 2, label: "2× fast" },
];

export const VIDEO_FPS: { value: VideoFps; label: string }[] = [
  { value: 8, label: "8 fps" },
  { value: 10, label: "10 fps" },
  { value: 12, label: "12 fps" },
  { value: 15, label: "15 fps" },
  { value: 20, label: "20 fps" },
  { value: 24, label: "24 fps" },
];

export const THUMBNAIL_FORMATS: { value: ThumbnailFormat; label: string }[] = [
  { value: "jpg", label: "JPEG" },
  { value: "png", label: "PNG" },
];

export const VIDEO_RESOLUTIONS: { value: VideoResolution; label: string }[] = [
  { value: "source", label: "Keep original" },
  { value: "2160", label: "4K — 2160p" },
  { value: "1080", label: "Full HD — 1080p" },
  { value: "720", label: "HD — 720p" },
  { value: "480", label: "SD — 480p" },
  { value: "360", label: "Low — 360p" },
];

export const VIDEO_FORMATS: { value: VideoFormat; label: string }[] = [
  { value: "keep", label: "Same as input" },
  { value: "mp4", label: "MP4 (H.264)" },
  { value: "webm", label: "WEBM (VP9)" },
];

export const VIDEO_AUDIO_MODES: { value: VideoAudioMode; label: string }[] = [
  { value: "keep", label: "Keep audio" },
  { value: "strip", label: "Remove audio" },
  { value: "bitrate", label: "Set bitrate" },
];

export const VIDEO_AUDIO_BITRATES = [64, 96, 128, 192, 256, 320] as const;

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

export const WATERMARK_POSITIONS: { value: WatermarkPosition; label: string }[] = [
  { value: "center", label: "Center" },
  { value: "top-left", label: "Top left" },
  { value: "top-right", label: "Top right" },
  { value: "bottom-left", label: "Bottom left" },
  { value: "bottom-right", label: "Bottom right" },
  { value: "tile", label: "Tiled pattern" },
];

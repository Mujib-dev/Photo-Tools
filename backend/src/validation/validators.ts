import { Errors } from "../utils/errors.js";

export type ImageFormat = "jpeg" | "png" | "gif" | "webp" | "bmp" | "tiff";

export const RESIZE_OUTPUT_FORMATS = ["jpg", "jpeg", "png", "bmp", "tiff"] as const;
export type ResizeOutputFormat = (typeof RESIZE_OUTPUT_FORMATS)[number];

export interface ResizeSettings {
  mode: "cm" | "px";
  width: number;
  height: number;
  dpi: number;
  format: ResizeOutputFormat;
}

export const CONVERT_OUTPUT_FORMATS = ["ico", "png", "jpg", "jpeg", "bmp", "tiff", "webp", "gif"] as const;
export type ConvertOutputFormat = (typeof CONVERT_OUTPUT_FORMATS)[number];

export interface ConvertSettings {
  sizes: number[];
  format: ConvertOutputFormat;
}

export const ENHANCE_OUTPUT_FORMATS = ["jpg", "jpeg", "png", "bmp", "tiff", "webp", "gif"] as const;
export type EnhanceOutputFormat = (typeof ENHANCE_OUTPUT_FORMATS)[number];

/** Normalized (0..1) rectangle relative to the image, for selective enhance. */
export interface EnhanceRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface EnhanceSettings {
  auto: boolean;
  sharpness?: number;
  contrast?: number;
  saturation?: number;
  brightness?: number;
  denoise?: number;
  scale?: number;
  aiUpscale?: number;
  format: EnhanceOutputFormat;
  region?: EnhanceRegion;
}

export const SCAN_MODES = ["auto", "original", "bw", "grayscale", "color", "magic", "removebg"] as const;
export type ScanMode = (typeof SCAN_MODES)[number];

export const SCAN_OUTPUT_FORMATS = ["jpg", "png", "webp"] as const;
export type ScanOutputFormat = (typeof SCAN_OUTPUT_FORMATS)[number];

export const SCAN_MAX_PAGES = 10;
export const SCAN_ROTATIONS = [0, 90, 180, 270] as const;
export type ScanRotation = (typeof SCAN_ROTATIONS)[number];

export interface ScanPageSettings {
  /** TL, TR, BR, BL corners in the (exif-transposed, rotated) pixel space. */
  corners: [number, number][] | null;
  rotate: ScanRotation;
  mode: ScanMode;
  /** @internal Absolute path to the uploaded page image, set by the route. */
  inputPath: string;
}

export interface ScanSettings {
  mode: ScanMode;
  format: ScanOutputFormat;
  pages: ScanPageSettings[];
}

const MAGIC: { format: ImageFormat; match: (b: Buffer) => boolean }[] = [
  { format: "jpeg", match: (b) => b.length > 2 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  {
    format: "png",
    match: (b) =>
      b.length > 7 &&
      b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
      b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a,
  },
  { format: "gif", match: (b) => b.length > 5 && b.toString("latin1", 0, 4) === "GIF8" },
  { format: "bmp", match: (b) => b.length > 1 && b[0] === 0x42 && b[1] === 0x4d },
  {
    format: "tiff",
    match: (b) =>
      b.length > 3 &&
      ((b[0] === 0x49 && b[1] === 0x49 && b[2] === 0x2a && b[3] === 0x00) ||
        (b[0] === 0x4d && b[1] === 0x4d && b[2] === 0x00 && b[3] === 0x2a)),
  },
  {
    format: "webp",
    match: (b) =>
      b.length > 11 &&
      b.toString("latin1", 0, 4) === "RIFF" &&
      b.toString("latin1", 8, 12) === "WEBP",
  },
];

const EXTENSION_TO_FORMAT: Record<string, ImageFormat> = {
  ".jpg": "jpeg",
  ".jpeg": "jpeg",
  ".png": "png",
  ".gif": "gif",
  ".bmp": "bmp",
  ".tiff": "tiff",
  ".tif": "tiff",
  ".webp": "webp",
};

export function detectImageFormat(buffer: Buffer, originalName: string): ImageFormat {
  const byMagic = MAGIC.find((m) => m.match(buffer));
  if (byMagic) return byMagic.format;

  const ext = originalName.slice(originalName.lastIndexOf(".")).toLowerCase();
  const byExt = EXTENSION_TO_FORMAT[ext];
  if (byExt) return byExt;

  throw Errors.unsupportedFormat();
}

/** Maps a format to the file extension used for the internal output filename. */
export function outputExtension(format: ResizeOutputFormat): string {
  return format === "jpeg" ? "jpg" : format;
}

/** File extension used when persisting an uploaded input image. */
export function formatExtension(format: ImageFormat): string {
  return format === "jpeg" ? "jpg" : format;
}

/**
 * Sanitize a user-supplied file name so it can never influence filesystem
 * paths: strips directories, path separators and reserved characters.
 */
export function sanitizeBaseName(rawName: string, fallback = "image"): string {
  const base = rawName.split(/[\\/]/).pop() ?? "";
  const cleaned = base
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")
    .replace(/\.{2,}/g, "_")
    .trim()
    .slice(0, 80);
  const withoutExt = cleaned.replace(/\.[a-zA-Z0-9]{1,5}$/, "");
  return withoutExt || fallback;
}

function finitePositive(v: unknown, label: string): number {
  const n = typeof v === "string" ? Number.parseFloat(v) : v;
  if (typeof n !== "number" || !Number.isFinite(n) || n <= 0) {
    throw Errors.invalidSettings(`${label} must be a positive number.`);
  }
  return n;
}

export function parseResizeSettings(raw: unknown): ResizeSettings {
  if (typeof raw !== "object" || raw === null) throw Errors.invalidSettings();
  const r = raw as Record<string, unknown>;

  const mode = r.mode === "px" ? "px" : r.mode === "cm" ? "cm" : null;
  if (!mode) throw Errors.invalidSettings("mode must be 'cm' or 'px'.");

  const width = finitePositive(r.width, "width");
  const height = finitePositive(r.height, "height");

  const widthMax = mode === "px" ? 4000 : 500;
  const heightMax = mode === "px" ? 4000 : 500;
  if (width > widthMax || height > heightMax) {
    throw Errors.invalidSettings(
      mode === "px" ? "Dimensions must not exceed 4000 px." : "Dimensions must not exceed 500 cm.",
    );
  }

  let dpi = 72;
  if (r.dpi !== undefined) {
    dpi = Math.round(finitePositive(r.dpi, "dpi"));
    if (dpi > 1200) throw Errors.invalidSettings("dpi must not exceed 1200.");
  }

  let format: ResizeOutputFormat = "jpg";
  if (r.format !== undefined) {
    const f = String(r.format).toLowerCase();
    if (!(RESIZE_OUTPUT_FORMATS as readonly string[]).includes(f)) {
      throw Errors.invalidSettings("format must be one of jpg, png, bmp, tiff.");
    }
    format = f as ResizeOutputFormat;
  }

  return { mode, width, height, dpi, format };
}

export function parseConvertSettings(raw: unknown): ConvertSettings {
  if (typeof raw !== "object" || raw === null) throw Errors.invalidSettings();
  const r = raw as Record<string, unknown>;

  let format: ConvertOutputFormat = "ico";
  if (r.format !== undefined) {
    const f = String(r.format).toLowerCase();
    if (!(CONVERT_OUTPUT_FORMATS as readonly string[]).includes(f)) {
      throw Errors.invalidSettings("format must be one of ico, png, jpg, jpeg, bmp, tiff, webp, gif.");
    }
    format = f as ConvertOutputFormat;
  }

  const rawSizes = r.sizes === undefined ? "16,32,48,64,128,256" : r.sizes;
  const list = Array.isArray(rawSizes)
    ? rawSizes
    : String(rawSizes)
        .split(/[,;]/)
        .map((s) => s.trim());

  const sizes = list.map((s) => Number.parseInt(String(s), 10)).filter((n) => Number.isInteger(n) && n > 0 && n <= 512);
  const unique = [...new Set(sizes)].sort((a, b) => a - b);
  if (format === "ico" && unique.length === 0) {
    throw Errors.invalidSettings("At least one valid icon size (1–512) is required.");
  }

  return { sizes: unique, format };
}

function optionalNumber(
  r: Record<string, unknown>,
  key: string,
  min: number,
  max: number,
): number | undefined {
  if (r[key] === undefined) return undefined;
  const n = Number(r[key]);
  if (typeof n !== "number" || !Number.isFinite(n)) {
    throw Errors.invalidSettings(`${key} must be a number.`);
  }
  return Math.min(max, Math.max(min, n));
}

export function parseEnhanceSettings(raw: unknown): EnhanceSettings {
  if (typeof raw !== "object" || raw === null) throw Errors.invalidSettings();
  const r = raw as Record<string, unknown>;

  let format: EnhanceOutputFormat = "jpg";
  if (r.format !== undefined) {
    const f = String(r.format).toLowerCase();
    if (!(ENHANCE_OUTPUT_FORMATS as readonly string[]).includes(f)) {
      throw Errors.invalidSettings("format must be one of jpg, png, bmp, tiff, webp, gif.");
    }
    format = f as EnhanceOutputFormat;
  }

  let auto = true;
  if (r.auto !== undefined) auto = r.auto === true || r.auto === "true" || r.auto === 1;

  let denoise: number | undefined;
  if (r.denoise !== undefined) {
    const n = Number(r.denoise);
    if (!Number.isInteger(n) || n < 0 || n > 2) {
      throw Errors.invalidSettings("denoise must be 0, 1 or 2.");
    }
    denoise = n;
  }

  let aiUpscale: number | undefined;
  if (r.aiUpscale !== undefined) {
    const n = Number(r.aiUpscale);
    if (n !== 0 && n !== 2 && n !== 4) {
      throw Errors.invalidSettings("aiUpscale must be 0, 2 or 4.");
    }
    aiUpscale = n;
  }

  return {
    auto,
    format,
    sharpness: optionalNumber(r, "sharpness", 0, 2),
    contrast: optionalNumber(r, "contrast", 0, 2),
    saturation: optionalNumber(r, "saturation", 0, 2),
    brightness: optionalNumber(r, "brightness", 0, 2),
    denoise,
    scale: optionalNumber(r, "scale", 1, 4),
    aiUpscale,
    region: parseEnhanceRegion(r.region),
  };
}

function parseEnhanceRegion(raw: unknown): EnhanceRegion | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== "object" || Array.isArray(raw)) {
    throw Errors.invalidSettings("region must be an object with x, y, width and height.");
  }
  const r = raw as Record<string, unknown>;
  const [rx, ry, rw, rh] = ["x", "y", "width", "height"].map((k) => Number(r[k]));
  if (![rx, ry, rw, rh].every((n) => Number.isFinite(n))) {
    throw Errors.invalidSettings("region x, y, width and height must be numbers.");
  }
  const x = Math.min(1, Math.max(0, rx));
  const y = Math.min(1, Math.max(0, ry));
  const width = Math.min(1 - x, Math.max(0, rw));
  const height = Math.min(1 - y, Math.max(0, rh));
  if (width <= 0 || height <= 0) {
    throw Errors.invalidSettings("region must have a positive width and height inside the image.");
  }
  return { x, y, width, height };
}

function parseCorners(raw: unknown): [number, number][] | null {
  if (raw === null || raw === undefined) return null;
  if (!Array.isArray(raw) || raw.length !== 4) {
    throw Errors.invalidSettings("corners must be a list of 4 points [x, y].");
  }
  const corners: [number, number][] = [];
  for (const pt of raw) {
    if (!Array.isArray(pt) || pt.length !== 2) {
      throw Errors.invalidSettings("Each corner must be an [x, y] pair.");
    }
    const x = Number(pt[0]);
    const y = Number(pt[1]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      throw Errors.invalidSettings("Corner coordinates must be numbers.");
    }
    corners.push([x, y]);
  }
  return corners;
}

function parseScanPage(raw: unknown, defaultMode: ScanMode): ScanPageSettings {
  if (typeof raw !== "object" || raw === null) throw Errors.invalidSettings();
  const r = raw as Record<string, unknown>;

  let mode: ScanMode = defaultMode;
  if (r.mode !== undefined) {
    const m = String(r.mode).toLowerCase();
    if (!(SCAN_MODES as readonly string[]).includes(m)) {
      throw Errors.invalidSettings("mode must be one of auto, original, bw, grayscale, color, magic, removebg.");
    }
    mode = m as ScanMode;
  }

  let rotate: ScanRotation = 0;
  if (r.rotate !== undefined) {
    const n = Number(r.rotate);
    if (!SCAN_ROTATIONS.includes(n as ScanRotation)) {
      throw Errors.invalidSettings("rotate must be 0, 90, 180 or 270.");
    }
    rotate = n as ScanRotation;
  }

  return { corners: parseCorners(r.corners), rotate, mode, inputPath: "" };
}

export function parseScanSettings(raw: unknown): ScanSettings {
  if (typeof raw !== "object" || raw === null) throw Errors.invalidSettings();
  const r = raw as Record<string, unknown>;

  let mode: ScanMode = "auto";
  if (r.mode !== undefined) {
    const m = String(r.mode).toLowerCase();
    if (!(SCAN_MODES as readonly string[]).includes(m)) {
      throw Errors.invalidSettings("mode must be one of auto, original, bw, grayscale, color, magic, removebg.");
    }
    mode = m as ScanMode;
  }

  let format: ScanOutputFormat = "png";
  if (r.format !== undefined) {
    const f = String(r.format).toLowerCase();
    if (!(SCAN_OUTPUT_FORMATS as readonly string[]).includes(f)) {
      throw Errors.invalidSettings("format must be one of jpg, png, webp.");
    }
    format = f as ScanOutputFormat;
  }

  const rawPages = r.pages ?? [];
  if (!Array.isArray(rawPages) || rawPages.length === 0 || rawPages.length > SCAN_MAX_PAGES) {
    throw Errors.invalidSettings(`pages must contain between 1 and ${SCAN_MAX_PAGES} entries.`);
  }

  const pages = rawPages.map((p) => parseScanPage(p, mode));
  return { mode, format, pages };
}

export const REMOVEBG_BACKGROUNDS = ["transparent", "white", "black", "custom"] as const;
export type RemoveBgBackground = (typeof REMOVEBG_BACKGROUNDS)[number];

export const REMOVEBG_OUTPUT_FORMATS = ["png", "jpg", "webp"] as const;
export type RemoveBgOutputFormat = (typeof REMOVEBG_OUTPUT_FORMATS)[number];

export interface RemoveBgSettings {
  background: RemoveBgBackground;
  format: RemoveBgOutputFormat;
  /** Custom background color as 'r,g,b' or 'r,g,b,a' (0-255) when background="custom". */
  customColor?: string;
}

export function parseRemoveBgSettings(raw: unknown): RemoveBgSettings {
  if (typeof raw !== "object" || raw === null) throw Errors.invalidSettings();
  const r = raw as Record<string, unknown>;

  let background: RemoveBgBackground = "transparent";
  if (r.background !== undefined) {
    const b = String(r.background).toLowerCase();
    if (!(REMOVEBG_BACKGROUNDS as readonly string[]).includes(b)) {
      throw Errors.invalidSettings("background must be one of transparent, white, black, custom.");
    }
    background = b as RemoveBgBackground;
  }

  let format: RemoveBgOutputFormat = "png";
  if (r.format !== undefined) {
    const f = String(r.format).toLowerCase();
    if (!(REMOVEBG_OUTPUT_FORMATS as readonly string[]).includes(f)) {
      throw Errors.invalidSettings("format must be one of png, jpg, webp.");
    }
    format = f as RemoveBgOutputFormat;
  }

  let customColor: string | undefined;
  if (r.customColor !== undefined) {
    const c = String(r.customColor).trim();
    if (c) {
      // Validate format: r,g,b or r,g,b,a (0-255)
      const parts = c.split(",").map((p) => parseInt(p.trim(), 10));
      if (parts.length < 3 || parts.length > 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
        throw Errors.invalidSettings("customColor must be 'r,g,b' or 'r,g,b,a' with values 0-255.");
      }
      customColor = c;
    }
  }

  return { background, format, customColor };
}

export const COMPRESS_OUTPUT_FORMATS = ["keep", "jpg", "webp"] as const;
export type CompressOutputFormat = (typeof COMPRESS_OUTPUT_FORMATS)[number];

export interface CompressSettings {
  targetKb: number;
  format: CompressOutputFormat;
}

export function parseCompressSettings(raw: unknown): CompressSettings {
  if (typeof raw !== "object" || raw === null) throw Errors.invalidSettings();
  const r = raw as Record<string, unknown>;

  const targetKb = Math.round(finitePositive(r.targetKb, "targetKb"));
  if (targetKb < 10 || targetKb > 20_000) {
    throw Errors.invalidSettings("targetKb must be between 10 and 20000.");
  }

  let format: CompressOutputFormat = "keep";
  if (r.format !== undefined) {
    const f = String(r.format).toLowerCase();
    if (!(COMPRESS_OUTPUT_FORMATS as readonly string[]).includes(f)) {
      throw Errors.invalidSettings("format must be one of keep, jpg, webp.");
    }
    format = f as CompressOutputFormat;
  }

  return { targetKb, format };
}

export type VideoFormat = "mp4" | "webm" | "mkv" | "avi" | "mov" | "mpeg" | "flv";

export const VIDEO_RESOLUTIONS = ["source", "2160", "1080", "720", "480", "360"] as const;
export type VideoResolution = (typeof VIDEO_RESOLUTIONS)[number];

export const VIDEO_FORMATS = ["keep", "mp4", "webm"] as const;
export type VideoFormatSetting = (typeof VIDEO_FORMATS)[number];

export const VIDEO_AUDIO_MODES = ["keep", "strip", "bitrate"] as const;
export type VideoAudioMode = (typeof VIDEO_AUDIO_MODES)[number];

/**
 * What the tool produces: a re-encoded video, an animated GIF, a still frame,
 * the extracted audio track, or a ZIP of sampled still frames.
 */
export const VIDEO_OUTPUT_KINDS = ["video", "gif", "thumbnail", "audio", "frames"] as const;
export type VideoOutputKind = (typeof VIDEO_OUTPUT_KINDS)[number];

export const VIDEO_AUDIO_FORMATS = ["mp3", "m4a", "wav"] as const;
export type VideoAudioFormat = (typeof VIDEO_AUDIO_FORMATS)[number];

export const FRAME_FORMATS = ["jpg", "png"] as const;
export type FrameFormat = (typeof FRAME_FORMATS)[number];

export const VIDEO_SPEEDS = [0.5, 1, 1.5, 2] as const;
export type VideoSpeed = (typeof VIDEO_SPEEDS)[number];

export const VIDEO_FPS = [8, 10, 12, 15, 20, 24] as const;
export type VideoFps = (typeof VIDEO_FPS)[number];

export const THUMBNAIL_FORMATS = ["jpg", "png"] as const;
export type ThumbnailFormat = (typeof THUMBNAIL_FORMATS)[number];

export interface VideoSettings {
  output: VideoOutputKind;
  mode: "target" | "quality";
  targetKb: number;
  crf: number;
  resolution: VideoResolution;
  format: VideoFormatSetting;
  audioMode: VideoAudioMode;
  audioKbps: number;
  /** Trim in seconds; `trimEnd` of 0 means "until the end". */
  trimStart: number;
  trimEnd: number;
  speed: VideoSpeed;
  /** GIF frame rate. */
  fps: VideoFps;
  /** Capture time (seconds) for a thumbnail. */
  frameTime: number;
  thumbFormat: ThumbnailFormat;
  /** Container/codec for extracted audio. */
  audioFormat: VideoAudioFormat;
  /** Seconds between sampled frames when exporting stills. */
  framesInterval: number;
  /** Image format for exported still frames. */
  framesFormat: FrameFormat;
  /** Upper bound on the number of exported frames. */
  framesMax: number;
}

const VIDEO_MAGIC: { format: VideoFormat; match: (b: Buffer) => boolean }[] = [
  // ISO base media (MP4/MOV/M4V) — an `ftyp` box at byte offset 4.
  { format: "mp4", match: (b) => b.length > 11 && b.toString("latin1", 4, 8) === "ftyp" },
  // Matroska / WebM — EBML header.
  {
    format: "webm",
    match: (b) => b.length > 3 && b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3,
  },
  {
    format: "avi",
    match: (b) =>
      b.length > 11 && b.toString("latin1", 0, 4) === "RIFF" && b.toString("latin1", 8, 12) === "AVI ",
  },
  // MPEG program/transport stream start codes.
  {
    format: "mpeg",
    match: (b) =>
      b.length > 3 && b[0] === 0x00 && b[1] === 0x00 && b[2] === 0x01 && (b[3] === 0xba || b[3] === 0xb3),
  },
  { format: "flv", match: (b) => b.length > 2 && b.toString("latin1", 0, 3) === "FLV" },
];

const VIDEO_EXTENSION_TO_FORMAT: Record<string, VideoFormat> = {
  ".mp4": "mp4",
  ".m4v": "mp4",
  ".mov": "mov",
  ".webm": "webm",
  ".mkv": "mkv",
  ".avi": "avi",
  ".mpg": "mpeg",
  ".mpeg": "mpeg",
  ".flv": "flv",
};

/** Identify a video container from its magic bytes, falling back to extension. */
export function detectVideoFormat(buffer: Buffer, originalName: string): VideoFormat {
  const byMagic = VIDEO_MAGIC.find((m) => m.match(buffer));
  if (byMagic) return byMagic.format;

  const ext = originalName.slice(originalName.lastIndexOf(".")).toLowerCase();
  const byExt = VIDEO_EXTENSION_TO_FORMAT[ext];
  if (byExt) return byExt;

  throw Errors.unsupportedVideoFormat();
}

export function videoFormatExtension(format: VideoFormat): string {
  return format === "mpeg" ? "mpg" : format;
}

export function parseVideoSettings(raw: unknown): VideoSettings {
  if (typeof raw !== "object" || raw === null) throw Errors.invalidSettings();
  const r = raw as Record<string, unknown>;

  const mode = r.mode === "quality" ? "quality" : "target";

  let targetKb = 10_240;
  if (r.targetKb !== undefined) {
    targetKb = Math.round(finitePositive(r.targetKb, "targetKb"));
    if (targetKb < 100 || targetKb > 500_000) {
      throw Errors.invalidSettings("targetKb must be between 100 and 500000.");
    }
  }

  let crf = 28;
  if (r.crf !== undefined) {
    const n = Number(r.crf);
    if (!Number.isFinite(n) || n < 0 || n > 51) {
      throw Errors.invalidSettings("crf must be between 0 and 51.");
    }
    crf = Math.round(n);
  }

  let resolution: VideoResolution = "source";
  if (r.resolution !== undefined && r.resolution !== null && String(r.resolution) !== "") {
    const v = String(r.resolution).toLowerCase();
    if (!(VIDEO_RESOLUTIONS as readonly string[]).includes(v)) {
      throw Errors.invalidSettings("resolution must be one of source, 2160, 1080, 720, 480, 360.");
    }
    resolution = v as VideoResolution;
  }

  let format: VideoFormatSetting = "keep";
  if (r.format !== undefined) {
    const f = String(r.format).toLowerCase();
    if (!(VIDEO_FORMATS as readonly string[]).includes(f)) {
      throw Errors.invalidSettings("format must be one of keep, mp4, webm.");
    }
    format = f as VideoFormatSetting;
  }

  let audioMode: VideoAudioMode = "keep";
  if (r.audioMode !== undefined) {
    const a = String(r.audioMode).toLowerCase();
    if (!(VIDEO_AUDIO_MODES as readonly string[]).includes(a)) {
      throw Errors.invalidSettings("audioMode must be one of keep, strip, bitrate.");
    }
    audioMode = a as VideoAudioMode;
  }

  let audioKbps = 128;
  if (r.audioKbps !== undefined) {
    const n = Number(r.audioKbps);
    if (!Number.isFinite(n) || n < 32 || n > 320) {
      throw Errors.invalidSettings("audioKbps must be between 32 and 320.");
    }
    audioKbps = Math.round(n);
  }

  let output: VideoOutputKind = "video";
  if (r.output !== undefined && r.output !== null && String(r.output) !== "") {
    const o = String(r.output).toLowerCase();
    if (!(VIDEO_OUTPUT_KINDS as readonly string[]).includes(o)) {
      throw Errors.invalidSettings("output must be one of video, gif, thumbnail, audio, frames.");
    }
    output = o as VideoOutputKind;
  }

  let trimStart = 0;
  if (r.trimStart !== undefined && r.trimStart !== null && r.trimStart !== "") {
    const n = Number(r.trimStart);
    if (!Number.isFinite(n) || n < 0 || n > 86_400) {
      throw Errors.invalidSettings("trimStart must be between 0 and 86400 seconds.");
    }
    trimStart = Math.round(n * 1000) / 1000;
  }

  let trimEnd = 0;
  if (r.trimEnd !== undefined && r.trimEnd !== null && r.trimEnd !== "") {
    const n = Number(r.trimEnd);
    if (!Number.isFinite(n) || n < 0 || n > 86_400) {
      throw Errors.invalidSettings("trimEnd must be between 0 and 86400 seconds.");
    }
    trimEnd = Math.round(n * 1000) / 1000;
  }
  if (trimEnd > 0 && trimEnd <= trimStart) {
    throw Errors.invalidSettings("trimEnd must be greater than trimStart.");
  }

  let speed: VideoSpeed = 1;
  if (r.speed !== undefined && r.speed !== null && r.speed !== "") {
    const n = Number(r.speed);
    if (!(VIDEO_SPEEDS as readonly number[]).includes(n)) {
      throw Errors.invalidSettings("speed must be one of 0.5, 1, 1.5, 2.");
    }
    speed = n as VideoSpeed;
  }

  let fps: VideoFps = 12;
  if (r.fps !== undefined && r.fps !== null && r.fps !== "") {
    const n = Number(r.fps);
    if (!(VIDEO_FPS as readonly number[]).includes(n)) {
      throw Errors.invalidSettings("fps must be one of 8, 10, 12, 15, 20, 24.");
    }
    fps = n as VideoFps;
  }

  let frameTime = 0;
  if (r.frameTime !== undefined && r.frameTime !== null && r.frameTime !== "") {
    const n = Number(r.frameTime);
    if (!Number.isFinite(n) || n < 0 || n > 86_400) {
      throw Errors.invalidSettings("frameTime must be between 0 and 86400 seconds.");
    }
    frameTime = Math.round(n * 1000) / 1000;
  }

  let thumbFormat: ThumbnailFormat = "jpg";
  if (r.thumbFormat !== undefined && r.thumbFormat !== null && r.thumbFormat !== "") {
    const t = String(r.thumbFormat).toLowerCase();
    if (!(THUMBNAIL_FORMATS as readonly string[]).includes(t)) {
      throw Errors.invalidSettings("thumbFormat must be one of jpg, png.");
    }
    thumbFormat = t as ThumbnailFormat;
  }

  let audioFormat: VideoAudioFormat = "mp3";
  if (r.audioFormat !== undefined && r.audioFormat !== null && r.audioFormat !== "") {
    const a = String(r.audioFormat).toLowerCase();
    if (!(VIDEO_AUDIO_FORMATS as readonly string[]).includes(a)) {
      throw Errors.invalidSettings("audioFormat must be one of mp3, m4a, wav.");
    }
    audioFormat = a as VideoAudioFormat;
  }

  let framesInterval = 1;
  if (r.framesInterval !== undefined && r.framesInterval !== null && r.framesInterval !== "") {
    const n = Number(r.framesInterval);
    if (!Number.isFinite(n) || n < 0.1 || n > 3600) {
      throw Errors.invalidSettings("framesInterval must be between 0.1 and 3600 seconds.");
    }
    framesInterval = Math.round(n * 100) / 100;
  }

  let framesFormat: FrameFormat = "jpg";
  if (r.framesFormat !== undefined && r.framesFormat !== null && r.framesFormat !== "") {
    const f = String(r.framesFormat).toLowerCase();
    if (!(FRAME_FORMATS as readonly string[]).includes(f)) {
      throw Errors.invalidSettings("framesFormat must be one of jpg, png.");
    }
    framesFormat = f as FrameFormat;
  }

  let framesMax = 300;
  if (r.framesMax !== undefined && r.framesMax !== null && r.framesMax !== "") {
    const n = Number(r.framesMax);
    if (!Number.isFinite(n) || n < 1 || n > 2000) {
      throw Errors.invalidSettings("framesMax must be between 1 and 2000.");
    }
    framesMax = Math.round(n);
  }

  return {
    output,
    mode,
    targetKb,
    crf,
    resolution,
    format,
    audioMode,
    audioKbps,
    trimStart,
    trimEnd,
    speed,
    fps,
    frameTime,
    thumbFormat,
    audioFormat,
    framesInterval,
    framesFormat,
    framesMax,
  };
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

const WATERMARK_POSITIONS: WatermarkPosition[] = [
  "center",
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right",
  "tile",
];

function sanitizeWatermarkText(raw: unknown): string {
  const text = String(raw ?? "")
    // Strip control characters and cap length; the text is drawn as pixels
    // by the engine, never embedded as metadata.
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, "")
    .trim()
    .slice(0, 60);
  if (!text) throw Errors.invalidSettings("watermark text must not be empty.");
  return text;
}

export function parseWatermarkSettings(raw: unknown): WatermarkSettings {
  if (typeof raw !== "object" || raw === null) throw Errors.invalidSettings();
  const r = raw as Record<string, unknown>;

  const text = sanitizeWatermarkText(r.text);

  let position: WatermarkPosition = "center";
  if (r.position !== undefined) {
    const p = String(r.position).toLowerCase();
    if (!WATERMARK_POSITIONS.includes(p as WatermarkPosition)) {
      throw Errors.invalidSettings(
        "position must be one of center, top-left, top-right, bottom-left, bottom-right, tile.",
      );
    }
    position = p as WatermarkPosition;
  }

  let opacity = 40;
  if (r.opacity !== undefined) {
    const n = Number(r.opacity);
    if (typeof n !== "number" || !Number.isFinite(n) || n < 5 || n > 100) {
      throw Errors.invalidSettings("opacity must be between 5 and 100.");
    }
    opacity = Math.round(n);
  }

  let size = 8;
  if (r.size !== undefined) {
    const n = Number(r.size);
    if (typeof n !== "number" || !Number.isFinite(n) || n < 2 || n > 30) {
      throw Errors.invalidSettings("size must be between 2 and 30 (% of image width).");
    }
    size = Math.round(n);
  }

  let color: "white" | "black" = "white";
  if (r.color !== undefined) {
    color = String(r.color).toLowerCase() === "black" ? "black" : "white";
  }

  let format: EnhanceOutputFormat = "jpg";
  if (r.format !== undefined) {
    const f = String(r.format).toLowerCase();
    if (!(ENHANCE_OUTPUT_FORMATS as readonly string[]).includes(f)) {
      throw Errors.invalidSettings("format must be one of jpg, png, bmp, tiff, webp, gif.");
    }
    format = f as EnhanceOutputFormat;
  }

  return { text, position, opacity, size, color, format };
}

export const PDF_OPS = ["convert", "merge", "split", "tojpg", "edit"] as const;
export type PdfOp = (typeof PDF_OPS)[number];

export const PDF_MAX_FILES = 10;

/** How many pages a single edit plan may keep. */
export const PDF_MAX_EDIT_PAGES = 500;
/** Upper bound on overlays so a single job cannot balloon the engine. */
export const PDF_MAX_ANNOTATIONS = 2000;

export type PdfEditFont = "helv" | "hebo" | "cour" | "cobo";
export type PdfAnnotationKind = "text" | "image" | "draw" | "highlight" | "replace";

/** One entry of the page plan; the array order is the order of the result. */
export interface PdfEditPage {
  src: number;
  rotate: 0 | 90 | 180 | 270;
}

export interface PdfEditText {
  kind: "text";
  page: number;
  x: number;
  y: number;
  size: number;
  font: PdfEditFont;
  color: string;
  text: string;
}

export interface PdfEditImage {
  kind: "image";
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Uploaded asset filename, resolved to an absolute path by the service. */
  asset: string;
}

export interface PdfEditStroke {
  kind: "draw" | "highlight";
  page: number;
  color: string;
  width: number;
  opacity: number;
  points: [number, number][];
}

/**
 * Rewrites text that is already in the document. The engine locates `find` on
 * the page, paints over the original glyphs and redraws `text` on the same
 * baseline, so the line keeps flowing instead of gaining an overlay.
 */
export interface PdfEditReplace {
  kind: "replace";
  page: number;
  /** Existing text to look for. */
  find: string;
  /** Replacement text; an empty string deletes the match. */
  text: string;
  /** 0-based match index, or -1 to replace every occurrence. */
  occurrence: number;
  /** Overrides; when omitted the original face, size and colour are reused. */
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

export interface PdfEditMetadata {
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string;
}

export interface PdfEditPlan {
  pages: PdfEditPage[];
  annotations: PdfEditAnnotation[];
  metadata: PdfEditMetadata;
}

export interface PdfSettings {
  op: PdfOp;
  inputsDir: string;
  inputFiles: string[];
  /** Present for the "edit" op only. */
  plan: PdfEditPlan;
}

const PDF_EDIT_FONTS: PdfEditFont[] = ["helv", "hebo", "cour", "cobo"];

/** PDF user space is bounded well below this; anything larger is a mistake. */
const PDF_MAX_COORD = 20_000;

function pdfNumber(raw: unknown, fallback: number): number {
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function pdfColor(raw: unknown, fallback = "#000000"): string {
  const text = String(raw ?? "").trim();
  if (/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(text)) return text.toLowerCase();
  return fallback;
}

function pdfAssetName(raw: unknown): string {
  // Only a bare filename is allowed; the service joins it onto inputsDir.
  const name = String(raw ?? "").trim();
  if (!/^[\w][\w .-]{0,120}$/.test(name) || name.includes("..")) {
    throw Errors.invalidSettings("Overlay images must reference an uploaded file.");
  }
  return name;
}

function pdfPoints(raw: unknown): [number, number][] {
  if (!Array.isArray(raw)) return [];
  const points: [number, number][] = [];
  for (const item of raw) {
    if (!Array.isArray(item) || item.length < 2) continue;
    points.push([
      Math.max(0, Math.min(PDF_MAX_COORD, pdfNumber(item[0], 0))),
      Math.max(0, Math.min(PDF_MAX_COORD, pdfNumber(item[1], 0))),
    ]);
    if (points.length >= 20_000) break;
  }
  return points;
}

function parsePdfEditPlan(raw: unknown): PdfEditPlan {
  if (typeof raw !== "object" || raw === null) {
    throw Errors.invalidSettings("The edit operation needs an edit plan.");
  }
  const r = raw as Record<string, unknown>;

  // --- pages: order + rotation; a shorter list means pages were deleted ---
  const pages: PdfEditPage[] = [];
  if (Array.isArray(r.pages)) {
    if (r.pages.length > PDF_MAX_EDIT_PAGES) {
      throw Errors.invalidSettings(`An edit plan may keep at most ${PDF_MAX_EDIT_PAGES} pages.`);
    }
    for (const item of r.pages) {
      if (typeof item !== "object" || item === null) continue;
      const p = item as Record<string, unknown>;
      const src = Math.trunc(pdfNumber(p.src, -1));
      if (src < 0) continue;
      const rawRotate = ((Math.trunc(pdfNumber(p.rotate, 0)) % 360) + 360) % 360;
      const rotate = ([0, 90, 180, 270] as const).includes(rawRotate as 0 | 90 | 180 | 270)
        ? (rawRotate as 0 | 90 | 180 | 270)
        : 0;
      pages.push({ src, rotate });
    }
  }

  // --- overlays -----------------------------------------------------------
  const annotations: PdfEditAnnotation[] = [];
  if (Array.isArray(r.annotations)) {
    if (r.annotations.length > PDF_MAX_ANNOTATIONS) {
      throw Errors.invalidSettings(
        `An edit plan may contain at most ${PDF_MAX_ANNOTATIONS} overlays.`,
      );
    }
    for (const item of r.annotations) {
      if (typeof item !== "object" || item === null) continue;
      const a = item as Record<string, unknown>;
      const kind = String(a.kind ?? "");
      const page = Math.max(0, Math.trunc(pdfNumber(a.page, 0)));
      const coord = (v: unknown) => Math.max(0, Math.min(PDF_MAX_COORD, pdfNumber(v, 0)));

      if (kind === "text") {
        const text = String(a.text ?? "")
          .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, "")
          .slice(0, 500);
        if (!text.trim()) continue;
        const font = String(a.font ?? "helv").toLowerCase() as PdfEditFont;
        annotations.push({
          kind: "text",
          page,
          x: coord(a.x),
          y: coord(a.y),
          size: Math.max(1, Math.min(400, pdfNumber(a.size, 12))),
          font: PDF_EDIT_FONTS.includes(font) ? font : "helv",
          color: pdfColor(a.color),
          text,
        });
      } else if (kind === "image") {
        const w = Math.max(1, Math.min(PDF_MAX_COORD, pdfNumber(a.w, 1)));
        const h = Math.max(1, Math.min(PDF_MAX_COORD, pdfNumber(a.h, 1)));
        annotations.push({
          kind: "image",
          page,
          x: coord(a.x),
          y: coord(a.y),
          w,
          h,
          asset: pdfAssetName(a.asset),
        });
      } else if (kind === "replace") {
        // The needle has to survive verbatim or search_for() can never match
        // it, so it is only stripped of control characters.
        const find = String(a.find ?? "")
          .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, "")
          .slice(0, 200);
        if (!find.trim()) continue;
        // An empty replacement is legitimate: it deletes the matched text.
        const text = String(a.text ?? "")
          .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, "")
          .slice(0, 500);
        const occurrence = Math.trunc(pdfNumber(a.occurrence, 0));
        annotations.push({
          kind: "replace",
          page,
          find,
          text,
          occurrence: occurrence < 0 ? -1 : Math.min(occurrence, 10_000),
          ...(a.size === undefined ? {} : { size: Math.max(1, Math.min(400, pdfNumber(a.size, 12))) }),
          ...(a.color === undefined ? {} : { color: pdfColor(a.color) }),
          ...(a.bg === undefined ? {} : { bg: pdfColor(a.bg, "#ffffff") }),
        });
      } else if (kind === "draw" || kind === "highlight") {
        const points = pdfPoints(a.points);
        if (points.length < 2) continue;
        annotations.push({
          kind,
          page,
          color: pdfColor(a.color, kind === "highlight" ? "#ffe600" : "#111111"),
          width: Math.max(0.5, Math.min(200, pdfNumber(a.width, kind === "highlight" ? 12 : 2))),
          opacity: Math.max(0, Math.min(1, pdfNumber(a.opacity, 1))),
          points,
        });
      }
    }
  }

  // --- metadata -----------------------------------------------------------
  const metadata: PdfEditMetadata = {};
  if (typeof r.metadata === "object" && r.metadata !== null) {
    const m = r.metadata as Record<string, unknown>;
    for (const key of ["title", "author", "subject", "keywords"] as const) {
      const value = m[key];
      if (typeof value === "string" && value.trim()) {
        metadata[key] = value.replace(/[\x00-\x1f]/g, " ").trim().slice(0, 300);
      }
    }
  }

  if (pages.length === 0) {
    throw Errors.invalidSettings("The edit plan must keep at least one page.");
  }

  return { pages, annotations, metadata };
}

export function parsePdfSettings(raw: unknown): PdfSettings {
  if (typeof raw !== "object" || raw === null) throw Errors.invalidSettings();
  const r = raw as Record<string, unknown>;
  const op = String(r.op ?? "").toLowerCase();
  if (!(PDF_OPS as readonly string[]).includes(op)) {
    throw Errors.invalidSettings("op must be one of convert, merge, split, tojpg, edit.");
  }
  const plan = op === "edit" ? parsePdfEditPlan(r.plan) : { pages: [], annotations: [], metadata: {} };
  return { op: op as PdfOp, inputsDir: "", inputFiles: [], plan };
}

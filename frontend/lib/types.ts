export type JobState = "queued" | "processing" | "completed" | "failed";

export type UserRole = "admin" | "user" | "superadmin";

/** Admin-console sections that can be granted to a regular administrator. */
export const ADMIN_PERMISSIONS = [
  "users",
  "revenue",
  "support",
  "jobs",
  "promos",
  "affiliates",
  "contacts",
  "audit",
  "settings",
  "analytics",
] as const;

export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number];

export const ADMIN_PERMISSION_LABELS: Record<AdminPermission, string> = {
  users: "Users",
  revenue: "Revenue",
  support: "Support",
  jobs: "Jobs",
  promos: "Promos",
  affiliates: "Affiliates",
  contacts: "Contacts",
  audit: "Audit log",
  settings: "Settings",
  analytics: "Analytics",
};

export type UserStatus = "active" | "suspended" | "banned";

/** Billing tier held by an account. */
export type UserPlan = "free" | "pro" | "business";

export interface AuthUser {
  id: string;
  email: string;
  fullName?: string | null;
  phone?: string | null;
  role?: UserRole;
  /** Sections a regular administrator may open; the super admin has all. */
  permissions?: AdminPermission[];
  status?: UserStatus;
  banReason?: string | null;
  avatar?: string | null;
}

export interface AdminUserRecord {
  id: string;
  email: string;
  role: UserRole;
  permissions: AdminPermission[];
  status: UserStatus;
  banReason: string | null;
  createdAt: number;
  /** Remaining credit balance. */
  credits: number;
  /** Current plan key: free, pro or business. */
  plan: UserPlan;
  /** When the plan's monthly credits were last granted, or null. */
  planCreditsAt: number | null;
  /** When a promotional plan expires, or null for a regular plan. */
  planExpiresAt: number | null;
  referralCode: string;
  /** How many people this account has referred. */
  referralCount: number;
  /** True when this account was referred by someone else. */
  referred: boolean;
}

export interface AdminJobRecord {
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
  createdAt: number;
  updatedAt: number;
  processedAt: number | null;
}

export type AdminJobStats = Record<JobState | "total", number>;

export interface AdminSystemInfo {
  nodeEnv: string;
  port: number;
  node: string;
  platform: string;
  cpus: number;
  uptimeSec: number;
  processUptimeSec: number;
  memory: { rssMb: number; heapUsedMb: number };
  disk?: { totalMb: number; freeMb: number; usedMb: number; percentUsed: number };
  temp?: { totalMb: number; fileCount: number };
  health?: { status: "nominal" | "warning" | "degraded"; issues: string[]; failureRate: number };
  store: string;
  queue: string;
  authStore: string;
  tempDirectory: string;
  maxConcurrentJobs: number;
  authEnabled: boolean;
}

export interface AdminOverview {
  users: { total: number; admins: number; banned?: number };
  jobs: AdminJobStats;
  system: AdminSystemInfo;
}

export interface SiteAnnouncement {
  active: boolean;
  message: string;
  link: string | null;
  tone: "info" | "warning" | "sale";
  updatedAt: number;
}

export interface DiagnosticResult {
  id: string;
  name: string;
  status: "healthy" | "warning" | "error";
  latencyMs: number;
  detail: string;
}

export interface AdminOperationStat {
  operation: string;
  total: number;
  completed: number;
  failed: number;
  inputBytes: number;
}

export interface AdminDayStat {
  date: string;
  total: number;
  completed: number;
  failed: number;
}

export interface AdminFormatStat {
  format: string;
  count: number;
}

export interface AdminJobAnalytics {
  windowDays: number;
  since: number;
  generatedAt: number;
  totals: {
    jobs: number;
    completed: number;
    failed: number;
    active: number;
    successRate: number;
    inputBytes: number;
    outputBytes: number;
    avgInputBytes: number;
    avgProcessingMs: number | null;
  };
  byOperation: AdminOperationStat[];
  byDay: AdminDayStat[];
  byInputFormat: AdminFormatStat[];
}

export interface AdminConfigSnapshot {
  nodeEnv: string;
  port: number;
  authEnabled: boolean;
  authStore: string;
  allowedOrigins: string[];
  tempDirectory: string;
  rateLimit: { windowSeconds: number; max: number };
  authRateLimit: { windowSeconds: number; maxAttempts: number };
  tokens: {
    accessTtlMinutes: number;
    refreshTtlDays: number;
    legacySessionTtlDays: number;
    refreshReuseRevokesFamily: boolean;
  };
  passwordPolicy: {
    minLength: number;
    maxLength: number;
    requireComplexity: boolean;
    blocklist: boolean;
  };
  limits: {
    maxFileSizeMb: number;
    maxVideoFileSizeMb: number;
    maxConcurrentJobs: number;
    jobRetentionMinutes: number;
  };
  security: {
    headers: boolean;
    contentSecurityPolicy: boolean;
    hstsMaxAgeSeconds: number;
    requireHttps: boolean;
    csrfProtection: boolean;
    requestLogging: boolean;
    strict: boolean;
    trustProxy: boolean;
  };
  integrations: {
    redis: boolean;
    postgres: boolean;
    smtp: boolean;
    ffmpeg: boolean;
    apiKeys: number;
  };
  engines: Record<string, string>;
}

export interface AdminAuditEntry {
  id: string;
  at: number;
  actorId: string;
  actorEmail: string;
  action: string;
  target: string | null;
  detail: string | null;
  ip: string | null;
}

export interface AdminContactEntry {
  id: string;
  at: number;
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  status?: "unread" | "read";
}

export type AdminActivityKind = "user" | "contact" | "audit";

export interface AdminActivityItem {
  id: string;
  kind: AdminActivityKind;
  title: string;
  detail: string | null;
  at: number;
  href: string;
}

/** A personal API key owned by the signed-in account (secret shown once). */
export interface ApiKeyRecord {
  id: string;
  name: string;
  prefix: string;
  createdAt: number;
  lastUsedAt: number | null;
  expiresAt: number | null;
}

export type ToolOperation =
  | "resize"
  | "convert"
  | "enhance"
  | "scan"
  | "removebg"
  | "compress"
  | "watermark"
  | "video"
  | "fetch"
  | "audio";

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

export type PdfOp =
  | "convert"
  | "merge"
  | "split"
  | "tojpg"
  | "edit"
  | "compress"
  | "img2pdf"
  | "protect"
  | "unlock";

export interface PdfSecurityPermissions {
  print?: boolean;
  copy?: boolean;
  edit?: boolean;
  annotate?: boolean;
}

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
  { op: "compress", label: "Compress PDF", desc: "Reduce PDF file size by compressing images and streams." },
  { op: "img2pdf", label: "Images to PDF", desc: "Convert multiple JPG, PNG, or HEIC photos into a PDF." },
  {
    op: "protect",
    label: "Protect & Encrypt",
    desc: "Lock PDF with AES-256 password and restrict print/copy permissions.",
  },
  {
    op: "unlock",
    label: "Unlock & Decrypt",
    desc: "Remove password and permissions restrictions from protected PDFs.",
  },
  {
    op: "edit",
    label: "Edit & Sign PDF",
    desc: "Reorder pages, add digital signatures, text, highlights, and rewrite lines in place.",
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

export type RemoveBgModel = "u2net" | "u2net_human_seg" | "isnet-general-use" | "silueta";

export interface RemoveBgSettings {
  background: RemoveBgBackground;
  format: RemoveBgOutputFormat;
  /** Custom background color as 'r,g,b' or 'r,g,b,a' (0-255) when background="custom". */
  customColor?: string;
  model?: RemoveBgModel;
  alphaMatting?: boolean;
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
  watermarkType?: "text" | "image";
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

export type TtsFormat = "wav" | "mp3";

export interface SpeechVoiceRecord {
  name: string;
  culture: string;
  gender: string;
  age: string;
  description: string;
  localeName?: string;
}

export interface SpeechSynthesisRequest {
  text: string;
  voice?: string;
  rate: number;
  volume: number;
  format: TtsFormat;
}

export interface SpeechTranscript {
  text: string;
  confidence: number | null;
  language: string | null;
  engine: string;
  filename?: string;
  durationKnown?: boolean;
}

export type UrlDownloadFormat = "mp4" | "webm" | "mp3" | "m4a";

export interface UrlDownloadSettings {
  url: string;
  quality: string;
  format: UrlDownloadFormat;
  title?: string;
  kind?: string;
  threads?: number;
  proxy?: string;
}

export interface UrlDownloadQuality {
  id: string;
  label: string;
  height?: number;
  source: boolean;
}

export interface UrlDownloadAnalysis {
  url: string;
  title: string;
  kind: "direct" | "hls" | "stream";
  uploader?: string | null;
  thumbnail?: string | null;
  contentType: string | null;
  contentLength: number | null;
  durationSec: number | null;
  width: number | null;
  height: number | null;
  qualities: UrlDownloadQuality[];
  formats: UrlDownloadFormat[];
}

export const URL_DOWNLOAD_FORMATS: { value: UrlDownloadFormat; label: string }[] = [
  { value: "mp4", label: "MP4 (H.264)" },
  { value: "webm", label: "WEBM (VP9)" },
  { value: "mp3", label: "MP3 (audio only)" },
  { value: "m4a", label: "M4A (audio only)" },
];

export const AUDIO_OUTPUT_FORMATS = ["mp3", "wav", "m4a", "aac", "flac", "ogg", "opus"] as const;
export type AudioOutputFormat = (typeof AUDIO_OUTPUT_FORMATS)[number];

export const AUDIO_BITRATES = [64, 96, 128, 192, 256, 320] as const;
export const AUDIO_SAMPLE_RATES = [22050, 44100, 48000, 96000] as const;
export const AUDIO_CHANNELS = ["keep", "mono", "stereo"] as const;
export type AudioChannels = (typeof AUDIO_CHANNELS)[number];

export const VOICE_PRESETS = [
  "none",
  "girl",
  "man",
  "baby",
  "chipmunk",
  "monster",
  "robot",
  "helium",
  "radio",
  "echo",
  "studio",
] as const;
export type VoicePreset = (typeof VOICE_PRESETS)[number];

export const AUDIO_STEM_MODES = ["vocals", "instrumental"] as const;
export type AudioStemMode = (typeof AUDIO_STEM_MODES)[number];

export interface AudioSettings {
  format: AudioOutputFormat;
  bitrate: number;
  sampleRate?: number;
  channels?: AudioChannels;
  volume?: number;
  trimStart?: number;
  trimEnd?: number;
  voicePreset?: VoicePreset;
  pitchShift?: number; // Semitones: -12 to +12
  speed?: number; // Tempo: 0.5 to 2.0
  reverb?: number; // 0 to 1
  copyStream?: boolean; // Lossless audio extraction without re-encoding
  stemMode?: AudioStemMode; // Vocal removal / stem extraction
}

export const OCR_OUTPUT_FORMATS = [
  { value: "txt", label: "Plain Text (.txt)" },
  { value: "docx", label: "Word Document (.docx)" },
  { value: "json", label: "Structured JSON (.json)" },
] as const;
export type OcrOutputFormat = "txt" | "docx" | "json";

export interface OcrWord {
  text: string;
  rect: { x: number; y: number; w: number; h: number };
}

export interface OcrLine {
  text: string;
  words: OcrWord[];
}

export interface OcrPage {
  page: number;
  width: number;
  height: number;
  text: string;
  textAngle: number;
  lines: OcrLine[];
}

export interface OcrAnalysisResult {
  totalPages: number;
  totalWords: number;
  fullText: string;
  pages: OcrPage[];
}

export interface OcrLanguage {
  languageTag: string;
  displayName: string;
  nativeName: string;
}

export interface OcrSettings {
  language?: string;
  format: OcrOutputFormat;
}

export interface WebhookEndpoint {
  id: string;
  userId: string;
  url: string;
  events: string[];
  secret: string;
  active: boolean;
  createdAt: number;
}

export interface WebhookDeliveryLog {
  id: string;
  endpointId: string;
  userId: string;
  event: string;
  status: number;
  durationMs: number;
  timestamp: number;
  success: boolean;
  responsePreview?: string;
}

export interface TicketResponse {
  id: string;
  author: "user" | "admin";
  authorEmail: string;
  message: string;
  createdAt: number;
}

export interface SupportTicket {
  id: string;
  userId: string;
  userEmail: string;
  jobId?: string | null;
  subject: string;
  message: string;
  status: "open" | "in_progress" | "resolved";
  priority: "low" | "medium" | "high";
  category: "bug" | "billing" | "feature" | "other";
  responses: TicketResponse[];
  createdAt: number;
  updatedAt: number;
}

export interface AffiliateProfile {
  userId: string;
  userEmail: string;
  code: string;
  clicks: number;
  signups: number;
  paidConversions: number;
  commissionRatePercent: number;
  totalEarnedCents: number;
  paidOutCents: number;
  pendingBalanceCents: number;
  payoutMethod: "paypal" | "stripe" | "bank" | "crypto";
  payoutDetails: string;
  createdAt: number;
}

export interface PayoutRequest {
  id: string;
  userId: string;
  userEmail: string;
  amountCents: number;
  method: string;
  details: string;
  status: "pending" | "paid" | "rejected";
  requestedAt: number;
  processedAt?: number;
  notes?: string;
}

export interface TeamMember {
  userId: string;
  email: string;
  fullName: string | null;
  role: "owner" | "editor" | "viewer";
  creditsConsumed: number;
  joinedAt: number;
}

export interface TeamInvite {
  id: string;
  email: string;
  role: "editor" | "viewer";
  token: string;
  createdAt: number;
  expiresAt: number;
}

export interface TeamWorkspace {
  id: string;
  name: string;
  ownerId: string;
  sharedCredits: boolean;
  monthlyCreditCapPerMember: number | null;
  members: TeamMember[];
  invites: TeamInvite[];
  createdAt: number;
}

export interface AdminRevenueMetrics {
  mrrCents: number;
  arrCents: number;
  arpuCents: number;
  paidSubscribers: number;
  totalUsers: number;
  churnRatePercent: number;
  plans: {
    free: number;
    pro: number;
    business: number;
  };
  stripeLive: boolean;
  lastWebhookReceivedAt: number;
}

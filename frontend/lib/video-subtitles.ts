/**
 * Video Subtitle and Animated Caption Engine
 *
 * Handles subtitle cue generation, SRT/VTT parsing and formatting,
 * and live Canvas rendering of stylized captions for TikTok/Reels/YouTube.
 */

export interface SubtitleCue {
  id: string;
  startTime: number; // in seconds
  endTime: number; // in seconds
  text: string;
}

export type CaptionPresetStyle = "viral-yellow" | "karaoke-glow" | "minimal-dark" | "classic-white";

export interface CaptionStyleConfig {
  id: CaptionPresetStyle;
  name: string;
  fontFamily: string;
  fontSizePercent: number; // % of canvas height, e.g. 4.5%
  textColor: string;
  strokeColor?: string;
  strokeWidthPercent?: number; // % of fontSize
  backgroundColor?: string;
  textTransform?: "uppercase" | "none";
  positionYPercent: number; // % from top, e.g. 80% for bottom third
  shadowColor?: string;
  shadowBlur?: number;
  highlightWords?: boolean;
}

export const CAPTION_PRESETS: Record<CaptionPresetStyle, CaptionStyleConfig> = {
  "viral-yellow": {
    id: "viral-yellow",
    name: "Viral Shorts (Yellow Bold)",
    fontFamily: "'Impact', 'Arial Black', sans-serif",
    fontSizePercent: 5.0,
    textColor: "#FFEB3B",
    strokeColor: "#000000",
    strokeWidthPercent: 20,
    textTransform: "uppercase",
    positionYPercent: 78,
    shadowColor: "rgba(0, 0, 0, 0.8)",
    shadowBlur: 10,
  },
  "karaoke-glow": {
    id: "karaoke-glow",
    name: "Neon Glow (Cyan / Violet)",
    fontFamily: "'Trebuchet MS', 'Segoe UI', sans-serif",
    fontSizePercent: 4.5,
    textColor: "#00FFFF",
    strokeColor: "#1A0033",
    strokeWidthPercent: 15,
    positionYPercent: 78,
    shadowColor: "rgba(0, 255, 255, 0.7)",
    shadowBlur: 14,
  },
  "minimal-dark": {
    id: "minimal-dark",
    name: "Modern Pill (Clean White)",
    fontFamily: "system-ui, -apple-system, sans-serif",
    fontSizePercent: 3.8,
    textColor: "#FFFFFF",
    backgroundColor: "rgba(0, 0, 0, 0.72)",
    textTransform: "none",
    positionYPercent: 82,
    shadowBlur: 0,
  },
  "classic-white": {
    id: "classic-white",
    name: "Classic Movie (Black Outline)",
    fontFamily: "'Arial', sans-serif",
    fontSizePercent: 4.0,
    textColor: "#FFFFFF",
    strokeColor: "#000000",
    strokeWidthPercent: 14,
    textTransform: "none",
    positionYPercent: 85,
    shadowColor: "rgba(0, 0, 0, 0.6)",
    shadowBlur: 6,
  },
};

/**
 * Format seconds to SRT timestamp: HH:MM:SS,mmm
 */
export function formatTimestampSrt(seconds: number): string {
  const pad = (num: number, size = 2) => String(Math.floor(num)).padStart(size, "0");
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const millis = Math.floor((seconds % 1) * 1000);

  return `${pad(hrs)}:${pad(mins)}:${pad(secs)},${pad(millis, 3)}`;
}

/**
 * Format seconds to WebVTT timestamp: HH:MM:SS.mmm
 */
export function formatTimestampVtt(seconds: number): string {
  const pad = (num: number, size = 2) => String(Math.floor(num)).padStart(size, "0");
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const millis = Math.floor((seconds % 1) * 1000);

  return `${pad(hrs)}:${pad(mins)}:${pad(secs)}.${pad(millis, 3)}`;
}

/**
 * Parse SRT string into SubtitleCue array
 */
export function parseSrt(srtText: string): SubtitleCue[] {
  const normalized = srtText.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  const blocks = normalized.split(/\n\s*\n/);
  const cues: SubtitleCue[] = [];

  for (const block of blocks) {
    const lines = block.split("\n");
    if (lines.length < 2) continue;

    // Timecode line: e.g. 00:00:01,000 --> 00:00:04,500
    const timeMatch = block.match(
      /(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/
    );

    if (timeMatch) {
      const start =
        parseInt(timeMatch[1], 10) * 3600 +
        parseInt(timeMatch[2], 10) * 60 +
        parseInt(timeMatch[3], 10) +
        parseInt(timeMatch[4], 10) / 1000;

      const end =
        parseInt(timeMatch[5], 10) * 3600 +
        parseInt(timeMatch[6], 10) * 60 +
        parseInt(timeMatch[7], 10) +
        parseInt(timeMatch[8], 10) / 1000;

      // Text is everything after the timecode line
      const timeLineIndex = lines.findIndex((l) => l.includes("-->"));
      const text = lines.slice(timeLineIndex + 1).join(" ").trim();

      if (text) {
        cues.push({
          id: `cue-${cues.length + 1}-${Date.now()}`,
          startTime: start,
          endTime: end,
          text,
        });
      }
    }
  }

  return cues;
}

/**
 * Export SubtitleCue array to standard SubRip (.srt) format
 */
export function exportSrt(cues: SubtitleCue[]): string {
  return cues
    .map((cue, index) => {
      const idx = index + 1;
      const start = formatTimestampSrt(cue.startTime);
      const end = formatTimestampSrt(cue.endTime);
      return `${idx}\n${start} --> ${end}\n${cue.text}\n`;
    })
    .join("\n");
}

/**
 * Export SubtitleCue array to WebVTT (.vtt) format
 */
export function exportVtt(cues: SubtitleCue[]): string {
  const header = "WEBVTT\n\n";
  const body = cues
    .map((cue, index) => {
      const start = formatTimestampVtt(cue.startTime);
      const end = formatTimestampVtt(cue.endTime);
      return `${index + 1}\n${start} --> ${end}\n${cue.text}\n`;
    })
    .join("\n");

  return header + body;
}

/**
 * Automatically create distributed subtitle cues from a transcript across video duration.
 * Divides text into natural 4-7 word bite-sized phrases suited for viral short video captions.
 */
export function autoGenerateCuesFromTranscript(transcript: string, videoDuration: number): SubtitleCue[] {
  const clean = transcript.trim();
  if (!clean || videoDuration <= 0) return [];

  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  // 4 to 6 words per subtitle card for fast mobile reading
  const wordsPerCue = 5;
  const cueGroups: string[] = [];

  for (let i = 0; i < words.length; i += wordsPerCue) {
    cueGroups.push(words.slice(i, i + wordsPerCue).join(" "));
  }

  const timePerCue = Math.max(1.2, videoDuration / cueGroups.length);
  const cues: SubtitleCue[] = [];

  cueGroups.forEach((groupText, idx) => {
    const start = idx * timePerCue;
    const end = Math.min(videoDuration, (idx + 1) * timePerCue);

    cues.push({
      id: `cue-${idx + 1}`,
      startTime: Math.round(start * 100) / 100,
      endTime: Math.round(end * 100) / 100,
      text: groupText,
    });
  });

  return cues;
}

/**
 * Render captions onto an HTML Canvas over the video frame.
 */
export function drawCaptionsOnCanvas(
  ctx: CanvasRenderingContext2D,
  activeCue: SubtitleCue | undefined,
  styleConfig: CaptionStyleConfig,
  canvasWidth: number,
  canvasHeight: number
) {
  if (!activeCue || !activeCue.text.trim()) return;

  const textToDraw =
    styleConfig.textTransform === "uppercase"
      ? activeCue.text.toUpperCase()
      : activeCue.text;

  const fontSize = Math.max(14, (canvasHeight * styleConfig.fontSizePercent) / 100);
  ctx.save();
  ctx.font = `bold ${fontSize}px ${styleConfig.fontFamily}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const centerX = canvasWidth / 2;
  const centerY = (canvasHeight * styleConfig.positionYPercent) / 100;

  // Measure text
  const metrics = ctx.measureText(textToDraw);
  const textWidth = metrics.width;
  const paddingX = fontSize * 0.5;
  const paddingY = fontSize * 0.35;

  // Background pill if configured
  if (styleConfig.backgroundColor) {
    ctx.fillStyle = styleConfig.backgroundColor;
    const bgX = centerX - textWidth / 2 - paddingX;
    const bgY = centerY - fontSize / 2 - paddingY;
    const bgWidth = textWidth + paddingX * 2;
    const bgHeight = fontSize + paddingY * 2;
    const radius = Math.min(12, fontSize * 0.3);

    ctx.beginPath();
    ctx.roundRect(bgX, bgY, bgWidth, bgHeight, radius);
    ctx.fill();
  }

  // Shadow / Glow
  if (styleConfig.shadowBlur && styleConfig.shadowColor) {
    ctx.shadowColor = styleConfig.shadowColor;
    ctx.shadowBlur = styleConfig.shadowBlur;
  }

  // Stroke / Outline
  if (styleConfig.strokeColor && styleConfig.strokeWidthPercent) {
    const strokeWidth = (fontSize * styleConfig.strokeWidthPercent) / 100;
    ctx.strokeStyle = styleConfig.strokeColor;
    ctx.lineWidth = strokeWidth;
    ctx.lineJoin = "round";
    ctx.strokeText(textToDraw, centerX, centerY);
  }

  // Text Fill
  ctx.fillStyle = styleConfig.textColor;
  ctx.fillText(textToDraw, centerX, centerY);

  ctx.restore();
}

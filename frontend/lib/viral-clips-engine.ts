/**
 * Viral Short-Form Video Clipper & Submagic Subtitles Engine
 *
 * Re-containers widescreen videos into 9:16 vertical TikTok/Reels/Shorts format with
 * blurred background letterboxing, animated karaoke word-bounce captions, and progress bars.
 */

export type ViralAspect = "9:16" | "1:1" | "4:5";
export type BackgroundMode = "blurred-video" | "solid-black" | "gradient";
export type CaptionStyle = "hormozi-yellow" | "beast-green" | "neon-cyan" | "clean-white";

export interface ViralClipConfig {
  aspect: ViralAspect;
  background: BackgroundMode;
  headlineText: string;
  showHeadline: boolean;
  showProgressBar: boolean;
  progressBarColor: string;
  captionStyle: CaptionStyle;
  captionSize: number;
}

export const DEFAULT_VIRAL_CONFIG: ViralClipConfig = {
  aspect: "9:16",
  background: "blurred-video",
  headlineText: "THE 1 HABIT THAT CHANGED EVERYTHING ⚡",
  showHeadline: true,
  showProgressBar: true,
  progressBarColor: "#ef4444",
  captionStyle: "hormozi-yellow",
  captionSize: 42,
};

export const SAMPLE_CAPTIONS = [
  "IF YOU WANT TO SUCCEED IN 2026",
  "YOU NEED TO FOCUS ON HIGH VALUE WORK",
  "STOP WASTING TIME ON DISTRACTIONS",
  "BUILD ASSETS THAT PAY YOU DAILY",
  "START NOW AND NEVER LOOK BACK",
];

export const CAPTION_COLORS: Record<CaptionStyle, { text: string; highlight: string; bg: string }> = {
  "hormozi-yellow": { text: "#ffffff", highlight: "#facc15", bg: "rgba(0,0,0,0.85)" },
  "beast-green": { text: "#ffffff", highlight: "#4ade80", bg: "rgba(0,0,0,0.85)" },
  "neon-cyan": { text: "#ffffff", highlight: "#38bdf8", bg: "rgba(0,0,0,0.85)" },
  "clean-white": { text: "#ffffff", highlight: "#ffffff", bg: "rgba(0,0,0,0.8)" },
};

/**
 * Render a single frame of the viral short-form video composition
 */
export function renderViralFrame(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  video: HTMLVideoElement | null,
  config: ViralClipConfig,
  currentTime: number,
  duration: number,
) {
  // 1. Draw Background
  if (config.background === "blurred-video" && video && video.readyState >= 2) {
    ctx.save();
    ctx.filter = "blur(24px) brightness(0.65)";
    ctx.drawImage(video, -20, -20, width + 40, height + 40);
    ctx.restore();
  } else if (config.background === "gradient") {
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, "#0f172a");
    grad.addColorStop(0.5, "#1e1b4b");
    grad.addColorStop(1, "#020617");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  } else {
    // solid-black
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, width, height);
  }

  // 2. Draw Main Crisp Center Video
  if (video && video.readyState >= 2) {
    const vidW = video.videoWidth || 1920;
    const vidH = video.videoHeight || 1080;
    const fitW = width;
    const fitH = (vidH / vidW) * fitW;
    const fitY = (height - fitH) / 2;

    ctx.save();
    // Drop shadow around centered video
    ctx.shadowColor = "rgba(0, 0, 0, 0.6)";
    ctx.shadowBlur = 30;
    ctx.drawImage(video, 0, fitY, fitW, fitH);
    ctx.restore();
  }

  // 3. Draw Hook Headline at the Top
  if (config.showHeadline && config.headlineText.trim()) {
    const headY = height * 0.14;
    ctx.save();
    ctx.font = "900 32px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const textMetrics = ctx.measureText(config.headlineText);
    const boxW = Math.min(width * 0.88, textMetrics.width + 48);
    const boxH = 58;

    // Headline background badge
    ctx.fillStyle = "#facc15"; // punchy viral yellow
    ctx.beginPath();
    ctx.roundRect((width - boxW) / 2, headY - boxH / 2, boxW, boxH, 16);
    ctx.fill();

    // Text
    ctx.fillStyle = "#000000";
    ctx.fillText(config.headlineText, width / 2, headY);
    ctx.restore();
  }

  // 4. Draw Animated Word-Bounce Subtitles
  const captionIndex = Math.floor((currentTime / Math.max(0.1, duration)) * SAMPLE_CAPTIONS.length) % SAMPLE_CAPTIONS.length;
  const currentSentence = SAMPLE_CAPTIONS[captionIndex];
  const words = currentSentence.split(" ");
  const activeWordIdx = Math.floor((currentTime * 3) % words.length);

  const style = CAPTION_COLORS[config.captionStyle];
  const capY = height * 0.76;

  ctx.save();
  ctx.font = `900 ${config.captionSize}px system-ui, -apple-system, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // Measure full sentence width
  const fullText = words.join(" ");
  const fullMetrics = ctx.measureText(fullText);
  const pillW = Math.min(width * 0.9, fullMetrics.width + 50);
  const pillH = config.captionSize * 1.8;

  // Dark subtitle pill backdrop
  ctx.fillStyle = style.bg;
  ctx.beginPath();
  ctx.roundRect((width - pillW) / 2, capY - pillH / 2, pillW, pillH, 20);
  ctx.fill();

  // Draw words with current word highlighted
  let curX = (width - fullMetrics.width) / 2;
  words.forEach((word, idx) => {
    const isHighlighted = idx === activeWordIdx;
    ctx.fillStyle = isHighlighted ? style.highlight : style.text;
    ctx.textAlign = "left";

    if (isHighlighted) {
      ctx.save();
      ctx.shadowColor = style.highlight;
      ctx.shadowBlur = 16;
      ctx.fillText(word, curX, capY);
      ctx.restore();
    } else {
      ctx.fillText(word, curX, capY);
    }

    curX += ctx.measureText(word + " ").width;
  });
  ctx.restore();

  // 5. Draw Animated Top/Bottom Progress Bar
  if (config.showProgressBar && duration > 0) {
    const progress = Math.min(1, Math.max(0, currentTime / duration));
    ctx.fillStyle = config.progressBarColor;
    ctx.fillRect(0, height - 8, width * progress, 8);
  }
}

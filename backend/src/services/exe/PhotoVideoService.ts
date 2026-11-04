import { createWriteStream, existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import archiver from "archiver";

import { ExeProcessRunner } from "./ExeProcessRunner.js";
import type { ProcessingRequest, ProcessingResult, ProcessingService } from "../ProcessingService.js";
import type { VideoSettings } from "../../validation/validators.js";
import { config } from "../../config.js";
import { logger } from "../../utils/logger.js";
import { Errors } from "../../utils/errors.js";

interface ProbeResult {
  durationSec: number;
  width: number;
  height: number;
  hasAudio: boolean;
}

interface TrimResult {
  args: string[];
  /** Duration of the source segment actually encoded, after speed adjustment. */
  effDuration: number;
}

type ProgressFn = ((fraction: number) => void) | undefined;

/** Upper bound on re-encode attempts while homing in on a target size. */
const MAX_TARGET_ATTEMPTS = 5;
/** Never let the video bitrate collapse below this (kbps). */
const MIN_VIDEO_KBPS = 50;

/**
 * Drives the host-installed FFmpeg to re-encode a video, either at a chosen
 * quality (CRF) or iteratively shrinking the video bitrate until the output
 * fits a target file size. Also supports trimming, playback speed, animation
 * (GIF) export and single-frame thumbnails. Container, resolution scaling and
 * audio handling are all configurable.
 *
 * FFmpeg is not bundled with the app — it must be installed on the host (on
 * PATH, or pointed at by PHOTO_FFMPEG_EXE / PHOTO_FFPROBE_EXE).
 */
export class ExeVideoService implements ProcessingService {
  readonly operation = "video" as const;

  constructor(private readonly runner: ExeProcessRunner) {}

  async process(request: ProcessingRequest): Promise<ProcessingResult> {
    if (!config.ffmpegExe || !config.ffprobeExe) throw Errors.videoUnavailable();

    const settings = request.settings as VideoSettings;
    const probe = await this.probe(request.inputPath);

    if (settings.output === "thumbnail") {
      return this.makeThumbnail(request, settings, probe);
    }

    if (settings.output === "audio") {
      return this.extractAudio(request, settings, probe);
    }

    if (settings.output === "frames") {
      return this.extractFrames(request, settings, probe);
    }

    if (settings.output === "gif") {
      const gifPath = path.join(request.outputDir, `${request.outputBaseName}.gif`);
      await this.makeGif(request.inputPath, gifPath, settings, probe, request.onProgress);
      this.assertOutput(gifPath, request.outputDir);
      request.onProgress?.(1);
      return { outputPath: gifPath };
    }

    const container = this.resolveContainer(settings, request.inputPath);
    const outputPath = path.join(request.outputDir, `${request.outputBaseName}.${container}`);

    if (settings.mode === "quality") {
      await this.encode(request.inputPath, outputPath, settings, probe, container, request.onProgress);
    } else {
      await this.encodeToTarget(request.inputPath, outputPath, settings, probe, container, request.onProgress);
    }

    this.assertOutput(outputPath, request.outputDir);
    request.onProgress?.(1);
    return { outputPath };
  }

  private assertOutput(outputPath: string, outputDir: string): void {
    if (existsSync(outputPath)) return;
    logger.error("FFmpeg reported success but no output file was produced", { outputDir });
    throw Errors.processingFailed();
  }

  /** Read duration, dimensions and audio presence via ffprobe. */
  private async probe(inputPath: string): Promise<ProbeResult> {
    const result = await this.runner.run("video-probe", {
      args: [
        "-v",
        "error",
        "-print_format",
        "json",
        "-show_format",
        "-show_streams",
        inputPath,
      ],
      timeoutMs: 60_000,
    });

    if (result.timedOut) throw Errors.timeout();
    if (result.exitCode !== 0) {
      logger.error("ffprobe failed", { exitCode: result.exitCode, stderr: result.stderr.slice(-1000) });
      throw Errors.unsupportedVideoFormat();
    }

    let data: { format?: { duration?: string }; streams?: Record<string, unknown>[] };
    try {
      data = JSON.parse(result.stdout) as typeof data;
    } catch {
      throw Errors.processingFailed();
    }

    const streams = Array.isArray(data.streams) ? data.streams : [];
    const video = streams.find((s) => s.codec_type === "video");
    if (!video) throw Errors.unsupportedVideoFormat();
    const hasAudio = streams.some((s) => s.codec_type === "audio");

    const duration = Number(data.format?.duration ?? video.duration ?? 0);
    return {
      durationSec: Number.isFinite(duration) && duration > 0 ? duration : 0,
      width: Number(video.width ?? 0) || 0,
      height: Number(video.height ?? 0) || 0,
      hasAudio,
    };
  }

  private resolveContainer(settings: VideoSettings, inputPath: string): "mp4" | "webm" {
    if (settings.format === "mp4" || settings.format === "webm") return settings.format;
    const ext = path.extname(inputPath).toLowerCase();
    return ext === ".webm" || ext === ".mkv" ? "webm" : "mp4";
  }

  /**
   * Build the input-side trim options (`-ss` / `-t`) and the resulting encoded
   * duration (accounting for playback speed) so progress and target-size
   * budgets stay accurate.
   */
  private trim(settings: VideoSettings, probe: ProbeResult): TrimResult {
    const src = probe.durationSec;
    const start = Math.max(0, settings.trimStart);
    const args: string[] = [];

    if (src > 0) {
      const effStart = Math.min(start, Math.max(0, src - 0.05));
      const end = settings.trimEnd > 0 ? Math.min(settings.trimEnd, src) : src;
      const readDur = Math.max(0.05, end - effStart);
      if (effStart > 0.001) args.push("-ss", effStart.toFixed(3));
      if (readDur < src - 0.01) args.push("-t", readDur.toFixed(3));
      return { args, effDuration: readDur / settings.speed };
    }

    // Unknown duration: pass the user's values straight through.
    let readDur = 0;
    if (start > 0.001) args.push("-ss", start.toFixed(3));
    if (settings.trimEnd > start) {
      readDur = settings.trimEnd - start;
      args.push("-t", readDur.toFixed(3));
    }
    return { args, effDuration: readDur > 0 ? readDur / settings.speed : 0 };
  }

  private scaleFilter(settings: VideoSettings, probe: ProbeResult): string | null {
    if (settings.resolution === "source") return null;
    const targetHeight = Number(settings.resolution);
    if (!probe.height || !probe.width || targetHeight <= 0 || probe.height <= targetHeight) return null;
    // Keep the aspect ratio and force even dimensions for yuv420p with high-precision Lanczos resampling.
    const targetWidth = Math.max(2, Math.round((probe.width * targetHeight) / probe.height / 2) * 2);
    return `scale=${targetWidth}:${targetHeight}:flags=lanczos+accurate_rnd`;
  }

  private audioReserveKbps(settings: VideoSettings, probe: ProbeResult): number {
    if (!probe.hasAudio || settings.audioMode === "strip") return 0;
    return settings.audioMode === "bitrate" ? settings.audioKbps : 128;
  }

  private buildVideoArgs(
    inputPath: string,
    outputPath: string,
    settings: VideoSettings,
    probe: ProbeResult,
    container: "mp4" | "webm",
    trim: TrimResult,
    videoKbps: number | undefined,
    withProgress: boolean,
  ): string[] {
    const args = ["-hide_banner", "-loglevel", "error", "-nostdin", "-y", ...trim.args, "-i", inputPath];

    const filters: string[] = [];
    if (settings.speed !== 1) filters.push(`setpts=PTS/${settings.speed}`);
    const scale = this.scaleFilter(settings, probe);
    if (scale) filters.push(scale);
    // Studio-grade clarity: 3D temporal-spatial noise reduction + Contrast-Adaptive Sharpening (CAS)
    filters.push("hqdn3d=1.2:1.2:3:3");
    filters.push("cas=0.35");
    args.push("-vf", filters.join(","));

    if (container === "mp4") {
      args.push("-c:v", "libx264", "-preset", "medium", "-tune", "film", "-pix_fmt", "yuv420p");
      if (videoKbps && videoKbps > 0) {
        args.push(
          "-b:v",
          `${videoKbps}k`,
          "-maxrate",
          `${Math.round(videoKbps * 1.5)}k`,
          "-bufsize",
          `${videoKbps * 2}k`,
        );
      } else {
        args.push("-crf", String(settings.crf));
      }
      args.push("-movflags", "+faststart");
    } else {
      args.push("-c:v", "libvpx-vp9", "-row-mt", "1", "-cpu-used", "2");
      if (videoKbps && videoKbps > 0) args.push("-b:v", `${videoKbps}k`);
      else args.push("-crf", String(settings.crf), "-b:v", "0");
    }

    if (!probe.hasAudio || settings.audioMode === "strip") {
      args.push("-an");
    } else {
      if (settings.speed !== 1) args.push("-filter:a", `atempo=${settings.speed}`);
      const kbps = settings.audioMode === "bitrate" ? settings.audioKbps : 128;
      args.push("-c:a", container === "mp4" ? "aac" : "libopus", "-b:a", `${kbps}k`);
    }

    if (withProgress) args.push("-progress", "pipe:1", "-nostats");
    args.push(outputPath);
    return args;
  }

  private makeGif(
    inputPath: string,
    outputPath: string,
    settings: VideoSettings,
    probe: ProbeResult,
    onProgress: ProgressFn,
  ): Promise<number> {
    const trim = this.trim(settings, probe);
    const filters: string[] = [];
    if (settings.speed !== 1) filters.push(`setpts=PTS/${settings.speed}`);
    filters.push(`fps=${settings.fps}`);
    const scale = this.scaleFilter(settings, probe);
    if (scale) filters.push(scale);
    const chain =
      `${filters.join(",")},split[s0][s1];` +
      "[s0]palettegen=max_colors=256[p];[s1][p]paletteuse=dither=bayer:bayer_scale=3";

    const args = [
      "-hide_banner",
      "-loglevel",
      "error",
      "-nostdin",
      "-y",
      ...trim.args,
      "-i",
      inputPath,
      "-vf",
      chain,
      ...this.progressArgs(!!onProgress),
      outputPath,
    ];
    return this.runFfmpeg(args, outputPath, onProgress, trim.effDuration, 0, 1);
  }

  private async makeThumbnail(
    request: ProcessingRequest,
    settings: VideoSettings,
    probe: ProbeResult,
  ): Promise<ProcessingResult> {
    const outputPath = path.join(request.outputDir, `${request.outputBaseName}.${settings.thumbFormat}`);
    const args = ["-hide_banner", "-loglevel", "error", "-nostdin", "-y"];
    const at = Math.max(0, settings.frameTime);
    if (at > 0.001) args.push("-ss", at.toFixed(3));
    args.push("-i", request.inputPath);
    const scale = this.scaleFilter(settings, probe);
    if (scale) args.push("-vf", scale);
    args.push("-frames:v", "1");
    if (settings.thumbFormat === "jpg") args.push("-q:v", "2");
    args.push(outputPath);

    await this.runFfmpeg(args, outputPath, request.onProgress, 0, 0, 1);
    if (!existsSync(outputPath)) throw Errors.processingFailed();
    request.onProgress?.(1);
    return { outputPath };
  }

  private progressArgs(enabled: boolean): string[] {
    return enabled ? ["-progress", "pipe:1", "-nostats"] : [];
  }

  /** Rip the audio track out of the video, trimmed but otherwise untouched. */
  private async extractAudio(
    request: ProcessingRequest,
    settings: VideoSettings,
    probe: ProbeResult,
  ): Promise<ProcessingResult> {
    if (!probe.hasAudio) throw Errors.videoNoAudio();

    const ext = settings.audioFormat;
    const outputPath = path.join(request.outputDir, `${request.outputBaseName}.${ext}`);
    const trim = this.trim(settings, probe);

    const args = [
      "-hide_banner",
      "-loglevel",
      "error",
      "-nostdin",
      "-y",
      ...trim.args,
      "-i",
      request.inputPath,
      "-vn",
    ];
    if (ext === "mp3") {
      args.push("-c:a", "libmp3lame", "-b:a", `${settings.audioKbps}k`);
    } else if (ext === "m4a") {
      args.push("-c:a", "aac", "-b:a", `${settings.audioKbps}k`, "-movflags", "+faststart");
    } else {
      args.push("-c:a", "pcm_s16le");
    }
    args.push(...this.progressArgs(!!request.onProgress), outputPath);

    await this.runFfmpeg(args, outputPath, request.onProgress, trim.effDuration, 0, 1);
    request.onProgress?.(1);
    return { outputPath };
  }

  /** Sample still frames at a fixed interval and bundle them into a ZIP. */
  private async extractFrames(
    request: ProcessingRequest,
    settings: VideoSettings,
    probe: ProbeResult,
  ): Promise<ProcessingResult> {
    const outputPath = path.join(request.outputDir, `${request.outputBaseName}-frames.zip`);
    const frameDir = path.join(request.outputDir, `.frames-${crypto.randomUUID()}`);
    mkdirSync(frameDir, { recursive: true });

    try {
      const trim = this.trim(settings, probe);
      const filters = [`fps=1/${settings.framesInterval}`];
      const scale = this.scaleFilter(settings, probe);
      if (scale) filters.push(scale);

      const args = [
        "-hide_banner",
        "-loglevel",
        "error",
        "-nostdin",
        "-y",
        ...trim.args,
        "-i",
        request.inputPath,
        "-an",
        "-vf",
        filters.join(","),
        "-frames:v",
        String(settings.framesMax),
      ];
      if (settings.framesFormat === "jpg") args.push("-q:v", "2");
      args.push(
        ...this.progressArgs(!!request.onProgress),
        path.join(frameDir, `frame_%04d.${settings.framesFormat}`),
      );

      await this.exec(args, request.onProgress, trim.effDuration, 0, 1);

      if (readdirSync(frameDir).length === 0) {
        throw Errors.processingFailed("No frames could be extracted from that range.");
      }

      await this.zipDirectory(frameDir, outputPath);
      this.assertOutput(outputPath, request.outputDir);
      request.onProgress?.(1);
      return { outputPath };
    } finally {
      rmSync(frameDir, { recursive: true, force: true });
    }
  }

  /** Stream a directory's files into a ZIP archive at the given path. */
  private zipDirectory(sourceDir: string, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const output = createWriteStream(outputPath);
      const archive = archiver("zip", { zlib: { level: 8 } });
      output.on("close", () => resolve());
      output.on("error", reject);
      archive.on("error", reject);
      archive.pipe(output);
      archive.directory(sourceDir, false);
      void archive.finalize();
    });
  }

  /** Build the stdout-line handler that turns FFmpeg `-progress` output into a fraction. */
  private progressLogger(
    onProgress: ProgressFn,
    effDuration: number,
    progressBase: number,
    progressSpan: number,
  ): ((line: string) => void) | undefined {
    if (!onProgress || effDuration <= 0) return undefined;
    return (line) => {
      // ffmpeg's `-progress` output reports out_time_ms in microseconds.
      const match = /^out_time_ms=(\d+)/.exec(line);
      if (!match) return;
      const seconds = Number(match[1]) / 1_000_000;
      const within = Math.max(0, Math.min(1, seconds / effDuration));
      onProgress(Math.min(0.99, progressBase + within * progressSpan));
    };
  }

  /** Run FFmpeg once, throwing typed errors on timeout/failure. */
  private async exec(
    args: string[],
    onProgress: ProgressFn,
    effDuration: number,
    progressBase: number,
    progressSpan: number,
  ): Promise<void> {
    const result = await this.runner.run("video", {
      args,
      timeoutMs: config.videoProcessTimeoutMs,
      onStdoutLine: this.progressLogger(onProgress, effDuration, progressBase, progressSpan),
    });

    if (result.timedOut) {
      logger.error("FFmpeg timed out");
      throw Errors.timeout();
    }
    if (result.exitCode !== 0) {
      logger.error("FFmpeg failed", {
        exitCode: result.exitCode,
        stderr: result.stderr.slice(-2000),
      });
      throw Errors.exeError();
    }
  }

  /** Run FFmpeg once and return the produced file size in bytes. */
  private async runFfmpeg(
    args: string[],
    outputPath: string,
    onProgress: ProgressFn,
    effDuration: number,
    progressBase: number,
    progressSpan: number,
  ): Promise<number> {
    await this.exec(args, onProgress, effDuration, progressBase, progressSpan);
    if (!existsSync(outputPath)) throw Errors.processingFailed();
    return statSync(outputPath).size;
  }

  private encode(
    inputPath: string,
    outputPath: string,
    settings: VideoSettings,
    probe: ProbeResult,
    container: "mp4" | "webm",
    onProgress: ProgressFn,
  ): Promise<number> {
    const trim = this.trim(settings, probe);
    const args = this.buildVideoArgs(inputPath, outputPath, settings, probe, container, trim, undefined, !!onProgress);
    return this.runFfmpeg(args, outputPath, onProgress, trim.effDuration, 0, 1);
  }

  private encodeAtBitrate(
    inputPath: string,
    outputPath: string,
    settings: VideoSettings,
    probe: ProbeResult,
    container: "mp4" | "webm",
    videoKbps: number,
    trim: TrimResult,
    onProgress: ProgressFn,
    progressBase: number,
    progressSpan: number,
  ): Promise<number> {
    const args = this.buildVideoArgs(
      inputPath,
      outputPath,
      settings,
      probe,
      container,
      trim,
      videoKbps,
      !!onProgress,
    );
    return this.runFfmpeg(args, outputPath, onProgress, trim.effDuration, progressBase, progressSpan);
  }

  private async encodeToTarget(
    inputPath: string,
    outputPath: string,
    settings: VideoSettings,
    probe: ProbeResult,
    container: "mp4" | "webm",
    onProgress: ProgressFn,
  ): Promise<void> {
    const targetBytes = settings.targetKb * 1024;
    const trim = this.trim(settings, probe);

    // Without a duration we cannot budget bits; fall back to plain CRF.
    if (trim.effDuration <= 0) {
      logger.warn("ffprobe reported no duration; encoding at CRF for target mode");
      const args = this.buildVideoArgs(inputPath, outputPath, settings, probe, container, trim, undefined, !!onProgress);
      await this.runFfmpeg(args, outputPath, onProgress, 0, 0, 1);
      return;
    }

    const step = 1 / (MAX_TARGET_ATTEMPTS + 1);
    const audioKbps = this.audioReserveKbps(settings, probe);
    const totalKbps = (targetBytes * 8) / trim.effDuration / 1000;
    let videoKbps = Math.max(MIN_VIDEO_KBPS, Math.round((totalKbps - audioKbps) * 0.97));

    let size = await this.encodeAtBitrate(
      inputPath,
      outputPath,
      settings,
      probe,
      container,
      videoKbps,
      trim,
      onProgress,
      0,
      step,
    );
    let attempt = 0;
    while (size > targetBytes && attempt < MAX_TARGET_ATTEMPTS && videoKbps > MIN_VIDEO_KBPS) {
      attempt += 1;
      const factor = Math.max(0.3, Math.min(0.95, (targetBytes / size) * 0.98));
      videoKbps = Math.max(MIN_VIDEO_KBPS, Math.round(videoKbps * factor));
      size = await this.encodeAtBitrate(
        inputPath,
        outputPath,
        settings,
        probe,
        container,
        videoKbps,
        trim,
        onProgress,
        attempt * step,
        step,
      );
    }

    if (size > targetBytes) {
      logger.error("Could not reach video target size", { targetBytes, size, videoKbps });
      throw Errors.videoTargetUnreachable();
    }
  }
}

import fsp from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

import { config } from "../../config.js";
import { logger } from "../../utils/logger.js";
import { Errors } from "../../utils/errors.js";
import { ExeProcessRunner } from "../exe/ExeProcessRunner.js";
import type { ProcessingRequest, ProcessingResult, ProcessingService } from "../ProcessingService.js";
import {
  isAudioOnlyFormat,
  sanitizeBaseName,
  type UrlDownloadFormat,
  type UrlDownloadSettings,
} from "../../validation/validators.js";
import {
  fetchText,
  guardedRequest,
  parseHttpUrl,
  streamToFile,
  type GuardedResponse,
} from "../../security/urlGuard.js";
import {
  analyzeSource,
  parsePlaylist,
  type HlsSegment,
  type SourceInfo,
  type SourceKind,
  type SourceVariant,
} from "./adapters.js";
import { downloadStreamingMedia, isStreamingPlatform } from "./streamingExtractor.js";

interface ProbeResult {
  durationSec: number;
  width: number;
  height: number;
  hasAudio: boolean;
}

interface Selection {
  downloadUrl: string;
  kind: SourceKind;
  targetHeight?: number;
}

const DOWNLOAD_SPAN = 0.6; // progress reserved for fetching bytes
const TRANSCODE_SPAN = 0.4;

/**
 * Fetches a direct media file or an HLS stream over http(s) and re-containers
 * it locally with FFmpeg. All network access goes through the guarded client,
 * HLS playlists/segments are parsed and fetched here (never handed to FFmpeg),
 * and no attempt is made to defeat encryption, DRM or authentication.
 */
export class UrlDownloadService implements ProcessingService {
  readonly operation = "fetch" as const;

  constructor(private readonly runner: ExeProcessRunner) {}

  async process(request: ProcessingRequest): Promise<ProcessingResult> {
    if (!config.ffmpegExe || !config.ffprobeExe) throw Errors.urlDownloadUnavailable();

    const settings = request.settings as UrlDownloadSettings;

    // Fast-path: Skip redundant analyzeSource overhead for streaming platforms and general web URLs
    let isStream = settings.kind === "stream";
    if (!isStream) {
      try {
        const parsed = new URL(settings.url);
        const looksDirect = /\.(mp4|webm|mkv|mov|avi|ts|mp3|m4a|aac|flac|wav|ogg|m4v|flv|m3u8)$/i.test(parsed.pathname);
        if (isStreamingPlatform(parsed) || !looksDirect) {
          isStream = true;
        }
      } catch {
        // ignore malformed URL
      }
    }

    if (isStream) {
      const outputBaseName = sanitizeBaseName(settings.title || request.outputBaseName, "download");
      const outputPath = path.join(request.outputDir, `${outputBaseName}.${settings.format}`);
      await downloadStreamingMedia(
        settings.url,
        settings.quality,
        settings.format,
        outputPath,
        (fraction) => request.onProgress?.(fraction),
        settings.threads,
        settings.proxy,
      );
      request.onProgress?.(1);
      return { outputPath };
    }

    const info = await analyzeSource(settings.url);

    if (info.kind === "stream") {
      const outputBaseName = sanitizeBaseName(info.title || request.outputBaseName, "download");
      const outputPath = path.join(request.outputDir, `${outputBaseName}.${settings.format}`);
      await downloadStreamingMedia(
        settings.url,
        settings.quality,
        settings.format,
        outputPath,
        (fraction) => request.onProgress?.(fraction),
        settings.threads,
        settings.proxy,
      );
      request.onProgress?.(1);
      return { outputPath };
    }

    const selection = this.select(info, settings.quality);

    const tempPath = path.join(request.outputDir, `.download-${crypto.randomUUID()}.part`);
    try {
      await this.download(selection, tempPath, (fraction) => request.onProgress?.(fraction * DOWNLOAD_SPAN));

      const probe = await this.probe(tempPath);
      const extension = settings.format;
      const outputPath = path.join(request.outputDir, `${request.outputBaseName}.${extension}`);
      await this.transcode(
        tempPath,
        outputPath,
        settings.format,
        selection.targetHeight,
        probe,
        (fraction) => request.onProgress?.(DOWNLOAD_SPAN + fraction * TRANSCODE_SPAN),
      );
      request.onProgress?.(1);
      return { outputPath };
    } finally {
      await fsp.rm(tempPath, { force: true }).catch(() => undefined);
    }
  }

  private select(info: SourceInfo, quality: string): Selection {
    if (quality.startsWith("preset:")) {
      const targetHeight = Number.parseInt(quality.slice("preset:".length), 10) || undefined;
      const best = this.bestVariant(info);
      return { downloadUrl: best.url, kind: best.kind, targetHeight };
    }
    if (/^\d{3,4}$/.test(quality)) {
      const targetHeight = Number.parseInt(quality, 10) || undefined;
      const best = this.bestVariant(info);
      return { downloadUrl: best.url, kind: best.kind, targetHeight };
    }
    const variant = info.variants.find((v) => v.id === quality) ?? info.variants[0];
    return { downloadUrl: variant.url, kind: variant.kind };
  }

  private bestVariant(info: SourceInfo): SourceVariant {
    // HLS variants are pre-sorted best-first by the adapter.
    return info.variants[0];
  }

  private async download(selection: Selection, destPath: string, onProgress: (fraction: number) => void): Promise<void> {
    if (selection.kind === "hls") {
      await this.downloadHls(selection.downloadUrl, destPath, onProgress);
    } else {
      await this.downloadFile(selection.downloadUrl, destPath, onProgress);
    }
  }

  private async downloadFile(url: string, destPath: string, onProgress: (fraction: number) => void): Promise<void> {
    const parsed = parseHttpUrl(url);
    const probe = await guardedRequest(parsed, { headers: { range: "bytes=0-0" } });
    const status = probe.status;
    const acceptRanges = String(probe.headers["accept-ranges"] ?? "").toLowerCase();
    const contentLengthHeader = probe.headers["content-length"];
    const declared = contentLengthHeader ? Number.parseInt(String(contentLengthHeader), 10) : NaN;
    const total = Number.isFinite(declared) && declared > 0 ? declared : null;

    // Drain/destroy probe response
    try { probe.stream.destroy(); } catch { /* ignore */ }

    if (total !== null && total > config.urlDownloadMaxBytes) {
      throw Errors.urlDownloadTooLarge(Math.ceil(config.urlDownloadMaxBytes / 1024 / 1024));
    }

    const supportsRange = acceptRanges.includes("bytes") && (status === 206 || status === 200);

    if (!supportsRange || total === null || total < 2 * 1024 * 1024) {
      // Fall back to single-stream download
      const response = await guardedRequest(parsed);
      if (response.status < 200 || response.status >= 300) {
        response.stream.destroy();
        throw Errors.urlDownloadFailed(`The server responded with ${response.status}.`);
      }
      await streamToFile(response, destPath, config.urlDownloadMaxBytes, ({ received, total: t }) => {
        const fraction = t ? received / t : Math.min(0.99, received / config.urlDownloadMaxBytes);
        onProgress(Math.min(0.99, Math.max(0, fraction)));
      });
      return;
    }

    // Parallel multi-segment download (IDM-style)
    try {
      const concurrency = 6;
      const chunkCount = Math.min(16, Math.max(2, Math.ceil(total / (2 * 1024 * 1024))));
      const chunkSize = Math.ceil(total / chunkCount);
      const ranges: { start: number; end: number }[] = [];
      for (let i = 0; i < chunkCount; i++) {
        const start = i * chunkSize;
        const end = Math.min(total - 1, (i + 1) * chunkSize - 1);
        if (start <= end) ranges.push({ start, end });
      }

      const handle = await fsp.open(destPath, "w");
      const receivedByChunk = new Array(ranges.length).fill(0);
      let receivedTotal = 0;

      const downloadChunk = async (index: number) => {
        const { start, end } = ranges[index];
        const expected = end - start + 1;
        const response = await guardedRequest(parsed, {
          headers: { range: `bytes=${start}-${end}` },
        });
        if (response.status !== 206 && response.status !== 200) {
          response.stream.destroy();
          throw Errors.urlDownloadFailed(`Range request failed (${response.status}).`);
        }
        // Server ignored Range and sent the whole file: fall back to single stream.
        if (response.status === 200) {
          response.stream.destroy();
          throw new Error("NO_RANGE_SUPPORT");
        }
        let written = 0;
        try {
          for await (const chunk of response.stream) {
            const buf = chunk as Buffer;
            await handle.write(buf, 0, buf.length, start + written);
            written += buf.length;
            receivedByChunk[index] = written;
            receivedTotal = receivedByChunk.reduce((a, b) => a + b, 0);
            onProgress(Math.min(0.99, Math.max(0, receivedTotal / total)));
          }
        } catch (err) {
          response.stream.destroy();
          throw err;
        }
        if (written !== expected && response.status === 206) {
          // partial; accept whatever was written
        }
      };

      // Run with bounded concurrency
      let next = 0;
      const workers: Promise<void>[] = [];
      const runNext = async () => {
        while (next < ranges.length) {
          const idx = next++;
          await downloadChunk(idx);
        }
      };
      for (let w = 0; w < Math.min(concurrency, ranges.length); w++) {
        workers.push(runNext());
      }
      try {
        await Promise.all(workers);
      } finally {
        await handle.close();
      }

      // Verify size
      const stat = await fsp.stat(destPath);
      if (stat.size < total) {
        throw Errors.urlDownloadFailed("Download incomplete.");
      }
      onProgress(0.99);
      return;
    } catch (err) {
      // Fall back to single-stream download
      try { await fsp.unlink(destPath).catch(() => undefined); } catch { /* ignore */ }
      const response = await guardedRequest(parsed);
      if (response.status < 200 || response.status >= 300) {
        response.stream.destroy();
        throw Errors.urlDownloadFailed(`The server responded with ${response.status}.`);
      }
      await streamToFile(response, destPath, config.urlDownloadMaxBytes, ({ received, total: t }) => {
        const fraction = t ? received / t : Math.min(0.99, received / config.urlDownloadMaxBytes);
        onProgress(Math.min(0.99, Math.max(0, fraction)));
      });
    }
  }

  private async downloadHls(playlistUrl: string, destPath: string, onProgress: (fraction: number) => void): Promise<void> {
    let current = playlistUrl;
    let { text } = await fetchText(current, config.urlDownloadMaxPlaylistBytes);
    let playlist = parsePlaylist(text, current);

    // A master playlist points at the actual media playlist; follow one level.
    if (playlist.kind === "master") {
      if (playlist.encrypted) throw Errors.urlDownloadEncrypted();
      if (playlist.variants.length === 0) throw Errors.urlDownloadUnsupported();
      current = playlist.variants[0].url;
      ({ text } = await fetchText(current, config.urlDownloadMaxPlaylistBytes));
      playlist = parsePlaylist(text, current);
    }

    if (playlist.kind !== "media") throw Errors.urlDownloadUnsupported();
    if (playlist.encrypted) throw Errors.urlDownloadEncrypted();
    const segments: HlsSegment[] = playlist.segments;
    if (segments.length === 0) throw Errors.urlDownloadUnsupported();
    if (segments.length > config.urlDownloadMaxSegments) {
      throw Errors.urlDownloadTooLarge(Math.ceil(config.urlDownloadMaxBytes / 1024 / 1024));
    }

    const handle = await fsp.open(destPath, "a");
    let written = 0;
    try {
      if (playlist.initSegment) {
        const init = await guardedRequest(playlist.initSegment);
        written += await this.appendResponse(handle, init, written);
      }
      for (let i = 0; i < segments.length; i += 1) {
        const segment = segments[i];
        const headers: Record<string, string> = {};
        if (segment.length !== undefined) {
          const start = segment.offset ?? 0;
          headers.range = `bytes=${start}-${start + segment.length - 1}`;
        }
        const response = await guardedRequest(segment.url, { headers });
        if (response.status < 200 || response.status >= 300) {
          response.stream.destroy();
          throw Errors.urlDownloadFailed(`A stream segment failed (${response.status}).`);
        }
        written += await this.appendResponse(handle, response, written);
        onProgress(Math.min(0.99, (i + 1) / segments.length));
      }
    } finally {
      await handle.close();
    }
  }

  /** Append a response body to an open file handle, enforcing the global cap. */
  private async appendResponse(
    handle: fsp.FileHandle,
    response: GuardedResponse,
    alreadyWritten: number,
  ): Promise<number> {
    let written = 0;
    try {
      for await (const chunk of response.stream) {
        const buf = chunk as Buffer;
        written += buf.length;
        if (alreadyWritten + written > config.urlDownloadMaxBytes) {
          throw Errors.urlDownloadTooLarge(Math.ceil(config.urlDownloadMaxBytes / 1024 / 1024));
        }
        await handle.write(buf);
      }
    } catch (err) {
      response.stream.destroy();
      throw err;
    }
    return written;
  }

  private async probe(inputPath: string): Promise<ProbeResult> {
    const result = await this.runner.run("video-probe", {
      args: ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", inputPath],
      timeoutMs: 60_000,
    });
    if (result.timedOut) throw Errors.timeout();
    if (result.exitCode !== 0) {
      logger.error("ffprobe failed on downloaded media", { exitCode: result.exitCode, stderr: result.stderr.slice(-800) });
      throw Errors.urlDownloadUnsupported();
    }
    let data: { format?: { duration?: string }; streams?: Record<string, unknown>[] };
    try {
      data = JSON.parse(result.stdout) as typeof data;
    } catch {
      throw Errors.urlDownloadFailed("The downloaded media could not be read.");
    }
    const streams = Array.isArray(data.streams) ? data.streams : [];
    const video = streams.find((s) => s.codec_type === "video");
    const hasAudio = streams.some((s) => s.codec_type === "audio");
    const duration = Number(data.format?.duration ?? video?.duration ?? 0);
    return {
      durationSec: Number.isFinite(duration) && duration > 0 ? duration : 0,
      width: Number(video?.width ?? 0) || 0,
      height: Number(video?.height ?? 0) || 0,
      hasAudio,
    };
  }

  private async transcode(
    inputPath: string,
    outputPath: string,
    format: UrlDownloadFormat,
    targetHeight: number | undefined,
    probe: ProbeResult,
    onProgress: (fraction: number) => void,
  ): Promise<void> {
    const audioOnly = isAudioOnlyFormat(format);
    if (audioOnly && !probe.hasAudio) throw Errors.videoNoAudio();

    const filters: string[] = [];
    if (!audioOnly && targetHeight && probe.height > targetHeight && probe.width > 0) {
      const targetWidth = Math.max(2, Math.round((probe.width * targetHeight) / probe.height / 2) * 2);
      filters.push(`scale=${targetWidth}:${targetHeight}`);
    }

    const args = ["-hide_banner", "-loglevel", "error", "-nostdin", "-y", "-threads", "0", "-i", inputPath];
    if (filters.length > 0) args.push("-vf", filters.join(","));
    args.push("-sn", "-dn");

    if (audioOnly) {
      args.push("-vn");
      if (format === "mp3") args.push("-c:a", "libmp3lame", "-b:a", "192k");
      else args.push("-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart");
    } else if (format === "mp4") {
      args.push("-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p", "-threads", "0");
      if (probe.hasAudio) args.push("-c:a", "aac", "-b:a", "128k");
      else args.push("-an");
      args.push("-movflags", "+faststart");
    } else {
      args.push("-c:v", "libvpx-vp9", "-row-mt", "1", "-threads", "0", "-cpu-used", "4", "-crf", "32", "-b:v", "0", "-pix_fmt", "yuv420p");
      if (probe.hasAudio) args.push("-c:a", "libopus", "-b:a", "128k");
      else args.push("-an");
    }

    args.push("-progress", "pipe:1", "-nostats", outputPath);

    const result = await this.runner.run("video", {
      args,
      timeoutMs: config.videoProcessTimeoutMs,
      onStdoutLine: this.progressLogger(onProgress, probe.durationSec),
    });
    if (result.timedOut) throw Errors.timeout();
    if (result.exitCode !== 0) {
      logger.error("FFmpeg failed converting downloaded media", {
        exitCode: result.exitCode,
        stderr: result.stderr.slice(-2000),
      });
      throw Errors.urlDownloadFailed("The downloaded media could not be converted.");
    }
    await fsp.access(outputPath);
  }

  private progressLogger(onProgress: (fraction: number) => void, durationSec: number): ((line: string) => void) | undefined {
    if (durationSec <= 0) return undefined;
    return (line) => {
      const match = /^out_time_ms=(\d+)/.exec(line);
      if (!match) return;
      const seconds = Number(match[1]) / 1_000_000;
      onProgress(Math.min(0.99, Math.max(0, seconds / durationSec)));
    };
  }
}

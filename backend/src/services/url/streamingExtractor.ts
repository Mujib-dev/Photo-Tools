import { spawn } from "node:child_process";
import readline from "node:readline";
import { config } from "../../config.js";
import { Errors } from "../../utils/errors.js";
import { logger } from "../../utils/logger.js";
import type { SourceInfo, SourceVariant } from "./adapters.js";

const STREAMING_PLATFORMS: { domains: string[]; name: string }[] = [
  { domains: ["youtube.com", "youtu.be", "youtube-nocookie.com"], name: "YouTube" },
  {
    domains: [
      "drive.google.com",
      "docs.google.com",
      "drive.usercontent.google.com",
      "googlevideo.com",
      "video.google.com",
      "photos.google.com",
      "share.google",
      "goo.gl",
    ],
    name: "Google Video & Drive",
  },
  { domains: ["tiktok.com"], name: "TikTok" },
  { domains: ["facebook.com", "fb.watch", "fb.com"], name: "Facebook" },
  { domains: ["instagram.com"], name: "Instagram" },
  { domains: ["x.com", "twitter.com"], name: "X (Twitter)" },
  { domains: ["vimeo.com"], name: "Vimeo" },
  { domains: ["dailymotion.com"], name: "Dailymotion" },
  { domains: ["twitch.tv"], name: "Twitch" },
  { domains: ["soundcloud.com"], name: "SoundCloud" },
  { domains: ["bilibili.com"], name: "Bilibili" },
  { domains: ["reddit.com"], name: "Reddit" },
  { domains: ["pinterest.com"], name: "Pinterest" },
  { domains: ["snapchat.com"], name: "Snapchat" },
];
const DRM_PLATFORMS: { domains: string[]; name: string }[] = [
  { domains: ["netflix.com"], name: "Netflix" },
  { domains: ["hulu.com"], name: "Hulu" },
  { domains: ["disneyplus.com"], name: "Disney+" },
  { domains: ["spotify.com"], name: "Spotify" },
];

export function checkDrmPlatform(url: URL): string | null {
  const host = url.hostname.toLowerCase();
  for (const platform of DRM_PLATFORMS) {
    if (platform.domains.some((d) => host === d || host.endsWith(`.${d}`))) {
      return platform.name;
    }
  }
  return null;
}

export function isStreamingPlatform(url: URL): string | null {
  const host = url.hostname.toLowerCase();
  for (const platform of STREAMING_PLATFORMS) {
    if (platform.domains.some((d) => host === d || host.endsWith(`.${d}`))) {
      return platform.name;
    }
  }
  return null;
}

interface RawStreamInfo {
  url: string;
  title: string;
  kind?: string;
  uploader?: string;
  thumbnail?: string;
  contentType?: string;
  contentLength?: number | null;
  durationSec?: number;
  width?: number;
  height?: number;
  qualities?: { id: string; label: string; height?: number; source?: boolean }[];
  formats?: string[];
}

export async function extractStreamingInfo(url: string): Promise<SourceInfo> {
  const python = config.pythonExe || "python";
  const script = config.mediaExtractorScript;

  return new Promise((resolve, reject) => {
    const child = spawn(python, [script, "info", url], {
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdoutData = "";
    let stderrData = "";

    child.stdout.on("data", (chunk: Buffer) => {
      stdoutData += chunk.toString("utf8");
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderrData += chunk.toString("utf8");
    });

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(Errors.timeout());
    }, 45_000);

    child.on("error", (err) => {
      clearTimeout(timer);
      logger.error("Failed to spawn media extractor python process", { error: err.message });
      reject(Errors.urlDownloadUnsupported());
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        logger.warn("media extractor info failed", { code, stderr: stderrData.slice(-600) });
        const combinedErr = `${stderrData}\n${stdoutData}`;
        if (/ConnectionResetError|10054|Connection refused|ETIMEDOUT|EHOSTUNREACH|Connection aborted/i.test(combinedErr)) {
          reject(Errors.urlDownloadFailed("The video hosting site is blocked by your ISP/network or unreachable."));
          return;
        }
        if (/This video is unavailable|Private video|Video unavailable|404 Not Found|HTTP Error 404/i.test(combinedErr)) {
          reject(Errors.urlDownloadFailed("This video is unavailable, private, or has been removed."));
          return;
        }
        reject(Errors.urlDownloadFailed("Could not retrieve video from this link. The video may be private, restricted, or temporarily unavailable."));
        return;
      }

      try {
        const raw = JSON.parse(stdoutData.trim()) as RawStreamInfo;
        const variants: SourceVariant[] = (raw.qualities ?? [{ id: "source", label: "Original", source: true }]).map(
          (q) => ({
            id: q.id,
            label: q.label,
            url: raw.url,
            kind: "stream",
            height: q.height,
            width: raw.width,
            container: "mp4",
          }),
        );

        const info: SourceInfo = {
          finalUrl: raw.url,
          kind: "stream",
          title: raw.title || "Online Video",
          uploader: raw.uploader,
          thumbnail: raw.thumbnail,
          contentType: raw.contentType ?? "video/mp4",
          contentLength: raw.contentLength ?? null,
          durationSec: raw.durationSec,
          width: raw.width,
          height: raw.height,
          variants,
        };
        resolve(info);
      } catch (err) {
        logger.error("Failed to parse media extractor JSON", { err, stdout: stdoutData.slice(0, 300) });
        reject(Errors.urlDownloadFailed("Could not parse media information from this webpage."));
      }
    });
  });
}

export async function downloadStreamingMedia(
  url: string,
  quality: string,
  format: string,
  outputPath: string,
  onProgress?: (fraction: number) => void,
  threads?: number,
  proxy?: string,
): Promise<void> {
  const python = config.pythonExe || "python";
  const script = config.mediaExtractorScript;
  const ffmpeg = config.ffmpegExe || "";

  return new Promise((resolve, reject) => {
    const args = [
      script,
      "download",
      url,
      "--quality",
      quality,
      "--format",
      format,
      "--output",
      outputPath,
    ];
    if (ffmpeg) {
      args.push("--ffmpeg", ffmpeg);
    }
    if (threads && threads > 0) {
      args.push("--threads", String(threads));
    }
    if (proxy && proxy.trim().length > 0) {
      args.push("--proxy", proxy.trim());
    }

    const child = spawn(python, args, {
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });

    const handleProgressText = (text: string) => {
      const regex = /PROGRESS:([0-9.]+)/g;
      let match: RegExpExecArray | null;
      while ((match = regex.exec(text)) !== null) {
        const frac = Number.parseFloat(match[1]);
        if (Number.isFinite(frac) && onProgress) {
          onProgress(frac);
        }
      }
    };

    child.stdout.on("data", (chunk: Buffer) => {
      handleProgressText(chunk.toString("utf8"));
    });

    const rl = readline.createInterface({ input: child.stdout });
    rl.on("line", (line) => {
      handleProgressText(line);
    });

    let stderrData = "";
    child.stderr.on("data", (chunk: Buffer) => {
      stderrData += chunk.toString("utf8");
    });

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(Errors.timeout());
    }, config.videoProcessTimeoutMs);

    child.on("error", (err) => {
      clearTimeout(timer);
      logger.error("Failed to spawn media extractor download process", { error: err.message });
      reject(Errors.urlDownloadFailed("Could not start streaming downloader."));
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        logger.error("media extractor download failed", { code, stderr: stderrData.slice(-1000) });
        reject(Errors.urlDownloadFailed("Download failed or streaming source restricted."));
        return;
      }
      onProgress?.(1);
      resolve();
    });
  });
}

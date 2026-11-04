import path from "node:path";

import { config } from "../../config.js";
import { AppError, Errors } from "../../utils/errors.js";
import {
  drain,
  fetchText,
  guardedRequest,
  parseHttpUrl,
  readBounded,
  unwrapGoogleUrl,
} from "../../security/urlGuard.js";

import {
  checkDrmPlatform,
  extractStreamingInfo,
  isStreamingPlatform,
} from "./streamingExtractor.js";

/**
 * Source adapters for the URL downloader. Three kinds of source are
 * understood: a direct media file served over http(s), an HLS playlist
 * (`.m3u8`), and streaming video platforms via media extractor (YouTube, Vimeo, etc.).
 * Encrypted playlists and DRM platforms are reported and refused.
 */

export type SourceKind = "direct" | "hls" | "stream";

export interface SourceVariant {
  id: string;
  label: string;
  url: string;
  kind: SourceKind;
  height?: number;
  width?: number;
  bandwidth?: number;
  container?: string;
}

export interface SourceInfo {
  finalUrl: string;
  kind: SourceKind;
  title: string;
  contentType: string | null;
  contentLength: number | null;
  durationSec?: number;
  width?: number;
  height?: number;
  uploader?: string;
  thumbnail?: string;
  variants: SourceVariant[];
}

export interface HlsSegment {
  url: string;
  duration: number;
  length?: number;
  offset?: number;
}

export interface HlsMasterVariant {
  url: string;
  bandwidth?: number;
  width?: number;
  height?: number;
  name?: string;
}

export type HlsPlaylist =
  | { kind: "master"; variants: HlsMasterVariant[]; encrypted: boolean }
  | {
      kind: "media";
      segments: HlsSegment[];
      initSegment: string | null;
      durationSec: number;
      encrypted: boolean;
    };

const CONTAINER_BY_MIME: Record<string, string> = {
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
  "video/x-matroska": "mkv",
  "video/x-msvideo": "avi",
  "video/mpeg": "mpeg",
  "video/2dts": "ts",
  "video/mp2t": "ts",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/aac": "aac",
  "audio/ogg": "ogg",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/flac": "flac",
};

function headerText(headers: Record<string, unknown>, name: string): string | null {
  const raw = headers[name];
  if (Array.isArray(raw)) return raw[0] ?? null;
  return typeof raw === "string" ? raw : null;
}

function parseAttributes(line: string): Record<string, string> {
  const out: Record<string, string> = {};
  // Values may be quoted; commas inside quotes do not separate attributes.
  const re = /([A-Z0-9-]+)=("[^"]*"|[^,]*)/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(line)) !== null) {
    const value = match[2].startsWith('"') ? match[2].slice(1, -1) : match[2];
    out[match[1].toUpperCase()] = value.trim();
  }
  return out;
}

/** Parse a playlist into either a master (renditions) or a media (segments) form. */
export function parsePlaylist(text: string, baseUrl: string): HlsPlaylist {
  const lines = text.split(/\r?\n/).map((line) => line.trim());
  if (!lines.some((line) => line === "#EXTM3U")) {
    throw Errors.urlDownloadUnsupported();
  }

  const encrypted = lines.some((line) => {
    if (!line.startsWith("#EXT-X-KEY:") && !line.startsWith("#EXT-X-SESSION-KEY:")) return false;
    const method = parseAttributes(line).METHOD?.toUpperCase();
    return !!method && method !== "NONE";
  });

  const resolve = (uri: string): string => new URL(uri, baseUrl).href;
  const isMaster = lines.some((line) => line.startsWith("#EXT-X-STREAM-INF:"));

  if (isMaster) {
    const variants: HlsMasterVariant[] = [];
    for (let i = 0; i < lines.length; i += 1) {
      if (!lines[i].startsWith("#EXT-X-STREAM-INF:")) continue;
      const attrs = parseAttributes(lines[i]);
      let uri = "";
      for (let j = i + 1; j < lines.length; j += 1) {
        if (lines[j] && !lines[j].startsWith("#")) {
          uri = lines[j];
          break;
        }
      }
      if (!uri) continue;
      let width: number | undefined;
      let height: number | undefined;
      if (attrs.RESOLUTION) {
        const [w, h] = attrs.RESOLUTION.split("x").map((n) => Number.parseInt(n, 10));
        if (Number.isFinite(w) && Number.isFinite(h)) {
          width = w;
          height = h;
        }
      }
      variants.push({
        url: resolve(uri),
        bandwidth: attrs.BANDWIDTH ? Number.parseInt(attrs.BANDWIDTH, 10) : undefined,
        width,
        height,
        name: attrs.NAME,
      });
    }
    // Stable, deterministic ordering so variant ids survive re-analysis.
    variants.sort((a, b) => (b.height ?? 0) - (a.height ?? 0) || (b.bandwidth ?? 0) - (a.bandwidth ?? 0));
    return { kind: "master", variants, encrypted };
  }

  const segments: HlsSegment[] = [];
  let initSegment: string | null = null;
  let durationSec = 0;
  let pendingDuration = 0;
  let pendingLength: number | undefined;
  let pendingOffset: number | undefined;
  let prev: HlsSegment | null = null;

  for (const line of lines) {
    if (line.startsWith("#EXT-X-MAP:")) {
      const uri = parseAttributes(line).URI;
      if (uri) initSegment = resolve(uri);
    } else if (line.startsWith("#EXTINF:")) {
      pendingDuration = Number.parseFloat(line.slice(8).split(",")[0]) || 0;
    } else if (line.startsWith("#EXT-X-BYTERANGE:")) {
      const [lenStr, offStr] = line.slice(17).split("@");
      pendingLength = Number.parseInt(lenStr, 10) || undefined;
      pendingOffset = offStr ? Number.parseInt(offStr, 10) : undefined;
    } else if (line && !line.startsWith("#")) {
      const url = resolve(line);
      let offset = pendingOffset;
      if (pendingLength !== undefined && offset === undefined && prev?.length !== undefined && prev.offset !== undefined) {
        offset = prev.offset + prev.length;
      }
      const segment: HlsSegment = { url, duration: pendingDuration, length: pendingLength, offset };
      segments.push(segment);
      prev = segment;
      durationSec += pendingDuration;
      pendingDuration = 0;
      pendingLength = undefined;
      pendingOffset = undefined;
    }
  }

  return { kind: "media", segments, initSegment, durationSec, encrypted };
}

function containerFromContentType(contentType: string | null, url: URL): string | undefined {
  const mime = contentType?.split(";")[0]?.trim().toLowerCase();
  if (mime && CONTAINER_BY_MIME[mime]) return CONTAINER_BY_MIME[mime];
  const ext = path.posix.extname(url.pathname).replace(".", "").toLowerCase();
  return /^[a-z0-9]{1,5}$/.test(ext) ? ext : undefined;
}

function titleFromUrl(url: URL): string {
  const base = path.posix.basename(url.pathname);
  const withoutExt = base.replace(/\.[a-z0-9]{1,5}$/i, "").replace(/[+_]+/g, " ").trim();
  return withoutExt || "Downloaded media";
}

async function analyzeHls(url: URL): Promise<SourceInfo> {
  const { text } = await fetchText(url, config.urlDownloadMaxPlaylistBytes);
  const playlist = parsePlaylist(text, url.href);
  if (playlist.encrypted) throw Errors.urlDownloadEncrypted();

  if (playlist.kind === "master") {
    if (playlist.variants.length === 0) throw Errors.urlDownloadUnsupported();
    const variants: SourceVariant[] = playlist.variants.map((variant, index) => ({
      id: `hls-${index}`,
      label: variant.height ? `${variant.height}p` : variant.bandwidth ? `${Math.round(variant.bandwidth / 1000)} kbps` : `Stream ${index + 1}`,
      url: variant.url,
      kind: "hls",
      height: variant.height,
      width: variant.width,
      bandwidth: variant.bandwidth,
    }));
    const best = variants[0];
    return {
      finalUrl: url.href,
      kind: "hls",
      title: titleFromUrl(url),
      contentType: "application/vnd.apple.mpegurl",
      contentLength: null,
      width: best.width,
      height: best.height,
      variants,
    };
  }

  if (playlist.segments.length === 0) throw Errors.urlDownloadUnsupported();
  return {
    finalUrl: url.href,
    kind: "hls",
    title: titleFromUrl(url),
    contentType: "application/vnd.apple.mpegurl",
    contentLength: null,
    durationSec: playlist.durationSec || undefined,
    variants: [{ id: "source", label: "Original", url: url.href, kind: "hls" }],
  };
}

async function directInfo(url: URL, contentType: string | null, contentLength: number | null): Promise<SourceInfo> {
  return {
    finalUrl: url.href,
    kind: "direct",
    title: titleFromUrl(url),
    contentType,
    contentLength,
    variants: [
      {
        id: "source",
        label: "Original",
        url: url.href,
        kind: "direct",
        container: containerFromContentType(contentType, url),
      },
    ],
  };
}

const ARCHIVE_DETAIL_HOSTS = new Set(["archive.org", "www.archive.org"]);

/** Pull the item identifier out of an archive.org details/download/etc. page URL. */
function archiveIdentifier(url: URL): string | null {
  if (!ARCHIVE_DETAIL_HOSTS.has(url.hostname.toLowerCase())) return null;
  const match = /^\/(?:details|download|embed|metadata|stream)\/([^/]+)/i.exec(url.pathname);
  if (!match) return null;
  const id = decodeURIComponent(match[1]).trim();
  return id || null;
}

const ARCHIVE_MEDIA_EXT = new Set([
  "mp4", "m4v", "mov", "webm", "mkv", "ogv", "ogg", "avi", "mpg", "mpeg", "ts", "m2ts", "flv",
  "mp3", "m4a", "aac", "flac", "wav", "oga", "opus", "wma",
]);

function archiveNumber(value: unknown): number | undefined {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function archiveFileUrl(identifier: string, name: string): string {
  const encoded = name.split("/").map((segment) => encodeURIComponent(segment)).join("/");
  return `https://archive.org/download/${encodeURIComponent(identifier)}/${encoded}`;
}

function archiveLabel(ext: string, format: string | undefined, height?: number, size?: number): string {
  const parts = [format ?? ext.toUpperCase()];
  if (height) parts.push(`${height}p`);
  if (size) parts.push(`${(size / 1024 / 1024).toFixed(1)} MB`);
  return parts.join(" · ");
}

interface ArchiveFile {
  name?: string;
  format?: string;
  size?: string;
  length?: string;
  height?: string;
  width?: string;
}

/**
 * archive.org is a public digital library that exposes an open metadata API and
 * serves its media over plain http(s). Given a details/download page we resolve
 * the item's downloadable media files and offer each as a variant.
 */
async function analyzeArchiveOrg(url: URL, identifier: string): Promise<SourceInfo> {
  const metaUrl = `https://archive.org/metadata/${encodeURIComponent(identifier)}`;
  const response = await guardedRequest(metaUrl, { headers: { accept: "application/json" } });
  try {
    if (response.status < 200 || response.status >= 300) {
      throw Errors.urlDownloadUnsupported();
    }
    const body = await readBounded(response.stream, config.urlDownloadMaxPlaylistBytes);
    let data: { files?: ArchiveFile[]; metadata?: { title?: string; identifier?: string } };
    try {
      data = JSON.parse(body.toString("utf8")) as typeof data;
    } catch {
      throw Errors.urlDownloadUnsupported();
    }

    const files = Array.isArray(data.files) ? data.files : [];
    const media = files.filter((file) => {
      const name = file.name ?? "";
      const ext = path.posix.extname(name).replace(".", "").toLowerCase();
      return ARCHIVE_MEDIA_EXT.has(ext) && !name.endsWith("_files.xml");
    });
    if (media.length === 0) throw Errors.urlDownloadUnsupported();

    media.sort(
      (a, b) =>
        (archiveNumber(b.height) ?? 0) - (archiveNumber(a.height) ?? 0) ||
        (archiveNumber(b.size) ?? 0) - (archiveNumber(a.size) ?? 0) ||
        (a.name ?? "").localeCompare(b.name ?? ""),
    );

    const variants: SourceVariant[] = media.slice(0, 50).map((file, index) => {
      const name = file.name as string;
      const ext = path.posix.extname(name).replace(".", "").toLowerCase();
      const height = archiveNumber(file.height);
      const size = archiveNumber(file.size);
      return {
        id: `archive-${index}`,
        label: archiveLabel(ext, file.format, height, size),
        url: archiveFileUrl(identifier, name),
        kind: "direct",
        height,
        width: archiveNumber(file.width),
        container: ext,
      };
    });

    return {
      finalUrl: url.href,
      kind: "direct",
      title: (data.metadata?.title ?? identifier).toString(),
      contentType: null,
      contentLength: null,
      variants,
    };
  } catch (err) {
    response.stream.destroy();
    throw err;
  }
}

/**
 * Inspect a URL and return everything the UI and download service need:
 * whether it is a direct file or an HLS stream, and the selectable variants.
 */
export async function analyzeSource(rawUrl: string | URL): Promise<SourceInfo> {
  let url = typeof rawUrl === "string" ? parseHttpUrl(rawUrl) : parseHttpUrl(rawUrl.href);
  const unwrapped = unwrapGoogleUrl(url.href);
  if (unwrapped !== url.href) {
    url = parseHttpUrl(unwrapped);
  }

  const archiveId = archiveIdentifier(url);
  if (archiveId) return analyzeArchiveOrg(url, archiveId);

  const drm = checkDrmPlatform(url);
  if (drm) throw Errors.urlDownloadPlatformUnsupported(drm);

  const looksHls = /\.m3u8$/i.test(url.pathname);
  const looksDirectMedia = /\.(mp4|webm|mkv|mov|avi|ts|mp3|m4a|aac|flac|wav|ogg|m4v|flv)$/i.test(url.pathname);

  if (looksHls) {
    return analyzeHls(url);
  }

  // Universal Video Downloader: Any streaming platform or general website URL across the web
  if (isStreamingPlatform(url) || !looksDirectMedia) {
    try {
      return await extractStreamingInfo(url.href);
    } catch (streamErr) {
      if (
        streamErr instanceof AppError &&
        (streamErr.safe.includes("blocked by your ISP") ||
          streamErr.safe.includes("private") ||
          streamErr.safe.includes("removed"))
      ) {
        throw streamErr;
      }
      // If it wasn't a standard streaming webpage, it might still be a direct media stream
      // served without an explicit file extension (e.g. /stream?id=123). Continue to probe below.
    }
  }

  // A cheap HEAD tells us the content type/length for direct files.
  let contentType: string | null = null;
  let contentLength: number | null = null;
  let finalUrl = url;
  let headOk = false;
  try {
    const res = await guardedRequest(url, { method: "HEAD" });
    drain(res);
    if (res.status >= 200 && res.status < 300) {
      headOk = true;
      finalUrl = res.finalUrl;

      // If redirected to a wrapper, unwrap it!
      if (finalUrl.href !== url.href) {
        const unwrappedRedirect = unwrapGoogleUrl(finalUrl.href);
        if (unwrappedRedirect !== finalUrl.href) {
          return analyzeSource(unwrappedRedirect);
        }
      }

      contentType = headerText(res.headers as Record<string, unknown>, "content-type");
      const len = Number.parseInt(headerText(res.headers as Record<string, unknown>, "content-length") ?? "", 10);
      contentLength = Number.isFinite(len) && len > 0 ? len : null;
    }
  } catch {
    // Fall back to a ranged GET below.
  }

  if (contentType?.toLowerCase().includes("mpegurl")) {
    return analyzeHls(finalUrl);
  }

  if (headOk) {
    if (contentType && !isMediaType(contentType) && !contentType.startsWith("application/octet-stream")) {
      // Still allow unknown content types with a media-looking extension.
      if (!containerFromContentType(contentType, finalUrl)) {
        if (contentType.toLowerCase().includes("text/html")) {
          try {
            return await extractStreamingInfo(finalUrl.href);
          } catch (err) {
            if (err instanceof AppError) throw err;
          }
        }
        throw Errors.urlDownloadFailed(
          "Could not retrieve video from this link. The video may be private, restricted, or temporarily unavailable.",
        );
      }
    }
    return directInfo(finalUrl, contentType, contentLength);
  }

  // HEAD was refused: sniff the first bytes of the resource with a ranged GET.
  const res = await guardedRequest(url, { headers: { range: "bytes=0-2047" } });
  try {
    if (res.status < 200 || res.status >= 300) {
      drain(res);
      // As last attempt, try extractStreamingInfo
      try {
        return await extractStreamingInfo(url.href);
      } catch (err) {
        if (err instanceof AppError) throw err;
        throw Errors.urlDownloadFailed(
          "Could not retrieve video from this link. The video may be private, restricted, or temporarily unavailable.",
        );
      }
    }

    if (res.finalUrl.href !== url.href) {
      const unwrappedRedirect = unwrapGoogleUrl(res.finalUrl.href);
      if (unwrappedRedirect !== res.finalUrl.href) {
        drain(res);
        return analyzeSource(unwrappedRedirect);
      }
    }

    const type = headerText(res.headers as Record<string, unknown>, "content-type");
    const contentRange = headerText(res.headers as Record<string, unknown>, "content-range");
    const totalFromRange =
      contentRange && /\/(\d+)$/.test(contentRange)
        ? Number.parseInt(contentRange.replace(/^.*\//, ""), 10)
        : NaN;
    let total = Number.isFinite(totalFromRange) ? totalFromRange : null;
    if (total === null && res.status === 200) {
      const len = Number.parseInt(headerText(res.headers as Record<string, unknown>, "content-length") ?? "", 10);
      total = Number.isFinite(len) && len > 0 ? len : null;
    }
    const head = await readBounded(res.stream, 4096);
    const text = head.toString("utf8").trimStart();
    if (text.startsWith("#EXTM3U") || (type ?? "").toLowerCase().includes("mpegurl")) {
      return analyzeHls(res.finalUrl);
    }
    if (
      type &&
      !isMediaType(type) &&
      !type.startsWith("application/octet-stream") &&
      !containerFromContentType(type, res.finalUrl)
    ) {
      if (type.toLowerCase().includes("text/html")) {
        try {
          return await extractStreamingInfo(res.finalUrl.href);
        } catch (err) {
          if (err instanceof AppError) throw err;
        }
      }
      throw Errors.urlDownloadFailed(
        "Could not retrieve video from this link. The video may be private, restricted, or temporarily unavailable.",
      );
    }
    return directInfo(res.finalUrl, type ?? null, total);
  } catch (err) {
    res.stream.destroy();
    throw err;
  }
}

function isMediaType(contentType: string): boolean {
  const mime = contentType.split(";")[0].trim().toLowerCase();
  return mime.startsWith("video/") || mime.startsWith("audio/");
}

/**
 * Flatten a source into the quality options offered to the user: the source
 * renditions (HLS variants, or the original file) followed by downscaling
 * presets that reuse the best available rendition.
 */
export interface QualityOption {
  id: string;
  label: string;
  height?: number;
  source: boolean;
}

const PRESET_HEIGHTS = [2160, 1440, 1080, 720, 480, 360];

const AUDIO_CONTAINERS = new Set(["mp3", "m4a", "aac", "flac", "wav", "oga", "opus", "wma", "ogg"]);

export function describeQualities(info: SourceInfo): QualityOption[] {
  if (info.kind === "stream") {
    return info.variants.map((v) => ({
      id: v.id,
      label: v.label,
      height: v.height,
      source: v.id === "source",
    }));
  }

  const options: QualityOption[] = info.variants.map((variant) => ({
    id: variant.id,
    label: variant.label,
    height: variant.height,
    source: true,
  }));

  // Audio-only items (e.g. an archive.org music recording) get no scaling presets.
  const hasVideo = info.variants.some((v) => !v.container || !AUDIO_CONTAINERS.has(v.container));
  if (!hasVideo) return options;

  const sourceHeights = info.variants.map((v) => v.height).filter((h): h is number => typeof h === "number" && h > 0);
  const maxHeight = sourceHeights.length > 0 ? Math.max(...sourceHeights) : info.height ?? 0;
  for (const height of PRESET_HEIGHTS) {
    if (maxHeight && height > maxHeight) continue;
    if (sourceHeights.includes(height)) continue; // already offered as a source rendition
    options.push({ id: `preset:${height}`, label: `${height}p`, height, source: false });
  }
  return options;
}

export type { SourceInfo as AnalyzedSource };

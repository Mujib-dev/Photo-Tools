import http from "node:http";
import https from "node:https";
import { createWriteStream } from "node:fs";
import { lookup as dnsLookup } from "node:dns";
import { isIP } from "node:net";
import path from "node:path";
import { once } from "node:events";

import { config } from "../config.js";
import { Errors } from "../utils/errors.js";

/**
 * A deliberately small, SSRF-conscious HTTP client used only by the URL
 * downloader. It never follows redirects automatically and never lets the
 * kernel resolve a hostname on its own:
 *
 * - Only `http:`/`https:` URLs are accepted, and URLs carrying embedded
 *   credentials are rejected outright.
 * - Every hop (including each redirect) has its hostname resolved through a
 *   custom `lookup` that refuses loopback, private, link-local, CGNAT and
 *   multicast addresses. Because the same lookup performs the actual connect,
 *   a DNS-rebinding answer cannot slip past the validation.
 * - Redirects are followed manually with a hard cap, re-validating each target.
 * - Reads are byte-capped and sockets carry an idle timeout plus a total
 *   deadline so a hostile server cannot hang a worker forever.
 */

const USER_AGENT = "PicTools/1.0 (+url-downloader)";
/** Bytes reserved for response headers before we bail out. */
const MAX_HEADER_BYTES = 256 * 1024;
/** No new bytes for this long → abort. */
const SOCKET_IDLE_TIMEOUT_MS = 30_000;

export interface GuardedResponse {
  status: number;
  headers: http.IncomingHttpHeaders;
  stream: http.IncomingMessage;
  finalUrl: URL;
}

export interface RequestOptions {
  method?: string;
  headers?: Record<string, string>;
  /** Total wall-clock budget for the request (headers *and* body). */
  timeoutMs?: number;
  maxRedirects?: number;
}

/** True when an IP literal belongs to a range we must not reach out to. */
export function isPrivateAddress(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) {
    const [a, b] = ip.split(".").map(Number);
    if (a === 0 || a === 10 || a === 127) return true; // "this host", private, loopback
    if (a === 169 && b === 254) return true; // link-local
    if (a === 172 && b >= 16 && b <= 31) return true; // private
    if (a === 192 && b === 168) return true; // private
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a === 192 && b === 0) return true; // IETF protocol assignments
    if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
    if (a >= 224) return true; // multicast + reserved + broadcast
    return false;
  }
  if (version === 6) {
    const lower = ip.toLowerCase();
    if (lower === "::" || lower === "::1") return true;
    if (lower.startsWith("fe80") || lower.startsWith("fec0")) return true; // link/site-local
    if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // unique local
    if (lower.startsWith("ff")) return true; // multicast
    const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(lower);
    if (mapped) return isPrivateAddress(mapped[1]);
    return false;
  }
  // Unparseable → treat as unsafe.
  return true;
}

/**
 * `net` connect lookup that filters out non-public addresses. Used for the
 * actual socket connect so validation and resolution cannot be raced.
 */
function guardedLookup(
  hostname: string,
  options: { all?: boolean },
  callback: (err: NodeJS.ErrnoException | null, address?: unknown, family?: number) => void,
): void {
  dnsLookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) {
      callback(err);
      return;
    }
    const list = Array.isArray(addresses) ? addresses : [addresses];
    const allowed = config.urlDownloadAllowPrivate
      ? list
      : list.filter((entry) => !isPrivateAddress(entry.address));
    if (allowed.length === 0) {
      const blocked = new Error(
        `Refusing to connect to ${hostname}: it resolves only to non-public addresses.`,
      ) as NodeJS.ErrnoException;
      blocked.code = "EHOSTUNREACH";
      callback(blocked);
      return;
    }
    if (options.all) {
      callback(null, allowed);
      return;
    }
    callback(null, allowed[0].address, allowed[0].family);
  });
}

/**
 * Unwraps Google search redirects, video search results, and Google-routed links
 * to their real destination video URLs (YouTube, Vimeo, direct MP4, etc.)
 */
export function unwrapGoogleUrl(rawUrl: string): string {
  if (typeof rawUrl !== "string") return "";
  const trimmed = rawUrl.trim();
  if (!trimmed) return "";

  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.toLowerCase();

    // Match google.com, google.co.uk, share.google, goo.gl, etc.
    const isGoogleSearchHost =
      host === "google.com" ||
      host.endsWith(".google.com") ||
      host === "share.google" ||
      host.endsWith(".google") ||
      host === "goo.gl" ||
      host.endsWith(".goo.gl") ||
      /(?:^|\.)google\.[a-z]{2,3}(?:\.[a-z]{2})?$/.test(host);

    if (isGoogleSearchHost) {
      // 1. Google search redirect: /url?url=... or /url?q=...
      if (parsed.pathname === "/url") {
        const target = parsed.searchParams.get("url") || parsed.searchParams.get("q");
        if (target && /^https?:\/\//i.test(target)) {
          return target;
        }
      }

      // 2. Google images / video preview: /imgres?imgrefurl=... or imgurl=...
      if (parsed.pathname === "/imgres") {
        const imgUrl = parsed.searchParams.get("imgurl");
        const pageUrl = parsed.searchParams.get("imgrefurl");
        if (imgUrl && /\.(mp4|webm|mkv|mov|avi|ts|m3u8)(\?.*)?$/i.test(imgUrl)) {
          return imgUrl;
        }
        if (pageUrl && /^https?:\/\//i.test(pageUrl)) {
          return pageUrl;
        }
        if (imgUrl && /^https?:\/\//i.test(imgUrl)) {
          return imgUrl;
        }
      }

      // 3. Fallback: Any search param that is a full http(s) URL pointing outside google search
      for (const [, val] of parsed.searchParams.entries()) {
        if (/^https?:\/\/(?!([a-z0-9-]+\.)?google\.(?:com|[a-z]{2,3}))/i.test(val)) {
          return val;
        }
      }
    }
  } catch {
    // If not a parseable URL, return trimmed original
  }

  return trimmed;
}

/** Validate a raw string / URL as an http(s) URL without credentials. */
export function parseHttpUrl(raw: unknown): URL {
  if (typeof raw !== "string") throw Errors.invalidUrl();
  const text = unwrapGoogleUrl(raw).trim();
  if (!text || text.length > config.maxUrlLength) throw Errors.invalidUrl();
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    throw Errors.invalidUrl();
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw Errors.invalidUrl("Only http and https URLs are supported.");
  }
  if (url.username || url.password) {
    throw Errors.invalidUrl("URLs with embedded credentials are not supported.");
  }
  return url;
}

/** Quick synchronous check used to reject literals before any I/O. */
function assertLiteralHostAllowed(url: URL): void {
  if (config.urlDownloadAllowPrivate) return;
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host) && isPrivateAddress(host)) {
    throw Errors.invalidUrl("That address is not allowed.");
  }
}

function requestOnce(url: URL, opts: RequestOptions): Promise<GuardedResponse> {
  const isHttps = url.protocol === "https:";
  const transport = isHttps ? https : http;
  const timeoutMs = opts.timeoutMs ?? config.urlDownloadTimeoutMs;

  return new Promise<GuardedResponse>((resolve, reject) => {
    let settled = false;
    const finish = (err: NodeJS.ErrnoException | null, value?: GuardedResponse): void => {
      if (settled) return;
      settled = true;
      clearTimeout(deadline);
      if (err) reject(err);
      else resolve(value as GuardedResponse);
    };

    const request = transport.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: `${url.pathname}${url.search}`,
        method: opts.method ?? "GET",
        headers: {
          "user-agent": USER_AGENT,
          accept: "*/*",
          "accept-encoding": "identity",
          ...opts.headers,
        },
        lookup: guardedLookup as never,
        maxHeaderSize: MAX_HEADER_BYTES,
      },
      (response) => {
        response.setTimeout(SOCKET_IDLE_TIMEOUT_MS, () => {
          response.destroy(new Error("The server stopped responding."));
        });
        finish(null, { status: response.statusCode ?? 0, headers: response.headers, stream: response, finalUrl: url });
      },
    );

    const deadline = setTimeout(() => {
      request.destroy(new Error("Timed out while contacting the server."));
    }, timeoutMs);
    deadline.unref();

    request.setTimeout(SOCKET_IDLE_TIMEOUT_MS, () => {
      request.destroy(new Error("The server stopped responding."));
    });
    request.on("error", (err) => finish(err));
    request.end();
  });
}

/**
 * Perform a request, manually following redirects (each hop is re-validated).
 * The returned response body is a live stream the caller must consume/destroy.
 */
export async function guardedRequest(rawUrl: URL | string, opts: RequestOptions = {}): Promise<GuardedResponse> {
  let current = typeof rawUrl === "string" ? parseHttpUrl(rawUrl) : rawUrl;
  const maxRedirects = opts.maxRedirects ?? config.urlDownloadMaxRedirects;

  for (let hop = 0; ; hop += 1) {
    assertLiteralHostAllowed(current);
    const response = await requestOnce(current, opts);
    const location = response.headers.location;
    if (response.status >= 300 && response.status < 400 && location) {
      response.stream.resume(); // discard the (tiny) redirect body
      if (hop >= maxRedirects) throw Errors.urlDownloadFailed("Too many redirects.");
      let next: URL;
      try {
        next = new URL(location, current);
      } catch {
        throw Errors.urlDownloadFailed("The server returned an invalid redirect.");
      }
      current = parseHttpUrl(next.href);
      continue;
    }
    return response;
  }
}

/** Read a bounded response body fully into memory (playlists, probes). */
export async function readBounded(stream: http.IncomingMessage, maxBytes: number): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of stream) {
    const buf = chunk as Buffer;
    total += buf.length;
    if (total > maxBytes) {
      stream.destroy();
      throw Errors.urlDownloadTooLarge(Math.ceil(maxBytes / 1024 / 1024));
    }
    chunks.push(buf);
  }
  return Buffer.concat(chunks);
}

export interface DownloadProgress {
  received: number;
  total: number | null;
}

/** Stream a response body to a file, enforcing a byte cap and reporting progress. */
export async function streamToFile(
  response: GuardedResponse,
  destPath: string,
  maxBytes: number,
  onProgress?: (progress: DownloadProgress) => void,
): Promise<number> {
  const lengthHeader = response.headers["content-length"];
  const declared = lengthHeader ? Number.parseInt(String(lengthHeader), 10) : NaN;
  const total = Number.isFinite(declared) && declared > 0 ? declared : null;
  if (total !== null && total > maxBytes) {
    response.stream.destroy();
    throw Errors.urlDownloadTooLarge(Math.ceil(maxBytes / 1024 / 1024));
  }

  const file = createWriteStream(destPath);
  let received = 0;
  try {
    for await (const chunk of response.stream) {
      const buf = chunk as Buffer;
      received += buf.length;
      if (received > maxBytes) {
        throw Errors.urlDownloadTooLarge(Math.ceil(maxBytes / 1024 / 1024));
      }
      if (!file.write(buf)) await once(file, "drain");
      onProgress?.({ received, total });
    }
    file.end();
    await once(file, "finish");
    return received;
  } catch (err) {
    response.stream.destroy();
    file.destroy();
    throw err;
  }
}

/** Fetch a small text resource (playlist) with the guard rails applied. */
export async function fetchText(rawUrl: URL | string, maxBytes: number): Promise<{ text: string; finalUrl: string }> {
  const response = await guardedRequest(rawUrl, { headers: { accept: "application/vnd.apple.mpegurl, application/x-mpegURL, text/plain, */*" } });
  try {
    if (response.status < 200 || response.status >= 300) {
      throw Errors.urlDownloadFailed(`The server responded with ${response.status}.`);
    }
    const body = await readBounded(response.stream, maxBytes);
    return { text: body.toString("utf8"), finalUrl: response.finalUrl.href };
  } catch (err) {
    response.stream.destroy();
    throw err;
  }
}

/** Extension guess from URL path (used only to name the temporary download). */
export function guessExtension(url: URL, fallback = "bin"): string {
  const base = path.posix.basename(url.pathname);
  const ext = path.extname(base).replace(".", "").toLowerCase();
  return /^[a-z0-9]{1,5}$/.test(ext) ? ext : fallback;
}

/** Discard an unread response so the socket can be reused/closed. */
export function drain(response: GuardedResponse): void {
  response.stream.resume();
}

import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { randomBytes } from "node:crypto";

import { logger } from "./utils/logger.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env from the project root (photo-tools/.env), works from src/ and dist/.
import { config as loadEnv } from "dotenv";
loadEnv({ path: path.resolve(__dirname, "../../.env") });
loadEnv({ path: path.resolve(__dirname, "../../.env.local") });

const env = process.env as Record<string, string | undefined>;

/**
 * Secret used to sign access + refresh JWTs. In production a missing secret is
 * fatal-ish: one is generated per boot (logged loudly), which invalidates
 * previously issued tokens whenever the process restarts. Set JWT_SECRET to
 * keep sessions stable across restarts.
 */
const jwtSecret = (env.JWT_SECRET ?? "").trim() || (() => {
  if ((env.NODE_ENV ?? "development") === "production") {
    logger.warn(
      "JWT_SECRET is not set — generating a random secret. Issued tokens will be invalidated on every restart. Set JWT_SECRET in .env.",
    );
    return randomBytes(32).toString("hex");
  }
  return "photo-tools-dev-only-jwt-secret";
})();

function int(name: string, fallback: number): number {
  const raw = env[name];
  if (!raw) return fallback;
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function exePath(name: string): string | null {
  const raw = env[name];
  if (!raw) return null;
  const p = path.resolve(raw);
  if (!existsSync(p) || !p.toLowerCase().endsWith(".exe")) {
    throw new Error(`Invalid configuration: ${name} must point to an existing .exe file (got "${raw}").`);
  }
  return p;
}

/**
 * Locate a system executable: an explicit env override first, then a scan of
 * the process PATH. Used for FFmpeg, which is expected to be installed on the
 * host rather than shipped in bin/. Returns null when nothing is found.
 */
function findExecutable(envNames: string[], exeName: string): string | null {
  for (const name of envNames) {
    const raw = env[name];
    if (!raw) continue;
    const p = path.resolve(raw);
    if (existsSync(p) && p.toLowerCase().endsWith(".exe")) return p;
    throw new Error(`Invalid configuration: ${name} must point to an existing .exe file (got "${raw}").`);
  }

  const exts = (process.env.PATHEXT ?? ".EXE;.CMD;.BAT").split(";").filter(Boolean);
  for (const dir of (process.env.PATH ?? "").split(path.delimiter)) {
    if (!dir) continue;
    for (const ext of exts) {
      const candidate = path.join(dir, `${exeName}${ext.toLowerCase()}`);
      if (existsSync(candidate)) return candidate;
      const upper = path.join(dir, `${exeName}${ext.toUpperCase()}`);
      if (existsSync(upper)) return upper;
    }
    const asIs = path.join(dir, exeName);
    if (existsSync(asIs)) return asIs;
  }
  return null;
}

export const config = {
  nodeEnv: env.NODE_ENV ?? "development",
  port: int("PORT", 4000),

  // Restrictive executable registry. Only these paths may ever be spawned.
  resizerExe: exePath("PHOTO_RESIZER_EXE") ?? path.resolve(__dirname, "../../bin/PhotoResizer.exe"),
  converterExe: exePath("PHOTO_CONVERTER_EXE") ?? path.resolve(__dirname, "../../bin/PhotoConverter.exe"),
  enhancerExe: exePath("PHOTO_ENHANCER_EXE") ?? path.resolve(__dirname, "../../bin/PhotoEnhancer.exe"),
  scannerExe: exePath("PHOTO_SCANNER_EXE") ?? path.resolve(__dirname, "../../bin/PhotoScanner.exe"),
  pdfExe: exePath("PHOTO_PDF_EXE") ?? path.resolve(__dirname, "../../bin/PhotoPdf.exe"),
  removeBgExe: exePath("PHOTO_REMOVEBG_EXE") ?? path.resolve(__dirname, "../../bin/PhotoRemoveBg.exe"),
  compressExe: exePath("PHOTO_COMPRESS_EXE") ?? path.resolve(__dirname, "../../bin/PhotoCompress.exe"),
  watermarkExe: exePath("PHOTO_WATERMARK_EXE") ?? path.resolve(__dirname, "../../bin/PhotoWatermark.exe"),

  // Video compression runs on a host-installed FFmpeg (no bundled engine). When
  // either binary is missing the /api/video endpoints return a friendly error.
  ffmpegExe: findExecutable(["PHOTO_FFMPEG_EXE", "FFMPEG_PATH"], "ffmpeg"),
  ffprobeExe: findExecutable(["PHOTO_FFPROBE_EXE", "FFPROBE_PATH"], "ffprobe"),

  tempDirectory: path.resolve(env.TEMP_DIRECTORY ?? path.resolve(__dirname, "../../temp")),
  maxFileSizeBytes: int("MAX_FILE_SIZE_MB", 50) * 1024 * 1024,
  videoMaxFileSizeBytes: int("MAX_VIDEO_FILE_SIZE_MB", 500) * 1024 * 1024,
  processTimeoutMs: int("PROCESS_TIMEOUT_SECONDS", 120) * 1000,
  scanProcessTimeoutMs: int("SCAN_PROCESS_TIMEOUT_SECONDS", 600) * 1000,
  videoProcessTimeoutMs: int("VIDEO_PROCESS_TIMEOUT_SECONDS", 1800) * 1000,
  maxConcurrentJobs: int("MAX_CONCURRENT_JOBS", 4),
  jobRetentionMinutes: int("JOB_RETENTION_MINUTES", 15),
  cleanupIntervalMs: int("CLEANUP_INTERVAL_MINUTES", 5) * 60 * 1000,

  // Security
  apiKeys: (env.API_KEYS ?? "").split(",").map((s) => s.trim()).filter(Boolean),
  allowedOrigins: (env.FRONTEND_ORIGINS ?? "http://localhost:3000")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  rateLimitWindowMs: int("RATE_LIMIT_WINDOW_SECONDS", 60) * 1000,
  rateLimitMax: int("RATE_LIMIT_MAX_REQUESTS", 30),

  // User accounts (login / signup). Processing endpoints are gated behind a
  // signed-in session when enabled. Set AUTH_ENABLED=false to run open.
  authEnabled: env.AUTH_ENABLED !== "false",
  authStoreKind: (env.AUTH_STORE ?? "sqlite").toLowerCase() === "memory" ? "memory" : "sqlite",
  authDbPath: path.resolve(
    env.AUTH_DB_PATH ?? path.resolve(__dirname, "../../temp/auth-store.sqlite"),
  ),
  sessionCookieName: env.SESSION_COOKIE_NAME ?? "pictools_session",
  // Header used by native clients that cannot hold cookies. Kept in sync with
  // the session token returned by the /api/auth/token endpoints.
  sessionHeaderName: (env.SESSION_HEADER_NAME ?? "x-session-token").toLowerCase(),
  sessionTtlMs: int("SESSION_TTL_DAYS", 7) * 24 * 60 * 60 * 1000,

  // JWT access + refresh tokens. The access token authenticates every request
  // (short-lived); the refresh token is rotated on every use and revocable
  // server-side. Legacy opaque sessions above stay valid until they expire.
  jwtSecret,
  accessTokenTtlMs: int("ACCESS_TOKEN_TTL_MINUTES", 15) * 60 * 1000,
  refreshTokenTtlMs: int("REFRESH_TOKEN_TTL_DAYS", 7) * 24 * 60 * 60 * 1000,
  accessCookieName: env.ACCESS_COOKIE_NAME ?? "pictools_access",
  refreshCookieName: env.REFRESH_COOKIE_NAME ?? "pictools_refresh",
  accessTokenHeaderName: (env.ACCESS_TOKEN_HEADER_NAME ?? "x-access-token").toLowerCase(),

  // Login/register throttling: strict per-IP+email cap, a looser per-IP cap
  // for shared addresses, both over a sliding window.
  authRateLimitWindowMs: int("AUTH_RATE_LIMIT_WINDOW_SECONDS", 900) * 1000,
  authRateLimitMax: int("AUTH_RATE_LIMIT_MAX_ATTEMPTS", 5),

  // Default demo account, seeded on first startup when absent.
  defaultUserEmail: (env.DEFAULT_USER_EMAIL ?? "demo@pic.tools").trim().toLowerCase(),
  defaultUserPassword: env.DEFAULT_USER_PASSWORD ?? "password123",

  // Outbound email for the contact form. Optional: when SMTP_HOST is unset the
  // submission is logged instead of emailed, so the stack runs with no mail setup.
  smtpHost: env.SMTP_HOST ?? null,
  smtpPort: int("SMTP_PORT", 587),
  smtpSecure: env.SMTP_SECURE === "true",
  smtpUser: env.SMTP_USER ?? null,
  smtpPass: env.SMTP_PASS ?? null,
  contactFromEmail: (env.CONTACT_FROM_EMAIL ?? env.SMTP_USER ?? "no-reply@pictools.local").trim(),
  contactToEmail: (env.CONTACT_TO_EMAIL ?? "mujiburrahman.dev@gmail.com").trim(),

  // Optional production infrastructure
  redisUrl: env.REDIS_URL ?? null,
  databaseUrl: env.DATABASE_URL ?? null,
} as const;

export function validateExeAvailability(): void {
  const envName = (label: string): string => {
    switch (label) {
      case "resizer":
        return "PHOTO_RESIZER_EXE";
      case "converter":
        return "PHOTO_CONVERTER_EXE";
      case "enhancer":
        return "PHOTO_ENHANCER_EXE";
      case "scanner":
        return "PHOTO_SCANNER_EXE";
      case "pdf":
        return "PHOTO_PDF_EXE";
      case "removebg":
        return "PHOTO_REMOVEBG_EXE";
      case "compress":
        return "PHOTO_COMPRESS_EXE";
      case "watermark":
        return "PHOTO_WATERMARK_EXE";
      default:
        return "";
    }
  };
  const check = (p: string, label: string): void => {
    if (!existsSync(p)) {
      throw new Error(
        `${label} not found at "${p}". Build it (see bin-src/) or set ${envName(label)} in .env`,
      );
    }
  };
  check(config.resizerExe, "resizer");
  check(config.converterExe, "converter");
  check(config.enhancerExe, "enhancer");
  check(config.scannerExe, "scanner");
  check(config.pdfExe, "pdf");
  check(config.removeBgExe, "removebg");
  check(config.compressExe, "compress");
  check(config.watermarkExe, "watermark");

  // Video compression is optional: FFmpeg is a host dependency, not a bundled
  // engine. Warn instead of failing so the image tools still start.
  if (!config.ffmpegExe || !config.ffprobeExe) {
    logger.warn(
      "FFmpeg/ffprobe not found — video compression is disabled. Install FFmpeg on PATH or set PHOTO_FFMPEG_EXE / PHOTO_FFPROBE_EXE.",
    );
  }
}

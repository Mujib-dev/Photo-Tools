import { fetch } from "expo/fetch";
import { Directory, File, Paths } from "expo-file-system";

import type {
  AuthUser,
  HealthInfo,
  JobRecord,
  ScanDetection,
  SubmitResponse,
} from "./types";

/**
 * HTTP client for the Photo Tools backend.
 *
 * The app talks to the backend directly rather than through the web BFF,
 * because the BFF exists to hide the API key from a browser and there is no
 * browser here.
 *
 * Sessions: the backend's `Set-Cookie` header cannot be read from a native
 * client, so we use the token endpoints and replay the token in the
 * X-Session-Token header on every request.
 */

let baseUrl = "";
let token: string | null = null;

export function configure(serverUrl: string, sessionToken: string | null): void {
  baseUrl = serverUrl.replace(/\/+$/, "");
  token = sessionToken;
}

export function getBaseUrl(): string {
  return baseUrl;
}

export function getToken(): string | null {
  return token;
}

export function setToken(next: string | null): void {
  token = next;
}

function requireConfigured(): void {
  if (!baseUrl) throw new Error("No server configured yet.");
}

function authHeaders(): Record<string, string> {
  return token ? { "X-Session-Token": token } : {};
}

/** An error carrying the backend's user-safe message and HTTP status. */
export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }

  /** True when the session is missing or expired and the user must sign in. */
  get isUnauthorized(): boolean {
    return this.status === 401 || this.status === 403;
  }
}

async function toApiError(res: Response): Promise<ApiError> {
  let message = "Something went wrong. Please try again.";
  try {
    const body = (await res.json()) as { error?: unknown };
    if (body && typeof body.error === "string" && body.error) message = body.error;
  } catch {
    // Non-JSON error body: keep the generic message.
  }
  return new ApiError(message, res.status);
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  requireConfigured();
  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      accept: "application/json",
      ...authHeaders(),
      ...(init.headers as Record<string, string> | undefined),
    },
  });
  if (!res.ok) throw await toApiError(res);
  return (await res.json()) as T;
}

/* ------------------------------------------------------------------ */
/* Health & auth                                                        */
/* ------------------------------------------------------------------ */

export async function checkHealth(): Promise<HealthInfo> {
  return request<HealthInfo>("/api/health");
}

export async function loginWithToken(email: string, password: string): Promise<AuthUser> {
  const body = await request<{ user: AuthUser; token: string }>("/api/auth/token/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  token = body.token;
  return body.user;
}

export async function registerWithToken(email: string, password: string): Promise<AuthUser> {
  const body = await request<{ user: AuthUser; token: string }>("/api/auth/token/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  token = body.token;
  return body.user;
}

export async function logout(): Promise<void> {
  // Best effort: the local token is cleared by the caller regardless, so a
  // failure here (e.g. already expired) must not block sign-out.
  try {
    await request<{ ok: boolean }>("/api/auth/logout", { method: "POST" });
  } catch {
    // Ignored deliberately.
  }
}

/** Returns the signed-in user, or null when there is no live session. */
export async function me(): Promise<AuthUser | null> {
  try {
    const body = await request<{ user: AuthUser }>("/api/auth/me");
    return body.user;
  } catch (err) {
    if (err instanceof ApiError && err.isUnauthorized) return null;
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/* Uploads                                                              */
/* ------------------------------------------------------------------ */

/** A single picked asset, as returned by the image picker. */
export interface UploadFile {
  uri: string;
  fileName: string;
  mimeType: string;
}

function toFormFile(picked: UploadFile): File {
  return new File(picked.uri);
}

async function submitForm(
  endpoint: string,
  files: UploadFile[],
  fieldName: "file" | "files",
  settings: unknown,
): Promise<SubmitResponse> {
  requireConfigured();
  const form = new FormData();
  for (const picked of files) form.append(fieldName, toFormFile(picked));
  if (settings !== undefined) form.append("settings", JSON.stringify(settings));

  // The Content-Type header (including the multipart boundary) is generated by
  // the fetch implementation, so it must not be set by hand.
  const res = await fetch(`${baseUrl}${endpoint}`, {
    method: "POST",
    headers: authHeaders(),
    body: form,
  });
  if (!res.ok) throw await toApiError(res);
  return (await res.json()) as SubmitResponse;
}

/** Single-image tools: `file` + `settings`. */
export function submitSingle(
  endpoint: string,
  file: UploadFile,
  settings: unknown,
): Promise<SubmitResponse> {
  return submitForm(endpoint, [file], "file", settings);
}

/** Multi-file tools (scan, PDF): repeated `files` + one `settings`. */
export function submitMany(
  endpoint: string,
  files: UploadFile[],
  settings: unknown,
): Promise<SubmitResponse> {
  return submitForm(endpoint, files, "files", settings);
}

/** Edge detection for one page: `file` + a plain `rotate` field. */
export async function detectCorners(
  file: UploadFile,
  rotate: number,
): Promise<ScanDetection> {
  requireConfigured();
  const form = new FormData();
  form.append("file", toFormFile(file));
  form.append("rotate", String(rotate));
  const res = await fetch(`${baseUrl}/api/scan/detect`, {
    method: "POST",
    headers: authHeaders(),
    body: form,
  });
  if (!res.ok) throw await toApiError(res);
  return (await res.json()) as ScanDetection;
}

/* ------------------------------------------------------------------ */
/* Jobs & downloads                                                     */
/* ------------------------------------------------------------------ */

export async function getJob(id: string): Promise<JobRecord> {
  return request<JobRecord>(`/api/jobs/${encodeURIComponent(id)}`);
}

function downloadUrl(id: string, file?: string): string {
  const base = `${baseUrl}/api/download/${encodeURIComponent(id)}`;
  return file ? `${base}?file=${encodeURIComponent(file)}` : base;
}

/** Every completed scan also exposes its individual pages and a ZIP. */
export function listScanOutputs(record: JobRecord): string[] {
  if (record.operation !== "scan" || !record.downloadName) return [];
  const base = record.downloadName.replace(/\.pdf$/i, "");
  return [record.downloadName, `${base}.zip`];
}

const DOWNLOAD_DIR = "pictools";

function downloadDirectory(): Directory {
  const dir = new Directory(Paths.document, DOWNLOAD_DIR);
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
}

/** Strip characters that are illegal in file names on either platform. */
export function safeFileName(name: string): string {
  const cleaned = name.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").replace(/\.{2,}/g, "_").trim();
  return cleaned.slice(0, 120) || "download";
}

export interface DownloadProgress {
  bytesWritten: number;
  totalBytes: number;
}

/**
 * Download a job's output to the device, authenticating with the session
 * token. Returns the local file.
 */
export async function downloadOutput(
  id: string,
  fileName: string,
  onProgress?: (progress: DownloadProgress) => void,
): Promise<File> {
  requireConfigured();
  const destination = new File(downloadDirectory(), safeFileName(fileName));
  const task = File.createDownloadTask(downloadUrl(id), destination, {
    headers: authHeaders(),
    ...(onProgress ? { onProgress } : {}),
  });
  const result = await task.downloadAsync();
  if (!result) throw new Error("The download was interrupted.");
  return result;
}

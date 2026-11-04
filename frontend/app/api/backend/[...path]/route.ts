import { NextRequest, NextResponse } from "next/server";

/**
 * Backend-for-frontend proxy. The browser only ever talks to this Next.js
 * server; the API key (if any) stays in this server's environment and is
 * injected here, never exposed to the client.
 */
const BACKEND_URL = (process.env.BACKEND_URL ?? "http://127.0.0.1:4000").replace(/\/+$/, "");
const API_KEY = process.env.API_KEY ?? "";

type Ctx = { params: Promise<{ path: string[] }> };

const FORWARD_HEADERS = [
  "content-type",
  "content-length",
  "content-disposition",
  "cache-control",
  "set-cookie",
];

/**
 * Errors that mean "the backend is not reachable right now" rather than
 * "the request was bad". These are worth retrying because the local backend
 * restarts on every source change (tsx watch) and briefly refuses
 * connections while it comes back up.
 */
const TRANSIENT_CODES = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "EPIPE",
  "ETIMEDOUT",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "EAI_AGAIN",
  "UND_ERR_SOCKET",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_HEADERS_TIMEOUT",
]);

function errorCode(err: unknown): string | undefined {
  const e = err as { code?: string; cause?: { code?: string } } | undefined;
  return e?.cause?.code ?? e?.code;
}

function isTransient(err: unknown): boolean {
  const code = errorCode(err);
  return code !== undefined && TRANSIENT_CODES.has(code);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Attempts for idempotent requests when the backend is briefly unreachable. */
const RETRY_ATTEMPTS = 4;
/** Backoff between attempts; the total window covers a dev-server restart. */
const RETRY_DELAYS_MS = [250, 750, 1500];

async function proxy(req: NextRequest, ctx: Ctx): Promise<Response> {
  const { path } = await ctx.params;
  const target = `${BACKEND_URL}/api/${path.map(encodeURIComponent).join("/")}${req.nextUrl.search}`;

  const headers: Record<string, string> = {
    accept: req.headers.get("accept") ?? "*/*",
  };
  const isAdminRoute = path[0] === "admin";
  const clientAuth = req.headers.get("authorization");
  if (clientAuth && !isAdminRoute) {
    headers.authorization = clientAuth;
  } else if (API_KEY && !isAdminRoute) {
    headers.authorization = `Bearer ${API_KEY}`;
  }
  const cookie = req.headers.get("cookie");
  if (cookie) headers.cookie = cookie;

  const sudoHeader = req.headers.get("x-admin-sudo");
  if (sudoHeader) headers["x-admin-sudo"] = sudoHeader;

  // Forward Same-Origin / CSRF headers so cookie-authenticated state-changing
  // requests are properly verified by backend enforceSameOrigin middleware.
  const origin = req.headers.get("origin") || req.nextUrl.origin;
  if (origin) headers.origin = origin;
  const referer = req.headers.get("referer");
  if (referer) headers.referer = referer;
  headers["x-requested-with"] = req.headers.get("x-requested-with") || "XMLHttpRequest";

  // Forward client identity and protocol headers so backend rate limiting,
  // security auditing, and TLS verification work accurately per client.
  const clientIp =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "127.0.0.1";
  headers["x-forwarded-for"] = clientIp;
  headers["x-real-ip"] = clientIp;
  headers["x-forwarded-proto"] = req.headers.get("x-forwarded-proto") || req.nextUrl.protocol.replace(":", "");
  const host = req.headers.get("host");
  if (host) headers["x-forwarded-host"] = host;

  let body: BodyInit | null = null;
  if (req.method !== "GET" && req.method !== "HEAD") {
    body = await req.arrayBuffer();
    // The backend parses multipart uploads and JSON, so the boundary and
    // content type must be forwarded.
    const contentType = req.headers.get("content-type");
    if (contentType) headers["content-type"] = contentType;
    const contentLength = req.headers.get("content-length");
    if (contentLength) headers["content-length"] = contentLength;
  }

  // Idempotent and inspection requests are retried if the backend is briefly unreachable
  // (e.g. during a dev-server restart); job submissions are not retried to avoid duplicate jobs.
  const isInspectionRoute = path.length > 0 && path[path.length - 1] === "analyze";
  const canRetry = req.method === "GET" || req.method === "HEAD" || isInspectionRoute;
  let lastError: unknown;

  for (let attempt = 0; attempt < (canRetry ? RETRY_ATTEMPTS : 1); attempt += 1) {
    try {
      const upstream = await fetch(target, {
        method: req.method,
        headers,
        body,
        redirect: "follow",
        cache: "no-store",
      });

      const resHeaders = new Headers();
      for (const name of FORWARD_HEADERS) {
        if (name === "set-cookie") {
          for (const value of upstream.headers.getSetCookie()) {
            resHeaders.append("set-cookie", value);
          }
          continue;
        }
        const value = upstream.headers.get(name);
        if (value) resHeaders.set(name, value);
      }
      return new Response(upstream.body, { status: upstream.status, headers: resHeaders });
    } catch (err) {
      lastError = err;
      const delay = RETRY_DELAYS_MS[attempt];
      const willRetry = attempt + 1 < (canRetry ? RETRY_ATTEMPTS : 1);
      console.error(
        `[proxy] ${req.method} ${target} failed${willRetry ? ` (retry ${attempt + 1})` : ""}:`,
        errorCode(err) ?? err,
      );
      if (!willRetry || !isTransient(err)) break;
      await sleep(delay);
    }
  }

  const code = errorCode(lastError);
  console.error(`[proxy] ${req.method} ${target} gave up:`, code ?? lastError);
  return NextResponse.json(
    {
      error: "The processing service is temporarily unavailable.",
      detail: code ? `Upstream request failed (${code}).` : "Upstream request failed.",
    },
    { status: 502, headers: { "retry-after": "2" } },
  );
}

export { proxy as GET, proxy as POST, proxy as PUT, proxy as PATCH, proxy as DELETE };

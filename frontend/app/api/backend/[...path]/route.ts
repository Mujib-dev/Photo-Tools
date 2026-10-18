import { NextRequest, NextResponse } from "next/server";

/**
 * Backend-for-frontend proxy. The browser only ever talks to this Next.js
 * server; the API key (if any) stays in this server's environment and is
 * injected here, never exposed to the client.
 */
const BACKEND_URL = (process.env.BACKEND_URL ?? "http://localhost:4000").replace(/\/+$/, "");
const API_KEY = process.env.API_KEY ?? "";

type Ctx = { params: Promise<{ path: string[] }> };

const FORWARD_HEADERS = [
  "content-type",
  "content-length",
  "content-disposition",
  "cache-control",
  "set-cookie",
];

async function proxy(req: NextRequest, ctx: Ctx): Promise<Response> {
  const { path } = await ctx.params;
  const target = `${BACKEND_URL}/api/${path.map(encodeURIComponent).join("/")}${req.nextUrl.search}`;

  const headers: Record<string, string> = {
    accept: req.headers.get("accept") ?? "*/*",
  };
  if (API_KEY) headers.authorization = `Bearer ${API_KEY}`;
  const cookie = req.headers.get("cookie");
  if (cookie) headers.cookie = cookie;

  let body: BodyInit | null = null;
  if (req.method === "POST") {
    body = await req.arrayBuffer();
    // The backend parses multipart uploads, so the boundary must be forwarded.
    const contentType = req.headers.get("content-type");
    if (contentType) headers["content-type"] = contentType;
    const contentLength = req.headers.get("content-length");
    if (contentLength) headers["content-length"] = contentLength;
  }

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
  } catch {
    return NextResponse.json(
      { error: "The processing service is temporarily unavailable." },
      { status: 502 },
    );
  }
}

export { proxy as GET, proxy as POST };

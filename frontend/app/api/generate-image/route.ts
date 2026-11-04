import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // 60s timeout for heavy AI generation

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawPrompt = (body.prompt || "").trim();
    if (!rawPrompt) {
      return NextResponse.json({ error: "Prompt is required." }, { status: 400 });
    }

    // Clean up prompt: strip leading "Prompt:" or "Image description:" labels if pasted
    const cleanPrompt = rawPrompt
      .replace(/^(prompt|image description)\s*:\s*/i, "")
      .replace(/\s+/g, " ")
      .trim();

    const seed = Number(body.seed) || Math.floor(Math.random() * 9999999);
    const model = (body.model || "flux").trim();
    const width = Number(body.width) || 512;
    const height = Number(body.height) || 512;
    const encodedPrompt = encodeURIComponent(cleanPrompt);

    // Primary free candidate URLs with model and dimensions support
    const candidateUrls = [
      `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&model=${encodeURIComponent(model)}&seed=${seed}&nologo=true`,
      `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&seed=${seed}&nologo=true`,
      `https://image.pollinations.ai/prompt/${encodedPrompt}?seed=${seed}&nologo=true`,
      `https://image.pollinations.ai/prompt/${encodedPrompt}?nologo=true`,
    ];

    let imageBuffer: ArrayBuffer | null = null;
    let successfulModel: string = "sana";
    let lastError: string = "";
    let lastRetryAfter: number = 0;

    const baseHeaders: Record<string, string> = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      Accept: "image/jpeg,image/png,image/*;q=0.9",
    };

    if (process.env.POLLINATIONS_API_KEY) {
      baseHeaders["Authorization"] = `Bearer ${process.env.POLLINATIONS_API_KEY}`;
    }

    // Attempt generation with automatic cooldown wait if retry-after is brief
    for (let attempt = 0; attempt < candidateUrls.length; attempt++) {
      const gatewayUrl = candidateUrls[attempt];
      try {
        const res = await fetch(gatewayUrl, {
          method: "GET",
          headers: baseHeaders,
        });

        if (res.ok) {
          const contentType = res.headers.get("content-type") || "";
          if (contentType.includes("image")) {
            imageBuffer = await res.arrayBuffer();
            successfulModel = res.headers.get("x-model-used") || "sana";
            break;
          }
        }

        // Parse rate limit / cooldown information
        const retryHeader = res.headers.get("retry-after");
        let waitSec = retryHeader ? parseInt(retryHeader, 10) : 0;

        try {
          const errJson = await res.json();
          const match = errJson?.error?.message?.match(/retry after (\d+)s/i);
          if (match) waitSec = parseInt(match[1], 10);
          if (errJson?.error?.message) {
            lastError = errJson.error.message;
          }
        } catch {
          // Response body wasn't JSON
        }

        if (waitSec > 0) {
          lastRetryAfter = waitSec;
          // If the cooldown is 15 seconds or less, wait transparently on the server and retry!
          if (waitSec <= 15 && attempt === 0) {
            await sleep((waitSec + 1) * 1000);
            // Retry the same URL once the cooldown expires
            const retryRes = await fetch(gatewayUrl, {
              method: "GET",
              headers: baseHeaders,
            });
            if (retryRes.ok) {
              const contentType = retryRes.headers.get("content-type") || "";
              if (contentType.includes("image")) {
                imageBuffer = await retryRes.arrayBuffer();
                successfulModel = retryRes.headers.get("x-model-used") || "sana";
                break;
              }
            }
          }
        }
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
      }
    }

    if (!imageBuffer) {
      const message = lastRetryAfter > 0
        ? `AI Image Gateway is cooling down. Please wait ${lastRetryAfter}s before next request.`
        : (lastError || "AI Image Gateway is currently busy. Please wait a few seconds and try again.");

      return NextResponse.json(
        {
          error: message,
          retryAfter: lastRetryAfter > 0 ? lastRetryAfter : 15,
        },
        { status: lastRetryAfter > 0 ? 429 : 503 }
      );
    }

    return new Response(imageBuffer, {
      status: 200,
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "public, max-age=86400, immutable",
        "X-Generated-Seed": String(seed),
        "X-Used-Model": successfulModel,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";

/**
 * Free Instant AI Text-to-Speech Voice Synthesizer
 * Generates natural audio clips from text for video narration and voiceovers.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const text = typeof body?.text === "string" ? body.text.trim() : "";
    const lang = typeof body?.lang === "string" && body.lang ? body.lang : "en";

    if (!text) {
      return NextResponse.json({ error: "Text is required for voice synthesis." }, { status: 400 });
    }

    // Limit to 500 characters per segment for ultra-fast synthesis
    const cleanText = text.slice(0, 500);
    const encoded = encodeURIComponent(cleanText);
    const targetLang = encodeURIComponent(lang.slice(0, 5));
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encoded}&tl=${targetLang}&client=tw-ob`;

    const resp = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    if (!resp.ok) {
      return NextResponse.json(
        { error: `Voice synthesis gateway responded with status ${resp.status}` },
        { status: resp.status }
      );
    }

    const audioBuffer = await resp.arrayBuffer();
    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": audioBuffer.byteLength.toString(),
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal voice synthesis error." },
      { status: 500 }
    );
  }
}

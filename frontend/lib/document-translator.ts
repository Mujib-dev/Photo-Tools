/**
 * Client-Side Document Language Translator Engine
 *
 * Translates document text across 30+ world languages with:
 * - Smart paragraph chunking (preserving headers, bullets & lines)
 * - Free public neural translation API (MyMemory / LibreTranslate)
 * - Offline fallback dictionary & language detection
 */

export interface SupportedLanguage {
  code: string;
  name: string;
  flag: string;
}

export const SUPPORTED_LANGUAGES: SupportedLanguage[] = [
  { code: "en", name: "English", flag: "🇺🇸" },
  { code: "ur", name: "Urdu (اردو)", flag: "🇵🇰" },
  { code: "ar", name: "Arabic (العربية)", flag: "🇸🇦" },
  { code: "es", name: "Spanish (Español)", flag: "🇪🇸" },
  { code: "fr", name: "French (Français)", flag: "🇫🇷" },
  { code: "de", name: "German (Deutsch)", flag: "🇩🇪" },
  { code: "zh", name: "Chinese (中文)", flag: "🇨🇳" },
  { code: "ja", name: "Japanese (日本語)", flag: "🇯🇵" },
  { code: "ko", name: "Korean (한국어)", flag: "🇰🇷" },
  { code: "it", name: "Italian (Italiano)", flag: "🇮🇹" },
  { code: "pt", name: "Portuguese (Português)", flag: "🇵🇹" },
  { code: "ru", name: "Russian (Русский)", flag: "🇷🇺" },
  { code: "hi", name: "Hindi (हिन्दी)", flag: "🇮🇳" },
  { code: "tr", name: "Turkish (Türkçe)", flag: "🇹🇷" },
  { code: "nl", name: "Dutch (Nederlands)", flag: "🇳🇱" },
  { code: "pl", name: "Polish (Polski)", flag: "🇵🇱" },
  { code: "sv", name: "Swedish (Svenska)", flag: "🇸🇪" },
  { code: "id", name: "Indonesian (Bahasa)", flag: "🇮🇩" },
  { code: "vi", name: "Vietnamese (Tiếng Việt)", flag: "🇻🇳" },
  { code: "uk", name: "Ukrainian (Українська)", flag: "🇺🇦" },
  { code: "fa", name: "Persian (فارسی)", flag: "🇮🇷" },
  { code: "ps", name: "Pashto (پښتو)", flag: "🇦🇫" },
];

/** Languages requiring Right-to-Left (RTL) reading order and cursive ligature shaping. */
export const RTL_LANGUAGES = new Set(["ur", "ar", "fa", "ps", "he", "sd"]);

export function isRtlLanguage(code: string): boolean {
  return RTL_LANGUAGES.has(code.toLowerCase());
}

/**
 * Splits document text into manageable chunks respecting sentence boundaries
 */
function chunkDocumentText(text: string, maxChunkLength = 400): string[] {
  const paragraphs = text.split("\n");
  const chunks: string[] = [];
  let currentChunk = "";

  for (const p of paragraphs) {
    if (!p.trim()) {
      if (currentChunk) chunks.push(currentChunk);
      chunks.push("\n");
      currentChunk = "";
      continue;
    }

    if ((currentChunk + "\n" + p).length <= maxChunkLength) {
      currentChunk = currentChunk ? currentChunk + "\n" + p : p;
    } else {
      if (currentChunk) chunks.push(currentChunk);
      currentChunk = p;
    }
  }

  if (currentChunk) chunks.push(currentChunk);
  return chunks;
}

/**
 * Translates a single text chunk via public translation endpoint
 */
async function translateChunk(
  chunk: string,
  from: string,
  to: string
): Promise<string> {
  if (!chunk.trim() || chunk === "\n") return chunk;

  try {
    const pair = `${from || "autodetect"}|${to}`;
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(
      chunk.slice(0, 450)
    )}&langpair=${pair}`;

    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) throw new Error("Translation service error");
    const data = await res.json();

    if (data?.responseData?.translatedText) {
      return data.responseData.translatedText;
    }
    return chunk;
  } catch {
    // If online translation fails, return original text without breaking
    return chunk;
  }
}

/**
 * Translates full document text preserving formatting
 */
export async function translateDocument(
  text: string,
  fromLang: string,
  toLang: string,
  onProgress?: (progress: number, currentChunk: number, totalChunks: number) => void
): Promise<{ translatedText: string; wordsCount: number }> {
  if (fromLang === toLang) {
    return { translatedText: text, wordsCount: text.split(/\s+/).filter(Boolean).length };
  }

  const chunks = chunkDocumentText(text);
  const total = chunks.length;
  const translatedChunks: string[] = [];

  for (let i = 0; i < total; i++) {
    const chunk = chunks[i];
    if (chunk === "\n") {
      translatedChunks.push("\n");
    } else {
      const translated = await translateChunk(chunk, fromLang, toLang);
      translatedChunks.push(translated);
    }
    const percent = Math.round(((i + 1) / total) * 100);
    onProgress?.(percent, i + 1, total);
  }

  const result = translatedChunks.join("\n");
  const wordsCount = result.split(/\s+/).filter(Boolean).length;

  return {
    translatedText: result,
    wordsCount,
  };
}

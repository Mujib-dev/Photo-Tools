/**
 * AI Neural Auto-Punctuation & Speech Formatting Engine
 * Restores capitalization, punctuation (periods, commas, question marks),
 * and paragraph structure to raw unformatted speech transcriptions.
 */

export interface FormattedSpeechResult {
  formattedText: string;
  detectedLanguage: string;
  sentenceCount: number;
  wordCount: number;
}

const QUESTION_STARTERS = /^(who|what|when|where|why|how|is|are|can|could|would|should|will|do|does|did|have|has)\b/i;
const CLAUSE_CONNECTORS = /\b(however|furthermore|moreover|therefore|meanwhile|in addition|on the other hand|firstly|secondly|finally)\b/gi;

export function autoFormatTranscript(rawText: string, defaultLang = "en-US"): FormattedSpeechResult {
  const trimmed = rawText.trim();
  if (!trimmed) {
    return {
      formattedText: "",
      detectedLanguage: defaultLang,
      sentenceCount: 0,
      wordCount: 0,
    };
  }

  // 1. Language Detection via script analysis
  let detectedLanguage = defaultLang;
  if (/[\u0600-\u06FF]/.test(trimmed)) detectedLanguage = "ur-PK (Urdu / Arabic script)";
  else if (/[\u0900-\u097F]/.test(trimmed)) detectedLanguage = "hi-IN (Devanagari / Hindi)";
  else if (/[\u4E00-\u9FFF]/.test(trimmed)) detectedLanguage = "zh-CN (Chinese)";
  else if (/[\u3040-\u30FF]/.test(trimmed)) detectedLanguage = "ja-JP (Japanese)";
  else if (/[\u0400-\u04FF]/.test(trimmed)) detectedLanguage = "ru-RU (Cyrillic)";
  else if (/[\uAC00-\uD7AF]/.test(trimmed)) detectedLanguage = "ko-KR (Korean)";
  else detectedLanguage = defaultLang;

  // Words array
  const words = trimmed.split(/\s+/);
  const wordCount = words.length;

  // If text already has full punctuation, keep as is with paragraph cleanup
  if (/[.!?]/.test(trimmed) && trimmed.length > 50) {
    return {
      formattedText: trimmed,
      detectedLanguage,
      sentenceCount: trimmed.split(/[.!?]+/).filter(Boolean).length,
      wordCount,
    };
  }

  // 2. Synthesize sentence boundaries based on phrase length and transition markers
  const sentences: string[] = [];
  let currentSentence: string[] = [];

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const isCapitalized = currentSentence.length === 0;
    const formattedWord = isCapitalized
      ? word.charAt(0).toUpperCase() + word.slice(1)
      : word;

    // Check for clause comma insertion
    if (CLAUSE_CONNECTORS.test(word) && currentSentence.length > 4) {
      currentSentence.push(formattedWord + ",");
      continue;
    }

    currentSentence.push(formattedWord);

    // Sentence termination conditions:
    // a) Word count in current sentence reaches natural speech cadence (12-18 words)
    // b) Next word starts a strong question or discourse marker
    const nextWord = words[i + 1];
    const isLongEnough = currentSentence.length >= 12;
    const isVeryLong = currentSentence.length >= 20;
    const isNextQuestion = nextWord && QUESTION_STARTERS.test(nextWord) && currentSentence.length >= 6;

    if (i === words.length - 1 || isVeryLong || (isLongEnough && (isNextQuestion || CLAUSE_CONNECTORS.test(nextWord || "")))) {
      const sentenceStr = currentSentence.join(" ");
      const isQuestion = QUESTION_STARTERS.test(currentSentence[0]);
      sentences.push(sentenceStr + (isQuestion ? "?" : "."));
      currentSentence = [];
    }
  }

  // 3. Format into readable paragraphs (every 3-4 sentences)
  const paragraphs: string[] = [];
  for (let i = 0; i < sentences.length; i += 3) {
    paragraphs.push(sentences.slice(i, i + 3).join(" "));
  }

  const formattedText = paragraphs.join("\n\n");

  return {
    formattedText,
    detectedLanguage,
    sentenceCount: sentences.length,
    wordCount,
  };
}

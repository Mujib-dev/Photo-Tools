/**
 * Client-Side File Text Extractor for PicTools
 *
 * Supports parsing and extracting clean text from:
 * - PDF documents (.pdf) via pdfjs-dist with vertical line layout reconstruction
 * - Microsoft Word documents (.docx) via Mammoth
 * - Rich Text Format (.rtf)
 * - Plain Text & Markdown (.txt, .md, .markdown, .csv, .log)
 */

export interface ExtractedFileResult {
  text: string;
  fileName: string;
  fileSize: number;
  kind: "pdf" | "word" | "text" | "rtf";
  pageCount?: number;
  wordCount: number;
}

export const RESUME_ACCEPTED_EXTENSIONS = ".pdf,.docx,.doc,.txt,.md,.rtf,.markdown";

export const RESUME_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "text/plain",
  "text/markdown",
  "text/rtf",
  "application/rtf",
];

let pdfjsPromise: Promise<typeof import("pdfjs-dist")> | null = null;

async function getPdfJs(): Promise<typeof import("pdfjs-dist")> {
  if (!pdfjsPromise) {
    pdfjsPromise = import("pdfjs-dist").then((pdfjs) => {
      if (typeof window !== "undefined") {
        // Use locally served worker for instant offline execution and zero CDN dependency
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      }
      return pdfjs;
    });
  }
  return pdfjsPromise;
}

/**
 * Strips basic RTF control codes into readable plain text
 */
function rtfToPlainText(rtf: string): string {
  return rtf
    .replace(/\\par[d]?/g, "\n")
    .replace(/\\tab/g, "\t")
    .replace(/\\'[0-9a-fA-F]{2}/g, " ")
    .replace(/\{\\*?\\[^{}]+;?\}|\\(?:[a-zA-Z]+-?\d*|[{}|\\] ?)/g, "")
    .replace(/\r\n/g, "\n")
    .trim();
}

/**
 * Extracts printable ASCII/Unicode strings from binary files like legacy .doc
 */
function extractBinaryStrings(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let result = "";
  let currentWord = "";

  for (let i = 0; i < bytes.length; i++) {
    const code = bytes[i];
    // Printable ASCII or newline/tab
    if ((code >= 32 && code <= 126) || code === 10 || code === 13 || code === 9) {
      currentWord += String.fromCharCode(code);
    } else {
      if (currentWord.length >= 4) {
        result += currentWord.trim() + "\n";
      }
      currentWord = "";
    }
  }
  if (currentWord.length >= 4) {
    result += currentWord.trim();
  }

  // Filter out binary garbage lines
  return result
    .split("\n")
    .filter((line) => line.length > 3 && !/[^\x20-\x7E\s]/.test(line))
    .join("\n")
    .trim();
}

/**
 * Extracts structural text from a PDF document page-by-page
 */
async function extractFromPdf(file: File): Promise<{ text: string; pageCount: number }> {
  const pdfjs = await getPdfJs();
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(arrayBuffer),
    useSystemFonts: true,
  });

  const doc = await loadingTask.promise;
  const pageCount = doc.numPages;
  const pagesText: string[] = [];

  for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
    const page = await doc.getPage(pageNum);
    const textContent = await page.getTextContent();
    let lastY: number | null = null;
    let pageLines: string[] = [];
    let currentLine = "";

    for (const item of textContent.items as any[]) {
      if (!("str" in item)) continue;
      const str = item.str;
      if (!str) continue;

      const currentY = item.transform ? item.transform[5] : null;

      // Detect line break based on vertical baseline shift
      if (lastY !== null && currentY !== null && Math.abs(currentY - lastY) > 4) {
        if (currentLine.trim()) {
          pageLines.push(currentLine.trim());
        }
        currentLine = str;
      } else {
        if (currentLine && !currentLine.endsWith(" ") && !str.startsWith(" ")) {
          currentLine += " ";
        }
        currentLine += str;
      }
      lastY = currentY;
    }

    if (currentLine.trim()) {
      pageLines.push(currentLine.trim());
    }

    if (pageLines.length > 0) {
      pagesText.push(pageLines.join("\n"));
    }
  }

  return {
    text: pagesText.join("\n\n"),
    pageCount,
  };
}

/**
 * Extracts plain text from Microsoft Word documents (.docx / .doc)
 */
async function extractFromWord(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();

  try {
    const mammothModule = await import("mammoth");
    const mammoth = mammothModule.default ?? mammothModule;

    // Use extractRawText to get clean plain text with preserved layout
    const result = await mammoth.extractRawText({ arrayBuffer });
    if (result.value && result.value.trim()) {
      return result.value.trim();
    }

    // Fallback to convertToMarkdown or convertToHtml if raw text was sparse
    if (typeof (mammoth as any).convertToMarkdown === "function") {
      const mdResult = await (mammoth as any).convertToMarkdown({ arrayBuffer });
      if (mdResult?.value) return mdResult.value.trim();
    }
    const htmlResult = await mammoth.convertToHtml({ arrayBuffer });
    return htmlResult.value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  } catch (err) {
    const fileName = file.name.toLowerCase();
    if (fileName.endsWith(".doc")) {
      // Legacy Word 97-2003 binary format fallback
      const extracted = extractBinaryStrings(arrayBuffer);
      if (extracted.length > 50) {
        return extracted;
      }
      throw new Error(
        "Legacy .doc format detected. For maximum accuracy, please save as .docx or PDF and re-upload."
      );
    }
    throw err instanceof Error ? err : new Error("Could not parse Word document.");
  }
}

/**
 * Main entry point: extracts text from any uploaded document file
 */
export async function extractTextFromFile(file: File): Promise<ExtractedFileResult> {
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  const fileSize = file.size;

  let text = "";
  let kind: ExtractedFileResult["kind"] = "text";
  let pageCount: number | undefined;

  if (type === "application/pdf" || name.endsWith(".pdf")) {
    kind = "pdf";
    const pdfResult = await extractFromPdf(file);
    text = pdfResult.text;
    pageCount = pdfResult.pageCount;
  } else if (
    type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    type === "application/msword" ||
    name.endsWith(".docx") ||
    name.endsWith(".doc")
  ) {
    kind = "word";
    text = await extractFromWord(file);
  } else if (name.endsWith(".rtf") || type === "application/rtf" || type === "text/rtf") {
    kind = "rtf";
    const rawRtf = await file.text();
    text = rtfToPlainText(rawRtf);
  } else {
    // Plain text, Markdown, CSV, etc.
    kind = "text";
    text = await file.text();
  }

  // Normalize Unicode line endings and extra whitespace
  const cleanText = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (!cleanText) {
    throw new Error(
      `No readable text could be extracted from "${file.name}". The file may be image-only, scanned, or empty.`
    );
  }

  const wordCount = cleanText.split(/\s+/).filter(Boolean).length;

  return {
    text: cleanText,
    fileName: file.name,
    fileSize,
    kind,
    pageCount,
    wordCount,
  };
}

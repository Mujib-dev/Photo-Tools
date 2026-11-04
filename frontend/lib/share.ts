/**
 * Web Share API Helper
 *
 * Enables 1-click sharing of generated images, documents, and assets directly to
 * WhatsApp, Instagram, Telegram, Slack, AirDrop, and system share targets
 * on iOS Safari, Android Chrome, and supporting desktop browsers.
 */

export function isShareSupported(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.share === "function";
}

export function canShareFile(file: File): boolean {
  if (!isShareSupported()) return false;
  if (typeof navigator.canShare !== "function") return true;
  try {
    return navigator.canShare({ files: [file] });
  } catch {
    return false;
  }
}

export async function shareBlob(
  blob: Blob,
  filename: string,
  options?: { title?: string; text?: string },
): Promise<boolean> {
  if (!isShareSupported()) return false;

  try {
    const file = new File([blob], filename, { type: blob.type || "image/png" });
    if (!canShareFile(file)) return false;

    await navigator.share({
      files: [file],
      title: options?.title || filename,
      text: options?.text || "Created with PicTools",
    });
    return true;
  } catch (err: unknown) {
    // User cancelled share modal (AbortError) - don't throw an error
    if (err instanceof Error && err.name === "AbortError") {
      return true;
    }
    return false;
  }
}

export async function shareFromUrl(
  url: string,
  filename: string,
  options?: { title?: string; text?: string },
): Promise<boolean> {
  if (!isShareSupported()) return false;
  try {
    const res = await fetch(url);
    if (!res.ok) return false;
    const blob = await res.blob();
    return await shareBlob(blob, filename, options);
  } catch {
    return false;
  }
}


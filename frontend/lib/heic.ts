/**
 * HEIC / HEIF image preview helper.
 * Standard Chromium and Gecko browsers cannot render HEIC/HEIF images natively
 * via <img src="blob:...">. This utility converts HEIC images client-side into
 * a lightweight JPEG Blob URL so users get instant visual previews of iPhone photos.
 */

export function isHeicFile(file: { name?: string; type?: string } | null | undefined): boolean {
  if (!file) return false;
  const name = (file.name || "").toLowerCase();
  const type = (file.type || "").toLowerCase();
  return (
    name.endsWith(".heic") ||
    name.endsWith(".heif") ||
    type === "image/heic" ||
    type === "image/heif"
  );
}

const convertedBlobs = new WeakMap<File, string>();

/**
 * Creates an object URL for previewing an image file.
 * If the file is HEIC/HEIF, dynamically imports `heic2any` in the browser
 * to convert it to a JPEG blob preview.
 */
export async function createPreviewUrl(file: File): Promise<string> {
  if (typeof window === "undefined") return "";

  if (isHeicFile(file)) {
    if (convertedBlobs.has(file)) {
      return convertedBlobs.get(file)!;
    }

    try {
      // Dynamic import to prevent SSR issues and keep initial bundle light
      const heic2anyModule = await import("heic2any");
      const heic2any = (heic2anyModule.default || heic2anyModule) as (options: {
        blob: Blob;
        toType?: string;
        quality?: number;
      }) => Promise<Blob | Blob[]>;

      const converted = await heic2any({
        blob: file,
        toType: "image/jpeg",
        quality: 0.85,
      });

      const singleBlob = Array.isArray(converted) ? converted[0] : converted;
      const url = URL.createObjectURL(singleBlob);
      convertedBlobs.set(file, url);
      return url;
    } catch (err) {
      console.warn("Client-side HEIC preview conversion failed:", err);
      // Fallback to direct object URL
      return URL.createObjectURL(file);
    }
  }

  return URL.createObjectURL(file);
}

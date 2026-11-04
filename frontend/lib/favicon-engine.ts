/**
 * Favicon & App Icon Generator Engine
 *
 * Takes 1 master logo and outputs the complete standard modern favicon package:
 * - favicon-16x16.png
 * - favicon-32x32.png
 * - apple-touch-icon.png (180x180)
 * - android-chrome-192x192.png
 * - android-chrome-512x512.png
 * - site.webmanifest
 * - HTML snippet
 */

import { createZip, ZipEntry } from "./zip";

export interface FaviconItem {
  name: string;
  size: number;
  blob: Blob;
  dataUrl: string;
}

export const FAVICON_SIZES = [
  { name: "favicon-16x16.png", size: 16 },
  { name: "favicon-32x32.png", size: 32 },
  { name: "apple-touch-icon.png", size: 180 },
  { name: "android-chrome-192x192.png", size: 192 },
  { name: "android-chrome-512x512.png", size: 512 },
];

export const HTML_HEAD_SNIPPET = `<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
<link rel="manifest" href="/site.webmanifest">`;

export const DEFAULT_MANIFEST = {
  name: "My App",
  short_name: "App",
  icons: [
    {
      src: "/android-chrome-192x192.png",
      sizes: "192x192",
      type: "image/png",
    },
    {
      src: "/android-chrome-512x512.png",
      sizes: "512x512",
      type: "image/png",
    },
  ],
  theme_color: "#ffffff",
  background_color: "#ffffff",
  display: "standalone",
};

/**
 * Resize image onto square canvas and return Blob
 */
async function resizeToCanvasBlob(img: HTMLImageElement, size: number): Promise<{ blob: Blob; dataUrl: string }> {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not initialize 2D context.");

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, size, size);

  const dataUrl = canvas.toDataURL("image/png");
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Failed to encode icon."))), "image/png");
  });

  return { blob, dataUrl };
}

/**
 * Generate all favicon sizes and bundle into a ZIP archive
 */
export async function generateFaviconPackage(
  img: HTMLImageElement,
  appName = "My App"
): Promise<{ icons: FaviconItem[]; zipBlob: Blob }> {
  const icons: FaviconItem[] = [];
  const zipEntries: ZipEntry[] = [];

  for (const s of FAVICON_SIZES) {
    const { blob, dataUrl } = await resizeToCanvasBlob(img, s.size);
    icons.push({ name: s.name, size: s.size, blob, dataUrl });
    zipEntries.push({ name: s.name, blob });
  }

  // Also include favicon.ico using 32x32 PNG
  const { blob: icoBlob } = await resizeToCanvasBlob(img, 32);
  zipEntries.push({ name: "favicon.ico", blob: icoBlob });

  // Include site.webmanifest
  const manifest = { ...DEFAULT_MANIFEST, name: appName, short_name: appName };
  const manifestBlob = new Blob([JSON.stringify(manifest, null, 2)], {
    type: "application/json",
  });
  zipEntries.push({ name: "site.webmanifest", blob: manifestBlob });

  // Include HTML README snippet
  const readmeBlob = new Blob([HTML_HEAD_SNIPPET], { type: "text/plain" });
  zipEntries.push({ name: "html-head-tags.html", blob: readmeBlob });

  const zipBlob = await createZip(zipEntries);

  return { icons, zipBlob };
}

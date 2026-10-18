/**
 * Client-side EXIF reader + metadata stripper.
 *
 * EXIF is parsed straight out of the JPEG APP1 segment (and GPS out of the GPS
 * sub-IFD). Stripping works losslessly on JPEG/PNG by dropping only the
 * metadata segments/chunks, so image pixels are never touched. Nothing is
 * uploaded.
 */

export interface ExifTag {
  tag: number;
  name: string;
  value: string;
  /** Raw numeric values, kept for derived fields like GPS. */
  values?: number[];
}

export interface GpsPosition {
  lat: number;
  lon: number;
}

export interface ImageMeta {
  width: number;
  height: number;
  size: number;
  type: string;
  lastModified: number;
  tags: ExifTag[];
  gps: GpsPosition | null;
  hasMetadata: boolean;
}

const TAG_NAMES: Record<number, string> = {
  0x010e: "Image Description",
  0x010f: "Make",
  0x0110: "Model",
  0x0112: "Orientation",
  0x011a: "X Resolution",
  0x011b: "Y Resolution",
  0x0128: "Resolution Unit",
  0x0131: "Software",
  0x0132: "Date/Time",
  0x013b: "Artist",
  0x8298: "Copyright",
  0x829a: "Exposure Time",
  0x829d: "F Number",
  0x8822: "Exposure Program",
  0x8827: "ISO",
  0x9000: "Exif Version",
  0x9003: "Date/Time Original",
  0x9004: "Date/Time Digitized",
  0x9201: "Shutter Speed",
  0x9202: "Aperture",
  0x9204: "Exposure Bias",
  0x9207: "Metering Mode",
  0x9209: "Flash",
  0x920a: "Focal Length",
  0x927c: "Maker Note",
  0x9286: "User Comment",
  0xa001: "Color Space",
  0xa002: "Pixel Width",
  0xa003: "Pixel Height",
  0xa402: "Exposure Mode",
  0xa403: "White Balance",
  0xa405: "Focal Length (35mm)",
  0xa430: "Camera Owner",
  0xa431: "Body Serial",
  0xa432: "Lens Specification",
  0xa433: "Lens Make",
  0xa434: "Lens Model",
  // GPS IFD
  0x0000: "GPS Version",
  0x0001: "GPS Latitude Ref",
  0x0002: "GPS Latitude",
  0x0003: "GPS Longitude Ref",
  0x0004: "GPS Longitude",
  0x0005: "GPS Altitude Ref",
  0x0006: "GPS Altitude",
  0x0007: "GPS Time",
  0x001d: "GPS Date",
};

const TYPE_SIZES = [0, 1, 1, 2, 4, 8, 1, 1, 2, 4, 8, 4, 8];

const ORIENTATIONS: Record<number, string> = {
  1: "Normal",
  2: "Mirror horizontal",
  3: "Rotate 180°",
  4: "Mirror vertical",
  5: "Mirror horizontal, rotate 270°",
  6: "Rotate 90° CW",
  7: "Mirror horizontal, rotate 90°",
  8: "Rotate 270° CW",
};

function readU16(view: DataView, offset: number, le: boolean): number {
  return view.getUint16(offset, le);
}

function readU32(view: DataView, offset: number, le: boolean): number {
  return view.getUint32(offset, le);
}

function readU32BE(bytes: Uint8Array, offset: number): number {
  return (
    bytes[offset] * 0x1000000 +
    ((bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3])
  );
}

interface RawEntry {
  tag: number;
  type: number;
  count: number;
  text: string;
  numbers: number[];
}

function readEntry(view: DataView, bytes: Uint8Array, tiffStart: number, entry: number, le: boolean): RawEntry {
  const tag = readU16(view, entry, le);
  const type = readU16(view, entry + 2, le);
  const count = readU32(view, entry + 4, le);
  const valueOffset = readU32(view, entry + 8, le);
  const size = TYPE_SIZES[type] || 1;
  const total = size * count;
  const dataStart = total <= 4 ? entry + 8 : tiffStart + valueOffset;

  const numbers: number[] = [];
  let text = "";

  if (type === 2) {
    let s = "";
    for (let i = 0; i < count; i++) {
      const c = bytes[dataStart + i];
      if (c === 0) break;
      s += String.fromCharCode(c);
    }
    text = s.trim();
  } else if (type === 5 || type === 10) {
    for (let i = 0; i < count; i++) {
      const base = dataStart + i * 8;
      const num = readU32(view, base, le);
      const den = readU32(view, base + 4, le);
      numbers.push(den === 0 ? 0 : num / den);
    }
  } else if (type === 3) {
    for (let i = 0; i < count; i++) numbers.push(readU16(view, dataStart + i * 2, le));
  } else if (type === 4) {
    for (let i = 0; i < count; i++) numbers.push(readU32(view, dataStart + i * 4, le));
  } else if (type === 9) {
    for (let i = 0; i < count; i++) numbers.push(view.getInt32(dataStart + i * 4, le));
  } else if (type === 1 || type === 7) {
    for (let i = 0; i < count && i < 16; i++) numbers.push(bytes[dataStart + i]);
    if (type === 7) text = "[binary]";
  }

  return { tag, type, count, text, numbers };
}

function pretty(tag: number, entry: RawEntry): string {
  const n = entry.numbers;
  switch (tag) {
    case 0x0112:
      return ORIENTATIONS[n[0]] ?? String(n[0]);
    case 0x829a: {
      const v = n[0];
      if (!v) return "";
      return v < 1 ? `1/${Math.round(1 / v)} s` : `${v} s`;
    }
    case 0x829d:
      return `f/${n[0]}`;
    case 0x920a:
      return `${n[0]} mm`;
    case 0xa432:
      return n.map((x) => `${x}mm`).join(" – ");
    case 0x0002:
    case 0x0004:
      return n.map((x) => x.toFixed(4)).join("°, ") + "°";
  }
  if (entry.text) return entry.text;
  if (n.length) return n.map((x) => (Number.isInteger(x) ? x : Number(x.toFixed(3)))).join(", ");
  return "";
}

function parseTiff(bytes: Uint8Array, tiffStart: number): ExifTag[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (tiffStart + 8 > bytes.length) return [];

  const order = readU16(view, tiffStart, false);
  const le = order === 0x4949;
  if (order !== 0x4949 && order !== 0x4d4d) return [];
  if (readU16(view, tiffStart + 2, le) !== 42) return [];

  const tags: ExifTag[] = [];
  const visited = new Set<number>();

  const readIfd = (offset: number) => {
    if (offset <= 0 || visited.has(offset)) return;
    const abs = tiffStart + offset;
    if (abs + 2 > bytes.length) return;
    visited.add(offset);

    const count = readU16(view, abs, le);
    for (let i = 0; i < count; i++) {
      const entryOffset = abs + 2 + i * 12;
      if (entryOffset + 12 > bytes.length) break;
      const tag = readU16(view, entryOffset, le);
      if (tag === 0x8769 || tag === 0x8825) {
        const sub = readU32(view, entryOffset + 8, le);
        readIfd(sub);
        continue;
      }
      if (tag === 0x927c) continue; // skip MakerNote (opaque binary)
      const entry = readEntry(view, bytes, tiffStart, entryOffset, le);
      tags.push({
        tag,
        name: TAG_NAMES[tag] ?? `Tag 0x${tag.toString(16).padStart(4, "0")}`,
        value: pretty(tag, entry),
        values: entry.numbers,
      });
    }

    const next = readU32(view, abs + 2 + count * 12, le);
    if (next) readIfd(next);
  };

  readIfd(readU32(view, tiffStart + 4, le));
  return tags;
}

function isExifHeader(bytes: Uint8Array, offset: number): boolean {
  return (
    bytes[offset] === 0x45 && // E
    bytes[offset + 1] === 0x78 && // x
    bytes[offset + 2] === 0x69 && // i
    bytes[offset + 3] === 0x66 && // f
    bytes[offset + 4] === 0x00 &&
    bytes[offset + 5] === 0x00
  );
}

function readJpegExif(bytes: Uint8Array): ExifTag[] {
  let i = 2;
  while (i + 3 < bytes.length) {
    if (bytes[i] !== 0xff) {
      i++;
      continue;
    }
    const marker = bytes[i + 1];
    if (marker === 0xda) break; // start of scan
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2;
      continue;
    }
    const len = (bytes[i + 2] << 8) | bytes[i + 3];
    if (marker === 0xe1 && isExifHeader(bytes, i + 4)) {
      return parseTiff(bytes, i + 10);
    }
    i += 2 + len;
  }
  return [];
}

function gpsFromTags(tags: ExifTag[]): GpsPosition | null {
  const lat = tags.find((t) => t.tag === 0x0002 && (t.values?.length ?? 0) === 3);
  const lon = tags.find((t) => t.tag === 0x0004 && (t.values?.length ?? 0) === 3);
  const latRef = tags.find((t) => t.tag === 0x0001);
  const lonRef = tags.find((t) => t.tag === 0x0003);
  if (!lat || !lon || !lat.values || !lon.values) return null;

  const toDeg = ([d, m, s]: number[]) => d + m / 60 + s / 3600;
  let latitude = toDeg(lat.values);
  let longitude = toDeg(lon.values);
  if (latRef?.value?.toUpperCase().startsWith("S")) latitude = -latitude;
  if (lonRef?.value?.toUpperCase().startsWith("W")) longitude = -longitude;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { lat: latitude, lon: longitude };
}

/** Read dimensions and any EXIF tags from a file. */
export async function readImageMeta(
  file: File,
  width: number,
  height: number,
): Promise<ImageMeta> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let tags: ExifTag[] = [];
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    try {
      tags = readJpegExif(bytes);
    } catch {
      tags = [];
    }
  }
  return {
    width,
    height,
    size: file.size,
    type: file.type || "image/*",
    lastModified: file.lastModified,
    tags,
    gps: gpsFromTags(tags),
    hasMetadata: tags.length > 0,
  };
}

function stripJpeg(bytes: Uint8Array): Uint8Array {
  const out: number[] = [0xff, 0xd8];
  let i = 2;
  while (i < bytes.length) {
    if (bytes[i] !== 0xff) {
      out.push(bytes[i]);
      i++;
      continue;
    }
    const marker = bytes[i + 1];
    if (marker === 0xd9) {
      out.push(0xff, 0xd9);
      break;
    }
    if (marker === 0xda) {
      for (let j = i; j < bytes.length; j++) out.push(bytes[j]);
      break;
    }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      out.push(0xff, marker);
      i += 2;
      continue;
    }
    const len = (bytes[i + 2] << 8) | bytes[i + 3];
    const segEnd = i + 2 + len;
    // Keep colour-critical APP0 (JFIF), APP2 (ICC) and APP14 (Adobe);
    // drop EXIF/XMP (APP1), IPTC (APP13), APP12 and comments.
    const drop = marker === 0xe1 || marker === 0xec || marker === 0xed || marker === 0xfe;
    if (!drop) {
      for (let j = i; j < segEnd; j++) out.push(bytes[j]);
    }
    i = segEnd;
  }
  return new Uint8Array(out);
}

function stripPng(bytes: Uint8Array): Uint8Array {
  const out: number[] = [137, 80, 78, 71, 13, 10, 26, 10];
  const drop = new Set(["tEXt", "zTXt", "iTXt", "eXIf", "tIME"]);
  let i = 8;
  while (i + 8 <= bytes.length) {
    const len = readU32BE(bytes, i);
    const type = String.fromCharCode(bytes[i + 4], bytes[i + 5], bytes[i + 6], bytes[i + 7]);
    const chunkEnd = i + 12 + len;
    if (!drop.has(type)) {
      for (let j = i; j < chunkEnd && j < bytes.length; j++) out.push(bytes[j]);
    }
    i = chunkEnd;
    if (type === "IEND") break;
  }
  return new Uint8Array(out);
}

async function reencode(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Could not decode the image."));
      el.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas is unavailable in this browser.");
    ctx.drawImage(img, 0, 0);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Could not export the image."))),
        "image/png",
      ),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Return a copy of the image with metadata removed. JPEG/PNG are stripped
 * losslessly; other formats are re-encoded to PNG.
 */
export async function stripMetadata(file: File): Promise<{ blob: Blob; ext: string }> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    return {
      blob: new Blob([stripJpeg(bytes) as unknown as BlobPart], { type: "image/jpeg" }),
      ext: "jpg",
    };
  }
  if (
    bytes[0] === 137 &&
    bytes[1] === 80 &&
    bytes[2] === 78 &&
    bytes[3] === 71 &&
    bytes[4] === 13 &&
    bytes[5] === 10 &&
    bytes[6] === 26 &&
    bytes[7] === 10
  ) {
    return {
      blob: new Blob([stripPng(bytes) as unknown as BlobPart], { type: "image/png" }),
      ext: "png",
    };
  }
  return { blob: await reencode(file), ext: "png" };
}

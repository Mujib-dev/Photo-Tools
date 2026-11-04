/**
 * QR Code & Smart Barcode Engine
 * Generator (URL, Wi-Fi, vCard, Email, SMS) with logo embedding,
 * vector SVG generation, and client-side image QR scanner via jsQR.
 */

import QRCode from "qrcode";
import jsQR from "jsqr";

export type QrPayloadType = "url" | "wifi" | "vcard" | "email" | "sms" | "text";
export type QrErrorCorrection = "L" | "M" | "Q" | "H";

export interface WifiData {
  ssid: string;
  password?: string;
  encryption: "WPA" | "WEP" | "nopass";
  hidden?: boolean;
}

export interface VCardData {
  firstName: string;
  lastName: string;
  organization?: string;
  title?: string;
  phone?: string;
  email?: string;
  url?: string;
  address?: string;
}

export interface EmailData {
  email: string;
  subject?: string;
  body?: string;
}

export interface SmsData {
  phone: string;
  message?: string;
}

export interface QrStylingOptions {
  fgColor: string;
  bgColor: string;
  errorCorrection: QrErrorCorrection;
  margin: number;
  logoImg?: HTMLImageElement | null;
  logoScalePercent: number; // 10 to 25
}

export const DEFAULT_QR_STYLING: QrStylingOptions = {
  fgColor: "#0f172a",
  bgColor: "#ffffff",
  errorCorrection: "H",
  margin: 3,
  logoScalePercent: 20,
};

/** Format Wi-Fi credentials into standard QR code string */
export function formatWifiPayload(data: WifiData): string {
  const enc = data.encryption || "WPA";
  const h = data.hidden ? "H:true;" : "";
  const p = data.password ? `P:${data.password};` : "";
  return `WIFI:S:${data.ssid};T:${enc};${p}${h};`;
}

/** Format vCard 3.0 contact into standard QR code string */
export function formatVCardPayload(data: VCardData): string {
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `N:${data.lastName};${data.firstName};;;`,
    `FN:${data.firstName} ${data.lastName}`.trim(),
  ];
  if (data.organization) lines.push(`ORG:${data.organization}`);
  if (data.title) lines.push(`TITLE:${data.title}`);
  if (data.phone) lines.push(`TEL;TYPE=CELL:${data.phone}`);
  if (data.email) lines.push(`EMAIL:${data.email}`);
  if (data.url) lines.push(`URL:${data.url}`);
  if (data.address) lines.push(`ADR;TYPE=WORK:;;${data.address};;;;`);
  lines.push("END:VCARD");
  return lines.join("\n");
}

/** Format Email into standard mailto string */
export function formatEmailPayload(data: EmailData): string {
  const params: string[] = [];
  if (data.subject) params.push(`subject=${encodeURIComponent(data.subject)}`);
  if (data.body) params.push(`body=${encodeURIComponent(data.body)}`);
  const query = params.length > 0 ? `?${params.join("&")}` : "";
  return `mailto:${data.email}${query}`;
}

/** Format SMS into standard SMSTO string */
export function formatSmsPayload(data: SmsData): string {
  const msg = data.message ? `:${data.message}` : "";
  return `SMSTO:${data.phone}${msg}`;
}

/** Generate raw SVG markup string */
export async function generateQrSvg(
  payload: string,
  styling: QrStylingOptions,
): Promise<string> {
  const text = payload.trim() || "https://pictools.app";
  return QRCode.toString(text, {
    type: "svg",
    errorCorrectionLevel: styling.errorCorrection,
    margin: styling.margin,
    color: {
      dark: styling.fgColor,
      light: styling.bgColor === "transparent" ? "#00000000" : styling.bgColor,
    },
  });
}

/**
 * Render High-Resolution QR canvas with optional embedded center logo.
 */
export async function generateQrCanvas(
  payload: string,
  styling: QrStylingOptions,
  dimension = 1024,
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement("canvas");
  canvas.width = dimension;
  canvas.height = dimension;

  const text = payload.trim() || "https://pictools.app";

  await QRCode.toCanvas(canvas, text, {
    width: dimension,
    margin: styling.margin,
    errorCorrectionLevel: styling.errorCorrection,
    color: {
      dark: styling.fgColor,
      light: styling.bgColor === "transparent" ? "#00000000" : styling.bgColor,
    },
  });

  // If center logo is provided, draw it centered with a protective border cutout
  if (styling.logoImg) {
    const ctx = canvas.getContext("2d");
    if (ctx) {
      const logo = styling.logoImg;
      const logoScale = Math.max(0.1, Math.min(0.26, styling.logoScalePercent / 100));
      const logoSize = Math.round(dimension * logoScale);
      const logoX = Math.round((dimension - logoSize) / 2);
      const logoY = Math.round((dimension - logoSize) / 2);
      const padding = Math.max(6, Math.round(logoSize * 0.12));

      // Cutout background behind logo
      ctx.fillStyle = styling.bgColor === "transparent" ? "#ffffff" : styling.bgColor;
      ctx.beginPath();
      ctx.roundRect(
        logoX - padding,
        logoY - padding,
        logoSize + padding * 2,
        logoSize + padding * 2,
        Math.round(padding * 1.5),
      );
      ctx.fill();

      // Draw logo image
      ctx.drawImage(logo, logoX, logoY, logoSize, logoSize);
    }
  }

  return canvas;
}

/** Decoded QR Result from Scanner */
export interface ScanQrResult {
  data: string;
  type: "url" | "wifi" | "vcard" | "email" | "sms" | "text";
  parsedWifi?: WifiData;
  parsedVCard?: VCardData;
}

/** Detect payload type from decoded raw text */
export function parseQrResult(raw: string): ScanQrResult {
  const text = raw.trim();

  // Wi-Fi detection
  if (text.startsWith("WIFI:") || text.startsWith("wifi:")) {
    const ssidMatch = text.match(/S:([^;]+);/i);
    const passMatch = text.match(/P:([^;]+);/i);
    const typeMatch = text.match(/T:([^;]+);/i);
    return {
      data: text,
      type: "wifi",
      parsedWifi: {
        ssid: ssidMatch ? ssidMatch[1] : "",
        password: passMatch ? passMatch[1] : "",
        encryption: (typeMatch ? typeMatch[1] : "WPA") as any,
      },
    };
  }

  // URL detection
  if (/^https?:\/\//i.test(text) || /^www\./i.test(text)) {
    return { data: text, type: "url" };
  }

  // vCard detection
  if (text.includes("BEGIN:VCARD")) {
    const fnMatch = text.match(/FN:(.+)/i);
    const telMatch = text.match(/TEL.*:(.+)/i);
    const emailMatch = text.match(/EMAIL.*:(.+)/i);
    const orgMatch = text.match(/ORG:(.+)/i);
    return {
      data: text,
      type: "vcard",
      parsedVCard: {
        firstName: fnMatch ? fnMatch[1].trim() : "Contact",
        lastName: "",
        organization: orgMatch ? orgMatch[1].trim() : "",
        phone: telMatch ? telMatch[1].trim() : "",
        email: emailMatch ? emailMatch[1].trim() : "",
      },
    };
  }

  // Email
  if (text.startsWith("mailto:") || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) {
    return { data: text, type: "email" };
  }

  // SMS
  if (text.startsWith("SMSTO:") || text.startsWith("smsto:")) {
    return { data: text, type: "sms" };
  }

  return { data: text, type: "text" };
}

/** Decode QR Code from an HTMLImageElement using jsQR */
export async function decodeQrFromImage(img: HTMLImageElement): Promise<ScanQrResult | null> {
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth || 500;
  canvas.height = img.naturalHeight || 500;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;

  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  const code = jsQR(imgData.data, canvas.width, canvas.height, {
    inversionAttempts: "attemptBoth",
  });

  if (!code || !code.data) return null;
  return parseQrResult(code.data);
}

/**
 * 3D Device Mockup Studio Engine
 *
 * Renders uploaded screenshots inside vector device frames:
 * - iPhone 16 Pro (Titanium bezel, Dynamic Island, rounded corners)
 * - MacBook Pro (Aluminum bezel, notch, keyboard deck)
 * - iPad Pro / Tablet
 * - macOS Clean Browser Window (Traffic light buttons, URL bar)
 */

export type MockupDevice = "iphone16" | "macbook" | "ipad" | "browser";

export interface MockupConfig {
  device: MockupDevice;
  backgroundType:
    | "gradient-mesh"
    | "dark-studio"
    | "sunset"
    | "cyberpunk"
    | "aurora"
    | "nordic"
    | "warm-mocha"
    | "transparent"
    | "solid";
  backgroundColor: string;
  shadowBlur: number;
  canvasWidth: number;
  canvasHeight: number;
}

export const DEFAULT_MOCKUP_CONFIG: MockupConfig = {
  device: "iphone16",
  backgroundType: "gradient-mesh",
  backgroundColor: "#0f172a",
  shadowBlur: 35,
  canvasWidth: 1600,
  canvasHeight: 1200,
};

/**
 * Draw mockup background
 */
export function drawMockupBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  config: MockupConfig
) {
  if (config.backgroundType === "transparent") {
    ctx.clearRect(0, 0, width, height);
    return;
  }

  if (config.backgroundType === "solid") {
    ctx.fillStyle = config.backgroundColor;
    ctx.fillRect(0, 0, width, height);
    return;
  }

  const grad = ctx.createLinearGradient(0, 0, width, height);

  if (config.backgroundType === "sunset") {
    grad.addColorStop(0, "#f97316");
    grad.addColorStop(0.5, "#ec4899");
    grad.addColorStop(1, "#3b82f6");
  } else if (config.backgroundType === "dark-studio") {
    grad.addColorStop(0, "#1e293b");
    grad.addColorStop(0.5, "#0f172a");
    grad.addColorStop(1, "#020617");
  } else if (config.backgroundType === "cyberpunk") {
    grad.addColorStop(0, "#06b6d4");
    grad.addColorStop(0.5, "#d946ef");
    grad.addColorStop(1, "#f43f5e");
  } else if (config.backgroundType === "aurora") {
    grad.addColorStop(0, "#0f766e");
    grad.addColorStop(0.4, "#10b981");
    grad.addColorStop(1, "#0284c7");
  } else if (config.backgroundType === "nordic") {
    grad.addColorStop(0, "#334155");
    grad.addColorStop(0.5, "#64748b");
    grad.addColorStop(1, "#94a3b8");
  } else if (config.backgroundType === "warm-mocha") {
    grad.addColorStop(0, "#451a03");
    grad.addColorStop(0.5, "#78350f");
    grad.addColorStop(1, "#b45309");
  } else {
    // gradient-mesh (Indigo / Violet / Cyan)
    grad.addColorStop(0, "#4f46e5");
    grad.addColorStop(0.4, "#7c3aed");
    grad.addColorStop(1, "#06b6d4");
  }

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);
}

/**
 * Draw iPhone 16 Pro Frame with Dynamic Island and screenshot
 */
export function drawIphoneMockup(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
  screenImg: HTMLImageElement | null,
  shadowBlur: number
) {
  const phoneH = canvasH * 0.82;
  const phoneW = phoneH * 0.49;
  const x = (canvasW - phoneW) / 2;
  const y = (canvasH - phoneH) / 2;
  const radius = phoneW * 0.14;

  ctx.save();

  // Shadow
  if (shadowBlur > 0) {
    ctx.shadowColor = "rgba(0, 0, 0, 0.55)";
    ctx.shadowBlur = shadowBlur;
    ctx.shadowOffsetY = 24;
  }

  // Titanium Outer Bezel
  ctx.fillStyle = "#1e2124";
  ctx.beginPath();
  ctx.roundRect(x, y, phoneW, phoneH, radius);
  ctx.fill();

  ctx.restore();

  // Thin Bezel Border
  ctx.save();
  ctx.strokeStyle = "#40464d";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(x, y, phoneW, phoneH, radius);
  ctx.stroke();

  // Inner Screen Area
  const innerMargin = phoneW * 0.035;
  const screenX = x + innerMargin;
  const screenY = y + innerMargin;
  const screenW = phoneW - innerMargin * 2;
  const screenH = phoneH - innerMargin * 2;
  const screenRadius = radius * 0.85;

  ctx.beginPath();
  ctx.roundRect(screenX, screenY, screenW, screenH, screenRadius);
  ctx.clip();

  // Draw Screen Image or Placeholder
  if (screenImg) {
    ctx.drawImage(screenImg, screenX, screenY, screenW, screenH);
  } else {
    ctx.fillStyle = "#090d16";
    ctx.fillRect(screenX, screenY, screenW, screenH);
    ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
    ctx.font = "bold 24px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Upload Screenshot", screenX + screenW / 2, screenY + screenH / 2);
  }

  // Dynamic Island
  const islandW = screenW * 0.32;
  const islandH = screenH * 0.035;
  const islandX = screenX + (screenW - islandW) / 2;
  const islandY = screenY + screenH * 0.022;

  ctx.fillStyle = "#000000";
  ctx.beginPath();
  ctx.roundRect(islandX, islandY, islandW, islandH, islandH / 2);
  ctx.fill();

  ctx.restore();
}

/**
 * Draw iPad Pro Tablet Frame with slim symmetrical bezels and screenshot
 */
export function drawIpadMockup(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
  screenImg: HTMLImageElement | null,
  shadowBlur: number
) {
  const padH = canvasH * 0.78;
  const padW = padH * 0.72;
  const x = (canvasW - padW) / 2;
  const y = (canvasH - padH) / 2;
  const radius = padW * 0.055;

  ctx.save();

  if (shadowBlur > 0) {
    ctx.shadowColor = "rgba(0, 0, 0, 0.52)";
    ctx.shadowBlur = shadowBlur;
    ctx.shadowOffsetY = 22;
  }

  // Outer Aluminum Chassis
  ctx.fillStyle = "#1e2126";
  ctx.beginPath();
  ctx.roundRect(x, y, padW, padH, radius);
  ctx.fill();

  ctx.restore();

  // Thin Edge Highlight
  ctx.save();
  ctx.strokeStyle = "#474d55";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(x, y, padW, padH, radius);
  ctx.stroke();

  // Screen Area (Symmetrical bezels)
  const bezel = padW * 0.038;
  const screenX = x + bezel;
  const screenY = y + bezel;
  const screenW = padW - bezel * 2;
  const screenH = padH - bezel * 2;
  const screenRadius = radius * 0.65;

  ctx.beginPath();
  ctx.roundRect(screenX, screenY, screenW, screenH, screenRadius);
  ctx.clip();

  if (screenImg) {
    ctx.drawImage(screenImg, screenX, screenY, screenW, screenH);
  } else {
    ctx.fillStyle = "#0c1017";
    ctx.fillRect(screenX, screenY, screenW, screenH);
    ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
    ctx.font = "bold 24px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Upload Tablet Screenshot", screenX + screenW / 2, screenY + screenH / 2);
  }

  // Top Front Camera dot
  ctx.fillStyle = "#050608";
  ctx.beginPath();
  ctx.arc(x + padW / 2, y + bezel / 2, 4.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}


/**
 * Draw MacBook Pro Laptop Frame and screenshot
 */
export function drawMacbookMockup(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
  screenImg: HTMLImageElement | null,
  shadowBlur: number
) {
  const displayW = canvasW * 0.72;
  const displayH = displayW * 0.63;
  const x = (canvasW - displayW) / 2;
  const y = (canvasH - displayH) / 2 - 20;

  ctx.save();

  // Shadow
  if (shadowBlur > 0) {
    ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
    ctx.shadowBlur = shadowBlur;
    ctx.shadowOffsetY = 20;
  }

  // Display Lid Frame
  ctx.fillStyle = "#0c0d0e";
  ctx.beginPath();
  ctx.roundRect(x, y, displayW, displayH, 16);
  ctx.fill();

  ctx.restore();

  // Aluminum Border
  ctx.save();
  ctx.strokeStyle = "#52575e";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(x, y, displayW, displayH, 16);
  ctx.stroke();

  // Inner Screen
  const bezel = displayW * 0.022;
  const screenX = x + bezel;
  const screenY = y + bezel;
  const screenW = displayW - bezel * 2;
  const screenH = displayH - bezel * 2;

  ctx.beginPath();
  ctx.roundRect(screenX, screenY, screenW, screenH, 8);
  ctx.clip();

  if (screenImg) {
    ctx.drawImage(screenImg, screenX, screenY, screenW, screenH);
  } else {
    ctx.fillStyle = "#090d16";
    ctx.fillRect(screenX, screenY, screenW, screenH);
    ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
    ctx.font = "bold 28px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Upload Screenshot", screenX + screenW / 2, screenY + screenH / 2);
  }

  // Camera Notch
  const notchW = screenW * 0.15;
  const notchH = 14;
  ctx.fillStyle = "#000000";
  ctx.beginPath();
  ctx.roundRect(screenX + (screenW - notchW) / 2, screenY, notchW, notchH, [0, 0, 6, 6]);
  ctx.fill();

  ctx.restore();

  // Base / Keyboard Deck
  const baseW = displayW * 1.14;
  const baseH = 22;
  const baseX = (canvasW - baseW) / 2;
  const baseY = y + displayH;

  ctx.save();
  ctx.fillStyle = "#a1a7b0";
  ctx.beginPath();
  ctx.roundRect(baseX, baseY, baseW, baseH, [0, 0, 10, 10]);
  ctx.fill();

  // Trackpad indentation notch
  const notchIndW = baseW * 0.14;
  ctx.fillStyle = "#70767f";
  ctx.beginPath();
  ctx.roundRect(baseX + (baseW - notchIndW) / 2, baseY, notchIndW, 5, [0, 0, 4, 4]);
  ctx.fill();

  ctx.restore();
}

/**
 * Draw macOS Clean Browser Window Frame and screenshot
 */
export function drawBrowserMockup(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
  screenImg: HTMLImageElement | null,
  shadowBlur: number
) {
  const winW = canvasW * 0.78;
  const winH = winW * 0.62;
  const x = (canvasW - winW) / 2;
  const y = (canvasH - winH) / 2;
  const titleH = 46;

  ctx.save();

  // Shadow
  if (shadowBlur > 0) {
    ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
    ctx.shadowBlur = shadowBlur;
    ctx.shadowOffsetY = 24;
  }

  // Window Background
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.roundRect(x, y, winW, winH, 14);
  ctx.fill();

  ctx.restore();

  // Title Bar
  ctx.save();
  ctx.fillStyle = "#f1f5f9";
  ctx.beginPath();
  ctx.roundRect(x, y, winW, titleH, [14, 14, 0, 0]);
  ctx.fill();

  // Traffic Light Buttons (Red, Yellow, Green)
  const dotY = y + titleH / 2;
  const dots = [
    { x: x + 20, color: "#ff5f56" },
    { x: x + 38, color: "#ffbd2e" },
    { x: x + 56, color: "#27c93f" },
  ];
  for (const dot of dots) {
    ctx.fillStyle = dot.color;
    ctx.beginPath();
    ctx.arc(dot.x, dotY, 6, 0, Math.PI * 2);
    ctx.fill();
  }

  // Address Bar
  const urlW = winW * 0.52;
  const urlH = 26;
  const urlX = x + (winW - urlW) / 2;
  const urlY = y + (titleH - urlH) / 2;

  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.roundRect(urlX, urlY, urlW, urlH, 6);
  ctx.fill();
  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = "#64748b";
  ctx.font = "11px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("pictools.app", urlX + urlW / 2, urlY + urlH / 2);

  // Content Area
  const contentY = y + titleH;
  const contentH = winH - titleH;

  ctx.beginPath();
  ctx.roundRect(x, contentY, winW, contentH, [0, 0, 14, 14]);
  ctx.clip();

  if (screenImg) {
    ctx.drawImage(screenImg, x, contentY, winW, contentH);
  } else {
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(x, contentY, winW, contentH);
    ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
    ctx.font = "bold 26px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Upload Screenshot", x + winW / 2, contentY + contentH / 2);
  }

  ctx.restore();
}


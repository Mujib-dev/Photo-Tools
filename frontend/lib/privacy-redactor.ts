/**
 * AI Smart Privacy Redactor Engine
 * Detects faces, license plates, credit cards, and text PII,
 * applying irreversible blur, pixelation, or black censorship bars.
 */

export type RedactionStyle = "blur" | "pixelate" | "blackout" | "whiteout";
export type RedactionCategory = "face" | "plate" | "card" | "text" | "custom";

export interface RedactionBox {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  category: RedactionCategory;
  label: string;
  style: RedactionStyle;
}

/**
 * Heuristic detector for faces, plates, and card blocks based on
 * contrast, skin chrominance, and aspect ratio signatures.
 */
export function autoDetectSensitiveRegions(
  imageData: ImageData,
  options: {
    detectFaces?: boolean;
    detectPlates?: boolean;
    detectCards?: boolean;
  } = {},
): RedactionBox[] {
  const { detectFaces = true, detectPlates = true, detectCards = true } = options;
  const { width, height, data } = imageData;
  const boxes: RedactionBox[] = [];

  // Downsample to a fast analysis grid (e.g. 160x120)
  const gridW = 80;
  const gridH = Math.round((height / width) * 80);
  const cellW = width / gridW;
  const cellH = height / gridH;

  const skinMap = new Uint8Array(gridW * gridH);
  const edgeMap = new Uint8Array(gridW * gridH);

  for (let gy = 0; gy < gridH; gy++) {
    for (let gx = 0; gx < gridW; gx++) {
      const px = Math.min(width - 1, Math.floor(gx * cellW + cellW / 2));
      const py = Math.min(height - 1, Math.floor(gy * cellH + cellH / 2));
      const idx = (py * width + px) * 4;

      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];

      // Skin tone heuristics in RGB/YCbCr
      const isSkin =
        r > 95 &&
        g > 40 &&
        b > 20 &&
        r - g > 15 &&
        r > b &&
        Math.abs(r - g) > 15 &&
        r - b > 15;

      if (isSkin) skinMap[gy * gridW + gx] = 1;

      // High contrast edge heuristic
      if (px < width - 2 && py < height - 2) {
        const nextIdx = (py * width + px + 1) * 4;
        const diff = Math.abs(r - data[nextIdx]) + Math.abs(g - data[nextIdx + 1]);
        if (diff > 50) edgeMap[gy * gridW + gx] = 1;
      }
    }
  }

  // 1. Detect Face Clusters from skin map
  if (detectFaces) {
    const visited = new Uint8Array(gridW * gridH);
    for (let gy = 0; gy < gridH; gy++) {
      for (let gx = 0; gx < gridW; gx++) {
        const gIdx = gy * gridW + gx;
        if (skinMap[gIdx] === 1 && visited[gIdx] === 0) {
          // Connected component flood fill
          let minX = gx, maxX = gx, minY = gy, maxY = gy, count = 0;
          const queue = [gIdx];
          visited[gIdx] = 1;

          while (queue.length > 0) {
            const curr = queue.pop()!;
            const cx = curr % gridW;
            const cy = Math.floor(curr / gridW);
            count++;

            if (cx < minX) minX = cx;
            if (cx > maxX) maxX = cx;
            if (cy < minY) minY = cy;
            if (cy > maxY) maxY = cy;

            // 4-way neighbors
            for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
              const nx = cx + dx;
              const ny = cy + dy;
              if (nx >= 0 && nx < gridW && ny >= 0 && ny < gridH) {
                const nIdx = ny * gridW + nx;
                if (skinMap[nIdx] === 1 && visited[nIdx] === 0) {
                  visited[nIdx] = 1;
                  queue.push(nIdx);
                }
              }
            }
          }

          const cW = maxX - minX + 1;
          const cH = maxY - minY + 1;
          const aspect = cW / cH;

          // Faces have oval/roughly square aspect (0.6 to 1.4) and meaningful density
          if (count >= 12 && aspect > 0.6 && aspect < 1.4) {
            boxes.push({
              id: `face-${boxes.length + 1}`,
              x: Math.max(0, Math.floor(minX * cellW)),
              y: Math.max(0, Math.floor(minY * cellH)),
              width: Math.min(width, Math.floor(cW * cellW)),
              height: Math.min(height, Math.floor(cH * cellH)),
              category: "face",
              label: "Face",
              style: "blur",
            });
          }
        }
      }
    }
  }

  // 2. Detect License Plate candidates (horizontal rectangular high-contrast text band)
  if (detectPlates) {
    for (let gy = Math.floor(gridH * 0.4); gy < gridH - 4; gy += 3) {
      let run = 0;
      let startGx = 0;
      for (let gx = 0; gx < gridW; gx++) {
        if (edgeMap[gy * gridW + gx] === 1 && skinMap[gy * gridW + gx] === 0) {
          if (run === 0) startGx = gx;
          run++;
        } else {
          if (run > 8 && run < 28) {
            const plateW = run * cellW;
            const plateH = 5 * cellH;
            const pX = startGx * cellW;
            const pY = Math.max(0, (gy - 2) * cellH);

            // Avoid overlapping existing boxes
            const overlaps = boxes.some(
              (b) => Math.abs(b.x - pX) < plateW * 0.6 && Math.abs(b.y - pY) < plateH * 0.6,
            );
            if (!overlaps) {
              boxes.push({
                id: `plate-${boxes.length + 1}`,
                x: Math.floor(pX),
                y: Math.floor(pY),
                width: Math.floor(plateW),
                height: Math.floor(plateH),
                category: "plate",
                label: "License Plate",
                style: "pixelate",
              });
            }
          }
          run = 0;
        }
      }
    }
  }

  // 3. Detect Credit Cards & ID Badges (Aspect ratio ~1.58:1 with high-frequency text)
  if (detectCards) {
    for (let gy = 2; gy < gridH - 12; gy += 4) {
      for (let gx = 2; gx < gridW - 20; gx += 4) {
        const cW = 18;
        const cH = 11;
        if (gx + cW < gridW && gy + cH < gridH) {
          let edges = 0;
          for (let y = gy; y < gy + cH; y++) {
            for (let x = gx; x < gx + cW; x++) {
              if (edgeMap[y * gridW + x] === 1) edges++;
            }
          }
          const density = edges / (cW * cH);
          if (density > 0.45 && density < 0.82) {
            const cardX = gx * cellW;
            const cardY = gy * cellH;
            const cardWidth = cW * cellW;
            const cardHeight = cH * cellH;
            const overlaps = boxes.some(
              (b) => Math.abs(b.x - cardX) < cardWidth * 0.65 && Math.abs(b.y - cardY) < cardHeight * 0.65,
            );
            if (!overlaps) {
              boxes.push({
                id: `card-${boxes.length + 1}`,
                x: Math.floor(cardX),
                y: Math.floor(cardY),
                width: Math.floor(cardWidth),
                height: Math.floor(cardHeight),
                category: "card",
                label: "Card / ID Badge",
                style: "blackout",
              });
            }
          }
        }
      }
    }
  }

  return boxes;
}

/**
 * Applies irreversible redactions (blur, pixelate, blackout, whiteout)
 * onto an HTMLCanvasElement.
 */
export function applyRedactionsToCanvas(
  canvas: HTMLCanvasElement,
  boxes: RedactionBox[],
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  for (const box of boxes) {
    const { x, y, width, height, style } = box;
    if (width <= 0 || height <= 0) continue;

    switch (style) {
      case "blackout": {
        ctx.fillStyle = "#000000";
        ctx.fillRect(x, y, width, height);
        break;
      }

      case "whiteout": {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(x, y, width, height);
        break;
      }

      case "pixelate": {
        // Pixelation block size (proportional to box size)
        const blockSize = Math.max(8, Math.min(32, Math.floor(Math.min(width, height) / 8)));
        const imgData = ctx.getImageData(x, y, width, height);
        const d = imgData.data;

        for (let py = 0; py < height; py += blockSize) {
          for (let px = 0; px < width; px += blockSize) {
            // Sample center pixel
            const sX = Math.min(width - 1, px + Math.floor(blockSize / 2));
            const sY = Math.min(height - 1, py + Math.floor(blockSize / 2));
            const sIdx = (sY * width + sX) * 4;

            const r = d[sIdx];
            const g = d[sIdx + 1];
            const b = d[sIdx + 2];
            const a = d[sIdx + 3];

            // Fill block
            for (let by = py; by < Math.min(height, py + blockSize); by++) {
              for (let bx = px; bx < Math.min(width, px + blockSize); bx++) {
                const bIdx = (by * width + bx) * 4;
                d[bIdx] = r;
                d[bIdx + 1] = g;
                d[bIdx + 2] = b;
                d[bIdx + 3] = a;
              }
            }
          }
        }
        ctx.putImageData(imgData, x, y);
        break;
      }

      case "blur": {
        // Multi-pass box blur for smooth, irreversible privacy
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y, width, height);
        ctx.clip();

        ctx.filter = "blur(18px)";
        // Draw canvas onto itself with blur filter inside clipped area
        ctx.drawImage(canvas, 0, 0);
        ctx.drawImage(canvas, 0, 0);
        ctx.restore();
        break;
      }
    }
  }
}

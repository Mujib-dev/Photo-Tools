/**
 * High-performance client-side Bitmap-to-SVG Vectorizer & Tracer.
 * Traces raster bitmap images (logos, icons, signatures, sketches, illustrations)
 * into clean, scalable SVG vector paths with curve smoothing and color clustering.
 */

export type VectorizeMode = "color" | "monochrome" | "outline";

export interface VectorizeOptions {
  mode: VectorizeMode;
  colors: number; // 2 to 32 in color mode
  threshold: number; // 0 to 255 for monochrome
  smoothing: number; // 0 (polygon) to 5 (smooth bezier)
  filterSpeckles: number; // minimum path area in pixels (0 to 30)
  invert: boolean;
  strokeWidth: number; // for outline mode
}

export const DEFAULT_VECTORIZE_OPTIONS: VectorizeOptions = {
  mode: "color",
  colors: 6,
  threshold: 128,
  smoothing: 2,
  filterSpeckles: 4,
  invert: false,
  strokeWidth: 1.5,
};

export interface VectorizeResult {
  svgString: string;
  width: number;
  height: number;
  pathCount: number;
  colorCount: number;
  byteSize: number;
}

interface Point {
  x: number;
  y: number;
}

/** Convert hex to rgb */
function hexToRgb(hex: string): [number, number, number] {
  const c = hex.replace("#", "");
  const num = parseInt(c, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

/** Convert rgb to hex */
function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  const toH = (v: number) => clamp(v).toString(16).padStart(2, "0");
  return `#${toH(r)}${toH(g)}${toH(b)}`;
}

/**
 * Fast Marching Squares contour tracer for a 2D boolean grid.
 * Returns an array of closed path points.
 */
function traceGridContours(
  grid: Uint8Array,
  width: number,
  height: number,
  minArea = 4,
): Point[][] {
  const visited = new Uint8Array(width * height);
  const paths: Point[][] = [];

  // Directions for contour boundary walking: 0: Right, 1: Down, 2: Left, 3: Up
  const dx = [1, 0, -1, 0];
  const dy = [0, 1, 0, -1];

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      // Look for a contour edge transition: inside pixel with an unvisited boundary
      if (grid[idx] === 1 && visited[idx] === 0 && grid[idx - 1] === 0) {
        // Trace boundary contour
        const points: Point[] = [];
        let cx = x;
        let cy = y;
        let dir = 0; // start moving right
        let steps = 0;
        const maxSteps = width * height;

        do {
          points.push({ x: cx, y: cy });
          visited[cy * width + cx] = 1;

          // Turn right, straight, left, or back to follow boundary
          let nextDir = (dir + 3) % 4; // turn left relative to current dir
          let found = false;

          for (let i = 0; i < 4; i++) {
            const testDir = (nextDir + i) % 4;
            const nx = cx + dx[testDir];
            const ny = cy + dy[testDir];

            if (nx >= 0 && nx < width && ny >= 0 && ny < height && grid[ny * width + nx] === 1) {
              cx = nx;
              cy = ny;
              dir = testDir;
              found = true;
              break;
            }
          }

          if (!found) break;
          steps++;
        } while ((cx !== x || cy !== y) && steps < maxSteps);

        if (points.length >= minArea) {
          paths.push(points);
        }
      }
    }
  }

  return paths;
}

/** Simplify points by distance threshold */
function simplifyPoints(points: Point[], tolerance = 1.0): Point[] {
  if (points.length <= 2) return points;
  const result: Point[] = [points[0]];

  for (let i = 1; i < points.length; i++) {
    const prev = result[result.length - 1];
    const curr = points[i];
    const distSq = (curr.x - prev.x) ** 2 + (curr.y - prev.y) ** 2;
    if (distSq >= tolerance * tolerance) {
      result.push(curr);
    }
  }

  return result;
}

/** Convert an array of contour points into a smoothed SVG path `d` string with corner preservation */
function pointsToSvgPath(points: Point[], smoothing: number): string {
  if (points.length < 3) return "";

  const pts = simplifyPoints(points, Math.max(0.6, smoothing * 0.7));
  const n = pts.length;
  if (n < 3) return "";

  let d = `M ${pts[0].x} ${pts[0].y}`;

  if (smoothing <= 0) {
    // Pure polygonal segments
    for (let i = 1; i < n; i++) {
      d += ` L ${pts[i].x} ${pts[i].y}`;
    }
  } else {
    // Corner-preserving curve fitting:
    // Detect sharp corners (> 55 degree turn) to keep crisp geometric angles
    for (let i = 0; i < n; i++) {
      const prev = pts[(i - 1 + n) % n];
      const curr = pts[i];
      const next = pts[(i + 1) % n];

      const v1x = curr.x - prev.x;
      const v1y = curr.y - prev.y;
      const v2x = next.x - curr.x;
      const v2y = next.y - curr.y;

      const len1 = Math.hypot(v1x, v1y);
      const len2 = Math.hypot(v2x, v2y);

      let isCorner = false;
      if (len1 > 0.001 && len2 > 0.001) {
        const dot = (v1x * v2x + v1y * v2y) / (len1 * len2);
        // Angle sharper than ~55 degrees (cos < 0.57) is a sharp corner
        if (dot < 0.57) {
          isCorner = true;
        }
      }

      if (isCorner) {
        d += ` L ${curr.x} ${curr.y}`;
      } else {
        const midX = Number(((curr.x + next.x) * 0.5).toFixed(1));
        const midY = Number(((curr.y + next.y) * 0.5).toFixed(1));
        d += ` Q ${curr.x} ${curr.y} ${midX} ${midY}`;
      }
    }
  }

  d += " Z";
  return d;
}

/**
 * Main Vectorizer execution.
 * Extracts image data, performs quantization, contour tracing, and outputs SVG string.
 */
export function traceImageToSvg(
  img: HTMLImageElement,
  options: VectorizeOptions,
): VectorizeResult {
  const maxDimension = 640; // Optimal resolution for fast, clean vectorization
  let w = img.naturalWidth || 400;
  let h = img.naturalHeight || 400;

  if (w > maxDimension || h > maxDimension) {
    if (w >= h) {
      h = Math.round((h * maxDimension) / w);
      w = maxDimension;
    } else {
      w = Math.round((w * maxDimension) / h);
      h = maxDimension;
    }
  }

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Could not initialize canvas context");

  ctx.drawImage(img, 0, 0, w, h);
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  const svgPaths: { pathD: string; color: string }[] = [];

  if (options.mode === "monochrome" || options.mode === "outline") {
    // Binary threshold grid
    const grid = new Uint8Array(w * h);
    const thresh = options.threshold;

    for (let i = 0; i < data.length; i += 4) {
      const alpha = data[i + 3];
      if (alpha < 64) {
        grid[i / 4] = options.invert ? 1 : 0;
        continue;
      }
      const lum = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
      const isForeground = lum < thresh;
      grid[i / 4] = options.invert ? (isForeground ? 0 : 1) : (isForeground ? 1 : 0);
    }

    const contours = traceGridContours(grid, w, h, options.filterSpeckles);
    for (const pts of contours) {
      const d = pointsToSvgPath(pts, options.smoothing);
      if (d) {
        svgPaths.push({ pathD: d, color: "#1e293b" });
      }
    }
  } else {
    // Multi-color Posterized Vectorization
    // 1. Quantize pixels to N centroids
    const colorCount = Math.max(2, Math.min(24, options.colors));
    const step = 8;
    const sampledPixels: [number, number, number][] = [];

    for (let y = 0; y < h; y += step) {
      for (let x = 0; x < w; x += step) {
        const idx = (y * w + x) * 4;
        if (data[idx + 3] >= 128) {
          sampledPixels.push([data[idx], data[idx + 1], data[idx + 2]]);
        }
      }
    }

    if (sampledPixels.length === 0) {
      sampledPixels.push([0, 0, 0], [255, 255, 255]);
    }

    // K-Means++ Clustering for accurate dominant color quantization
    const centroids: [number, number, number][] = [];
    centroids.push([...sampledPixels[0]]);

    while (centroids.length < colorCount && centroids.length < sampledPixels.length) {
      let maxDist = -1;
      let bestCandidate = sampledPixels[0];
      for (const p of sampledPixels) {
        let minDistSq = Infinity;
        for (const c of centroids) {
          const d = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2;
          if (d < minDistSq) minDistSq = d;
        }
        if (minDistSq > maxDist) {
          maxDist = minDistSq;
          bestCandidate = p;
        }
      }
      centroids.push([...bestCandidate]);
    }

    // Fast Lloyd's K-Means clustering convergence (4 iterations)
    for (let iter = 0; iter < 4; iter++) {
      const sums: [number, number, number, number][] = centroids.map(() => [0, 0, 0, 0]);
      for (const p of sampledPixels) {
        let bestDist = Infinity;
        let bestC = 0;
        for (let c = 0; c < centroids.length; c++) {
          const d = (p[0] - centroids[c][0]) ** 2 + (p[1] - centroids[c][1]) ** 2 + (p[2] - centroids[c][2]) ** 2;
          if (d < bestDist) {
            bestDist = d;
            bestC = c;
          }
        }
        sums[bestC][0] += p[0];
        sums[bestC][1] += p[1];
        sums[bestC][2] += p[2];
        sums[bestC][3]++;
      }
      for (let c = 0; c < centroids.length; c++) {
        const count = sums[c][3];
        if (count > 0) {
          centroids[c][0] = Math.round(sums[c][0] / count);
          centroids[c][1] = Math.round(sums[c][1] / count);
          centroids[c][2] = Math.round(sums[c][2] / count);
        }
      }
    }

    // Assign every pixel to nearest centroid and trace per color layer
    const layerGrids = centroids.map(() => new Uint8Array(w * h));

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        if (data[idx + 3] < 96) continue;

        const pr = data[idx];
        const pg = data[idx + 1];
        const pb = data[idx + 2];

        let bestDist = Infinity;
        let bestC = 0;

        for (let c = 0; c < centroids.length; c++) {
          const [cr, cg, cb] = centroids[c];
          const dist = (pr - cr) ** 2 + (pg - cg) ** 2 + (pb - cb) ** 2;
          if (dist < bestDist) {
            bestDist = dist;
            bestC = c;
          }
        }

        layerGrids[bestC][y * w + x] = 1;
      }
    }

    // Trace contours for each color layer
    for (let c = 0; c < centroids.length; c++) {
      const hex = rgbToHex(centroids[c][0], centroids[c][1], centroids[c][2]);
      const contours = traceGridContours(layerGrids[c], w, h, options.filterSpeckles);

      for (const pts of contours) {
        const d = pointsToSvgPath(pts, options.smoothing);
        if (d) {
          svgPaths.push({ pathD: d, color: hex });
        }
      }
    }
  }

  // Build SVG XML string
  const isOutline = options.mode === "outline";
  const pathElements = svgPaths
    .map((p) => {
      if (isOutline) {
        return `    <path d="${p.pathD}" fill="none" stroke="${p.color}" stroke-width="${options.strokeWidth}" stroke-linejoin="round" />`;
      }
      return `    <path d="${p.pathD}" fill="${p.color}" />`;
    })
    .join("\n");

  const svgString = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
${pathElements}
</svg>`;

  const uniqueColors = new Set(svgPaths.map((p) => p.color)).size;
  const byteSize = new Blob([svgString]).size;

  return {
    svgString,
    width: w,
    height: h,
    pathCount: svgPaths.length,
    colorCount: uniqueColors,
    byteSize,
  };
}

/** Convert SVG string into React/Next.js JSX Component code */
export function svgToReactComponent(svgString: string, componentName = "VectorGraphic"): string {
  // Strip XML declaration
  let cleanSvg = svgString.replace(/<\?xml.*?\?>\s*/gi, "").trim();
  // Replace stroke-width with strokeWidth, etc.
  cleanSvg = cleanSvg
    .replaceAll("stroke-width=", "strokeWidth=")
    .replaceAll("stroke-linejoin=", "strokeLinejoin=")
    .replaceAll("stroke-linecap=", "strokeLinecap=")
    .replaceAll("viewBox=", "viewBox=")
    .replace("<svg", "<svg {...props}");

  return `import * as React from "react";

export function ${componentName}(props: React.SVGProps<SVGSVGElement>) {
  return (
${cleanSvg
  .split("\n")
  .map((line) => `    ${line}`)
  .join("\n")}
  );
}
`;
}

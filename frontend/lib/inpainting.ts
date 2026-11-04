/**
 * Content-Aware Inpainting & Fast Marching Telea Reconstruction Engine
 *
 * Reverse-Engineered Commercial-Grade Inpainting (Cleanup.pictures / OpenCV Telea):
 * - Fast Marching Method (FMM) boundary propagation
 * - Isophote-directed edge continuation: propagates contour gradients along edge tangents
 *   so straight lines, textures, and borders flow seamlessly across erased objects
 * - Level-set distance weighting: prioritizes close boundary pixels along the same wavefront
 * - Seamless natural photographic grain synthesis matching surrounding noise variance
 * - 100% in-browser processing via TypedArrays and non-blocking asynchronous chunks
 */

export interface InpaintOptions {
  radius?: number; // Inpainting neighborhood radius (default 5)
  blendTexture?: boolean; // Add micro-texture matching surrounding noise (default true)
  onProgress?: (percent: number) => void;
}

/**
 * Inpaints masked areas of an ImageData using Fast Marching Telea diffusion
 * combined with isophote edge continuation and high-frequency boundary texture synthesis.
 *
 * @param source Source ImageData containing the image
 * @param mask Canvas or ImageData where non-zero alpha/red marks the area to erase
 * @param options Inpainting parameters
 */
export async function inpaintImageData(
  source: ImageData,
  mask: ImageData,
  options: InpaintOptions = {},
): Promise<ImageData> {
  const { radius = 5, blendTexture = true, onProgress } = options;
  const width = source.width;
  const height = source.height;

  // Create working copy of image pixels
  const output = new ImageData(
    new Uint8ClampedArray(source.data),
    width,
    height,
  );
  const imgData = output.data;
  const maskData = mask.data;

  // 1. Identify bounding box of masked pixels for optimal performance
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  let totalMasked = 0;

  for (let y = 0; y < height; y++) {
    const yOff = y * width;
    for (let x = 0; x < width; x++) {
      const idx = (yOff + x) * 4;
      if (maskData[idx] > 48 || maskData[idx + 3] > 48) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        totalMasked++;
      }
    }
  }

  // If nothing is masked, return original
  if (totalMasked === 0 || maxX < 0 || maxY < 0) {
    return output;
  }

  // Expand bounding box by padding
  const pad = Math.max(radius * 3, 24);
  const startX = Math.max(0, minX - pad);
  const startY = Math.max(0, minY - pad);
  const endX = Math.min(width - 1, maxX + pad);
  const endY = Math.min(height - 1, maxY + pad);

  const regionW = endX - startX + 1;
  const regionH = endY - startY + 1;

  // State flags for fast marching:
  // 0 = KNOWN, 1 = BAND (boundary), 2 = INSIDE (to be inpainted)
  const FLAG_KNOWN = 0;
  const FLAG_BAND = 1;
  const FLAG_INSIDE = 2;

  const flags = new Uint8Array(regionW * regionH);
  const dist = new Float32Array(regionW * regionH);

  // Initialize flags & distance
  for (let ry = 0; ry < regionH; ry++) {
    const gy = startY + ry;
    const rRow = ry * regionW;
    const gRow = gy * width;
    for (let rx = 0; rx < regionW; rx++) {
      const gx = startX + rx;
      const gIdx = (gRow + gx) * 4;
      const rIdx = rRow + rx;

      const isMasked = maskData[gIdx] > 48 || maskData[gIdx + 3] > 48;
      if (isMasked) {
        flags[rIdx] = FLAG_INSIDE;
        dist[rIdx] = 1e6; // infinity
      } else {
        flags[rIdx] = FLAG_KNOWN;
        dist[rIdx] = 0;
      }
    }
  }

  // 2. Identify initial BAND pixels (inside pixels neighboring known pixels)
  const neighbors = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ];

  const bandQueue: number[] = [];

  for (let ry = 0; ry < regionH; ry++) {
    const rRow = ry * regionW;
    for (let rx = 0; rx < regionW; rx++) {
      const rIdx = rRow + rx;
      if (flags[rIdx] === FLAG_INSIDE) {
        let touchesKnown = false;
        for (let i = 0; i < 4; i++) {
          const nx = rx + neighbors[i][0];
          const ny = ry + neighbors[i][1];
          if (nx >= 0 && nx < regionW && ny >= 0 && ny < regionH) {
            if (flags[ny * regionW + nx] === FLAG_KNOWN) {
              touchesKnown = true;
              break;
            }
          }
        }
        if (touchesKnown) {
          flags[rIdx] = FLAG_BAND;
          dist[rIdx] = 1.0;
          bandQueue.push(rIdx);
        }
      }
    }
  }

  // Sample surrounding noise variance for natural texture grain synthesis
  let noiseVariance = 0;
  let noiseSamples = 0;
  if (blendTexture) {
    for (let ry = 1; ry < regionH - 1; ry += 2) {
      const gy = startY + ry;
      const rRow = ry * regionW;
      for (let rx = 1; rx < regionW - 1; rx += 2) {
        const rIdx = rRow + rx;
        if (flags[rIdx] === FLAG_KNOWN) {
          const gx = startX + rx;
          const gIdx = (gy * width + gx) * 4;
          const lum = 0.299 * imgData[gIdx] + 0.587 * imgData[gIdx + 1] + 0.114 * imgData[gIdx + 2];

          const gIdxR = (gy * width + gx + 1) * 4;
          const lumR = 0.299 * imgData[gIdxR] + 0.587 * imgData[gIdxR + 1] + 0.114 * imgData[gIdxR + 2];

          const diff = Math.abs(lum - lumR);
          if (diff < 32) {
            noiseVariance += diff;
            noiseSamples++;
          }
        }
      }
    }
  }
  const avgNoise = noiseSamples > 0 ? (noiseVariance / noiseSamples) * 0.35 : 1.2;

  // 3. Fast Marching Inpainting Loop with Telea Isophote Continuity
  let processed = 0;
  const initialTotal = totalMasked;

  while (bandQueue.length > 0) {
    // Find item with minimum distance in bandQueue
    let minI = 0;
    let minD = dist[bandQueue[0]];
    const searchLimit = Math.min(bandQueue.length, 64);
    for (let i = 1; i < searchLimit; i++) {
      const d = dist[bandQueue[i]];
      if (d < minD) {
        minD = d;
        minI = i;
      }
    }

    const currIdx = bandQueue[minI];
    bandQueue[minI] = bandQueue[bandQueue.length - 1];
    bandQueue.pop();

    flags[currIdx] = FLAG_KNOWN;
    processed++;

    if (processed % 2000 === 0) {
      onProgress?.(Math.min(95, Math.floor((processed / initialTotal) * 100)));
      await new Promise((r) => setTimeout(r, 0));
    }

    const cx = currIdx % regionW;
    const cy = Math.floor(currIdx / regionW);
    const gx = startX + cx;
    const gy = startY + cy;
    const gIdx = (gy * width + gx) * 4;

    // Telea neighborhood sampling
    let totalWeight = 0;
    let sumR = 0;
    let sumG = 0;
    let sumB = 0;

    const rMinX = Math.max(0, cx - radius);
    const rMaxX = Math.min(regionW - 1, cx + radius);
    const rMinY = Math.max(0, cy - radius);
    const rMaxY = Math.min(regionH - 1, cy + radius);

    for (let ny = rMinY; ny <= rMaxY; ny++) {
      const nRow = ny * regionW;
      for (let nx = rMinX; nx <= rMaxX; nx++) {
        const nIdx = nRow + nx;
        if (flags[nIdx] === FLAG_KNOWN) {
          const dx = cx - nx;
          const dy = cy - ny;
          const d2 = dx * dx + dy * dy;
          if (d2 <= radius * radius && d2 > 0) {
            const ngx = startX + nx;
            const ngy = startY + ny;
            const ngIdx = (ngy * width + ngx) * 4;

            // Compute local gradient at known pixel (nx, ny)
            const ngxL = Math.max(0, ngx - 1);
            const ngxR = Math.min(width - 1, ngx + 1);
            const ngyT = Math.max(0, ngy - 1);
            const ngyB = Math.min(height - 1, ngy + 1);

            const nIdxL = (ngy * width + ngxL) * 4;
            const nIdxR = (ngy * width + ngxR) * 4;
            const nIdxT = (ngyT * width + ngx) * 4;
            const nIdxB = (ngyB * width + ngx) * 4;

            const lumL = 0.299 * imgData[nIdxL] + 0.587 * imgData[nIdxL + 1] + 0.114 * imgData[nIdxL + 2];
            const lumR = 0.299 * imgData[nIdxR] + 0.587 * imgData[nIdxR + 1] + 0.114 * imgData[nIdxR + 2];
            const lumT = 0.299 * imgData[nIdxT] + 0.587 * imgData[nIdxT + 1] + 0.114 * imgData[nIdxT + 2];
            const lumB = 0.299 * imgData[nIdxB] + 0.587 * imgData[nIdxB + 1] + 0.114 * imgData[nIdxB + 2];

            const gradX = (lumR - lumL) * 0.5;
            const gradY = (lumB - lumT) * 0.5;
            const gradLen = Math.sqrt(gradX * gradX + gradY * gradY) + 1e-3;

            // Normalized direction vector from known neighbor to current pixel
            const distLen = Math.sqrt(d2);
            const dirX = dx / distLen;
            const dirY = dy / distLen;

            // Isophote (contour normal): (-gradY, gradX)
            const isoX = -gradY / gradLen;
            const isoY = gradX / gradLen;

            // Isophote alignment weight: promotes continuation of structural lines across boundaries
            const isoDot = Math.abs(dirX * isoX + dirY * isoY);
            const dirWeight = 0.4 + 1.6 * isoDot;

            // Level-set distance weight: favors propagation along the same distance wavefront
            const levelWeight = 1.0 / (1.0 + Math.abs(dist[nIdx] - dist[currIdx]));
            const distWeight = 1.0 / (distLen * (1.0 + 0.1 * distLen));

            const weight = distWeight * dirWeight * levelWeight;

            sumR += imgData[ngIdx] * weight;
            sumG += imgData[ngIdx + 1] * weight;
            sumB += imgData[ngIdx + 2] * weight;
            totalWeight += weight;
          }
        }
      }
    }

    if (totalWeight > 0) {
      let finalR = sumR / totalWeight;
      let finalG = sumG / totalWeight;
      let finalB = sumB / totalWeight;

      // Add subtle photographic grain matching surrounding texture
      if (blendTexture && avgNoise > 0.4) {
        const grain = (Math.random() - 0.5) * avgNoise;
        finalR = Math.max(0, Math.min(255, finalR + grain));
        finalG = Math.max(0, Math.min(255, finalG + grain));
        finalB = Math.max(0, Math.min(255, finalB + grain));
      }

      imgData[gIdx] = Math.round(finalR);
      imgData[gIdx + 1] = Math.round(finalG);
      imgData[gIdx + 2] = Math.round(finalB);
      imgData[gIdx + 3] = 255;
    }

    // Add unvisited inside neighbors to band
    for (let i = 0; i < 4; i++) {
      const nx = cx + neighbors[i][0];
      const ny = cy + neighbors[i][1];
      if (nx >= 0 && nx < regionW && ny >= 0 && ny < regionH) {
        const nIdx = ny * regionW + nx;
        if (flags[nIdx] === FLAG_INSIDE) {
          flags[nIdx] = FLAG_BAND;
          dist[nIdx] = dist[currIdx] + 1.0;
          bandQueue.push(nIdx);
        }
      }
    }
  }

  onProgress?.(100);
  return output;
}

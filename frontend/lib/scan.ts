import type { ScanRotation } from "./types";

/**
 * Rotate corner points to match a clockwise rotation of a `w × h` image and
 * reorder them so the result stays TL, TR, BR, BL.
 *
 * Rotating the image 90deg clockwise moves the original BL corner to the new
 * top-left and the original TR corner to the new bottom-right, so the point
 * positions alone are not enough — the labels must follow the contour.
 */
export function rotateCorners(
  corners: [number, number][],
  w: number,
  h: number,
  rot: ScanRotation,
): [number, number][] {
  const pts = corners.map((p) => [p[0], p[1]] as [number, number]);
  if (rot === 90) {
    const rotated = pts.map(([x, y]) => [h - 1 - y, x] as [number, number]);
    return [rotated[3], rotated[0], rotated[1], rotated[2]];
  }
  if (rot === 180) {
    const rotated = pts.map(([x, y]) => [w - 1 - x, h - 1 - y] as [number, number]);
    return [rotated[2], rotated[3], rotated[0], rotated[1]];
  }
  if (rot === 270) {
    const rotated = pts.map(([x, y]) => [y, w - 1 - x] as [number, number]);
    return [rotated[1], rotated[2], rotated[3], rotated[0]];
  }
  return pts;
}

/** Default inset corners when detection finds no page boundary (3% margin). */
export function insetCorners(w: number, h: number): [number, number][] {
  const m = Math.round(Math.min(w, h) * 0.03);
  return [
    [m, m],
    [w - m, m],
    [w - m, h - m],
    [m, h - m],
  ];
}

/** Full-image selection: TL, TR, BR, BL covering every pixel. */
export function fullCorners(w: number, h: number): [number, number][] {
  return [
    [0, 0],
    [w, 0],
    [w, h],
    [0, h],
  ];
}

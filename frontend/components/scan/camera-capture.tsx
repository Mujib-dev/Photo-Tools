"use client";

import * as React from "react";
import { Camera, Pause, Play, RefreshCcw, SwitchCamera, X } from "lucide-react";

import { Button } from "@/components/ui/button";

/* ── lightweight image processing (no OpenCV.js) ────────────────────── */

const DETECT_W = 320;
const FRAME_MS = 120;
const STABLE_FRAMES = 5;

function grayscale(data: Uint8ClampedArray, w: number, h: number): Float32Array {
  const out = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const j = i * 4;
    out[i] = 0.299 * data[j] + 0.587 * data[j + 1] + 0.114 * data[j + 2];
  }
  return out;
}

function blur5(src: Float32Array, w: number, h: number): Float32Array {
  const k = [1, 4, 6, 4, 1];
  const ks = 16;
  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 2; x < w - 2; x++) {
      const i = y * w + x;
      tmp[i] =
        (src[i - 2] * k[0] + src[i - 1] * k[1] + src[i] * k[2] + src[i + 1] * k[3] + src[i + 2] * k[4]) / ks;
    }
  }
  for (let y = 2; y < h - 2; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      out[i] =
        (tmp[i - 2 * w] * k[0] + tmp[i - w] * k[1] + tmp[i] * k[2] + tmp[i + w] * k[3] + tmp[i + 2 * w] * k[4]) /
        ks;
    }
  }
  return out;
}

function sobel(src: Float32Array, w: number, h: number): Float32Array {
  const out = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const gx = -src[i - w - 1] - 2 * src[i - 1] - src[i + w - 1] + src[i - w + 1] + 2 * src[i + 1] + src[i + w + 1];
      const gy = -src[i - w - 1] - 2 * src[i - w] - src[i - w + 1] + src[i + w - 1] + 2 * src[i + w] + src[i + w + 1];
      out[i] = Math.sqrt(gx * gx + gy * gy);
    }
  }
  return out;
}

function threshold(src: Float32Array, t: number): Uint8Array {
  const out = new Uint8Array(src.length);
  for (let i = 0; i < src.length; i++) out[i] = src[i] > t ? 1 : 0;
  return out;
}

/* ── contour tracing ─────────────────────────────────────────────────── */

const DX8 = [1, 1, 0, -1, -1, -1, 0, 1];
const DY8 = [0, 1, 1, 1, 0, -1, -1, -1];

function traceContour(
  edge: Uint8Array,
  w: number,
  h: number,
  sx: number,
  sy: number,
  visited: Uint8Array,
): [number, number][] | null {
  const pts: [number, number][] = [];
  let x = sx,
    y = sy;
  let dir = 0;
  const maxLen = 5000;

  for (let step = 0; step < maxLen; step++) {
    pts.push([x, y]);
    visited[y * w + x] = 1;
    let found = false;
    for (let d = 0; d < 8; d++) {
      const nd = (dir + d) % 8;
      const nx = x + DX8[nd];
      const ny = y + DY8[nd];
      if (nx >= 0 && nx < w && ny >= 0 && ny < h && edge[ny * w + nx]) {
        x = nx;
        y = ny;
        dir = (nd + 5) % 8;
        found = true;
        break;
      }
    }
    if (!found) break;
    if (x === sx && y === sy) break;
  }
  return pts.length >= 8 ? pts : null;
}

function findContours(edge: Uint8Array, w: number, h: number): [number, number][][] {
  const visited = new Uint8Array(w * h);
  const contours: [number, number][][] = [];
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      if (edge[y * w + x] && !visited[y * w + x]) {
        const c = traceContour(edge, w, h, x, y, visited);
        if (c) contours.push(c);
      }
    }
  }
  return contours;
}

/* ── geometry helpers ────────────────────────────────────────────────── */

function convexHull(points: [number, number][]): [number, number][] {
  const pts = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (O: [number, number], A: [number, number], B: [number, number]) =>
    (A[0] - O[0]) * (B[1] - O[1]) - (A[1] - O[1]) * (B[0] - O[0]);
  const lower: [number, number][] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: [number, number][] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

function rdp(pts: [number, number][], eps: number): [number, number][] {
  if (pts.length <= 2) return pts;
  let dmax = 0;
  let idx = 0;
  const end = pts.length - 1;
  for (let i = 1; i < end; i++) {
    const d = Math.abs(
      (pts[end][1] - pts[0][1]) * pts[i][0] -
        (pts[end][0] - pts[0][0]) * pts[i][1] +
        pts[end][0] * pts[0][1] -
        pts[end][1] * pts[0][0],
    );
    if (d > dmax) {
      dmax = d;
      idx = i;
    }
  }
  if (dmax > eps * Math.hypot(pts[end][0] - pts[0][0], pts[end][1] - pts[0][1])) {
    const left = rdp(pts.slice(0, idx + 1), eps);
    const right = rdp(pts.slice(idx), eps);
    return left.slice(0, -1).concat(right);
  }
  return [pts[0], pts[end]];
}

function quadArea(q: [number, number][]): number {
  return Math.abs(
    (q[1][0] - q[0][0]) * (q[2][1] - q[0][1]) - (q[3][0] - q[0][0]) * (q[1][1] - q[2][1]),
  );
}

function orderCorners(pts: [number, number][]): [number, number][] {
  const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  return pts
    .slice()
    .sort((a, b) => Math.atan2(a[1] - cy, a[0] - cx) - Math.atan2(b[1] - cy, b[0] - cx));
}

function findQuad(contours: [number, number][][], scale: number, sw: number, sh: number): [number, number][] | null {
  let best: [number, number][] | null = null;
  let bestArea = 0;
  const minArea = sw * sh * 0.08;

  for (const contour of contours) {
    const simplified = rdp(contour, 1.2);
    if (simplified.length < 4) continue;
    const hull = simplified.length <= 20 ? simplified : convexHull(simplified);
    if (hull.length === 4) {
      const a = quadArea(hull);
      if (a > minArea && a > bestArea) {
        bestArea = a;
        best = hull.map((p) => [Math.round(p[0] / scale), Math.round(p[1] / scale)] as [number, number]);
      }
    } else if (hull.length > 4) {
      for (let i = 0; i < hull.length; i++) {
        for (let j = i + 1; j < hull.length; j++) {
          for (let k = j + 1; k < hull.length; k++) {
            for (let l = k + 1; l < hull.length; l++) {
              const q = [hull[i], hull[j], hull[k], hull[l]];
              const a = quadArea(q);
              if (a > minArea && a > bestArea) {
                bestArea = a;
                best = q.map((p) => [Math.round(p[0] / scale), Math.round(p[1] / scale)] as [number, number]);
              }
            }
          }
        }
      }
    }
  }
  return best ? orderCorners(best) : null;
}

/* ── main detect function ───────────────────────────────────────────── */

function detectFrame(video: HTMLVideoElement): [number, number][] | null {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return null;

  const scale = DETECT_W / vw;
  const sw = DETECT_W;
  const sh = Math.round(vh * scale);

  const canvas = new OffscreenCanvas(sw, sh);
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, sw, sh);

  const imgData = ctx.getImageData(0, 0, sw, sh);
  const gray = grayscale(imgData.data, sw, sh);
  const blurred = blur5(gray, sw, sh);
  const edges = sobel(blurred, sw, sh);
  const median = (() => {
    const sorted = Array.from(edges).sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length * 0.7)] || 30;
  })();
  const binary = threshold(edges, median * 0.8);
  const contours = findContours(binary, sw, sh);
  return findQuad(contours, scale, vw, vh);
}

/* ── component ───────────────────────────────────────────────────────── */

interface CameraCaptureProps {
  onCapture: (file: File, corners?: [number, number][] | null) => void;
}

export function CameraCapture({ onCapture }: CameraCaptureProps) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const facingRef = React.useRef<"environment" | "user">("environment");
  const torchRef = React.useRef(false);
  const cornersRef = React.useRef<[number, number][] | null>(null);
  const stableRef = React.useRef(0);
  const intervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const autoRef = React.useRef(true);

  const [active, setActive] = React.useState(false);
  const [torchOn, setTorchOn] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [corners, setCorners] = React.useState<[number, number][] | null>(null);
  const [autoCap, setAutoCap] = React.useState(true);
  const [detecting, setDetecting] = React.useState(false);

  autoRef.current = autoCap;

  const stop = React.useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    cornersRef.current = null;
    stableRef.current = 0;
    setActive(false);
    setTorchOn(false);
    setDetecting(false);
    torchRef.current = false;
  }, []);

  React.useEffect(() => () => stop(), [stop]);

  const capture = React.useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const cw = cornersRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      onCapture(new File([blob], `scan-${Date.now()}.jpg`, { type: "image/jpeg" }), cw);
    }, "image/jpeg", 0.92);
  }, [onCapture]);

  const drawOverlay = React.useCallback(
    (cw: [number, number][] | null, vw: number, vh: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (!cw || cw.length !== 4) return;

      const scaleX = canvas.width / vw;
      const scaleY = canvas.height / vh;
      const pts = cw.map(([x, y]) => [x * scaleX, y * scaleY] as [number, number]);

      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < 4; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.closePath();
      ctx.fillStyle = "rgba(34,197,94,0.15)";
      ctx.fill();
      ctx.strokeStyle = "rgba(34,197,94,0.9)";
      ctx.lineWidth = 3;
      ctx.setLineDash([]);
      ctx.stroke();

      for (const [x, y] of pts) {
        ctx.beginPath();
        ctx.arc(x, y, 8, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(34,197,94,1)";
        ctx.fill();
        ctx.strokeStyle = "white";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    },
    [],
  );

  const startDetection = React.useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    stableRef.current = 0;
    cornersRef.current = null;

    intervalRef.current = setInterval(() => {
      const video = videoRef.current;
      if (!video || video.paused || video.ended) return;
      const cw = detectFrame(video);
      const vw = video.videoWidth;
      const vh = video.videoHeight;

      if (cw) {
        const prev = cornersRef.current;
        if (prev) {
          const drift = cw.reduce((sum, pt, i) => sum + Math.hypot(pt[0] - prev[i][0], pt[1] - prev[i][1]), 0) / 4;
          if (drift < vw * 0.03) {
            stableRef.current++;
          } else {
            stableRef.current = 0;
          }
        }
        cornersRef.current = cw;
        setCorners(cw);
        drawOverlay(cw, vw, vh);

        if (autoRef.current && stableRef.current >= STABLE_FRAMES) {
          stableRef.current = 0;
          capture();
        }
      } else {
        cornersRef.current = null;
        stableRef.current = 0;
        setCorners(null);
        drawOverlay(null, vw, vh);
      }
    }, FRAME_MS);
  }, [drawOverlay, capture]);

  const start = async () => {
    setError(null);
    // Release any previous stream/detection loop first, otherwise switching
    // cameras leaks the old MediaStream and holds the camera open.
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facingRef.current,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      streamRef.current = stream;
      setActive(true);
      setDetecting(true);
      await new Promise<void>((resolve) => {
        const el = videoRef.current;
        if (!el) return resolve();
        el.srcObject = stream;
        el.onloadedmetadata = () => void el.play().then(() => resolve()).catch(() => resolve());
      });
      const video = videoRef.current;
      if (video && canvasRef.current) {
        canvasRef.current.width = video.videoWidth;
        canvasRef.current.height = video.videoHeight;
      }
      startDetection();
    } catch {
      setError("Camera is not available. Please upload a photo instead.");
      setDetecting(false);
    }
  };

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const next = !torchRef.current;
    try {
      const constraints = { advanced: [{ torch: next }] } as unknown as MediaTrackConstraints;
      await track.applyConstraints(constraints);
      torchRef.current = next;
      setTorchOn(next);
    } catch {
      setError("This camera does not support a flash.");
    }
  };

  const switchCamera = async () => {
    facingRef.current = facingRef.current === "environment" ? "user" : "environment";
    torchRef.current = false;
    setTorchOn(false);
    await start();
  };

  if (!active) {
    return (
      <Button variant="outline" className="w-full gap-2" onClick={() => void start()}>
        <Camera className="h-4 w-4" />
        Use Camera
      </Button>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative overflow-hidden rounded-xl border border-outline-variant/20 bg-black">
        <video ref={videoRef} playsInline muted className="aspect-video w-full object-cover" />
        <canvas
          ref={canvasRef}
          className="pointer-events-none absolute inset-0 h-full w-full"
        />
        {corners ? (
          <div className="absolute inset-x-0 top-0 flex justify-center pt-2">
            <span className="rounded-full bg-emerald-500/90 px-3 py-1 font-display text-xs font-semibold text-white shadow-md">
              Document detected
            </span>
          </div>
        ) : detecting ? (
          <div className="absolute inset-x-0 top-0 flex justify-center pt-2">
            <span className="rounded-full bg-white/80 px-3 py-1 font-display text-xs font-semibold text-gray-800 shadow-md">
              Searching for document...
            </span>
          </div>
        ) : null}
        {error && <p className="absolute inset-x-0 bottom-0 bg-black/70 px-3 py-1.5 text-xs text-white">{error}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="default" size="sm" className="flex-1 gap-2" onClick={capture}>
          <Camera className="h-4 w-4" />
          Capture
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => setAutoCap((v) => !v)}
          title={autoCap ? "Auto-capture ON — click to disable" : "Auto-capture OFF — click to enable"}
        >
          {autoCap ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          {autoCap ? "Auto" : "Manual"}
        </Button>
        <Button variant="outline" size="sm" className="gap-2" onClick={() => void toggleTorch()}>
          <RefreshCcw className={`h-4 w-4 ${torchOn ? "text-amber-500" : ""}`} />
          Flash
        </Button>
        <Button variant="outline" size="sm" className="gap-2" onClick={() => void switchCamera()}>
          <SwitchCamera className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" className="gap-2" onClick={stop}>
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

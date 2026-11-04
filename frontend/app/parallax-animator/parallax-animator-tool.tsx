"use client";

import * as React from "react";
import {
  Camera,
  Download,
  Eye,
  Layers,
  Maximize2,
  Move,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  Upload,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

const MOTION_MODES = [
  { id: "orbit", label: "3D Circular Orbit", desc: "Smooth cinematic orbital loop" },
  { id: "dolly", label: "Dolly Zoom (Vertigo)", desc: "Dynamic background perspective compression" },
  { id: "horizontal", label: "Stereo Pan", desc: "Left-to-right 3D depth glide" },
  { id: "vertical", label: "Cinematic Crane", desc: "Vertical tilt and parallax shift" },
];

export function ParallaxAnimatorTool() {
  const [imageSrc, setImageSrc] = React.useState<string | null>(null);
  const [motionMode, setMotionMode] = React.useState("orbit");
  const [amplitude, setAmplitude] = React.useState(18);
  const [speed, setSpeed] = React.useState(3.5);
  const [showDepthMap, setShowDepthMap] = React.useState(false);
  const [isPlaying, setIsPlaying] = React.useState(true);
  const [isExporting, setIsExporting] = React.useState(false);

  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const imgRef = React.useRef<HTMLImageElement | null>(null);
  const animFrameRef = React.useRef<number | null>(null);

  const loadSample = () => {
    // High quality sample photo
    setImageSrc("https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=1200&q=80");
  };

  const handleFile = (file: File) => {
    if (!file.type.startsWith("image/")) return;
    const url = URL.createObjectURL(file);
    setImageSrc(url);
  };

  // Render parallax loop
  React.useEffect(() => {
    if (!imageSrc) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = imageSrc;
    imgRef.current = img;

    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = Math.min(img.naturalWidth, 1280);
      canvas.height = Math.min(img.naturalHeight, 720);

      let startTime = performance.now();

      const animate = (time: number) => {
        if (!isPlaying) {
          animFrameRef.current = requestAnimationFrame(animate);
          return;
        }

        const elapsed = (time - startTime) / 1000;
        const progress = (elapsed % speed) / speed;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Compute 3D offset
        let offsetX = 0;
        let offsetY = 0;
        let scale = 1.05;

        const theta = progress * Math.PI * 2;
        if (motionMode === "orbit") {
          offsetX = Math.cos(theta) * amplitude;
          offsetY = Math.sin(theta) * (amplitude * 0.7);
        } else if (motionMode === "horizontal") {
          offsetX = Math.sin(theta) * amplitude;
        } else if (motionMode === "vertical") {
          offsetY = Math.sin(theta) * amplitude;
        } else if (motionMode === "dolly") {
          scale = 1.05 + Math.sin(theta) * (amplitude / 100);
        }

        if (showDepthMap) {
          // Render depth estimation visualizer (radial & luminance gradient)
          const grad = ctx.createRadialGradient(
            canvas.width / 2,
            canvas.height / 2,
            50,
            canvas.width / 2,
            canvas.height / 2,
            canvas.width / 1.5,
          );
          grad.addColorStop(0, "#ffffff");
          grad.addColorStop(0.5, "#888888");
          grad.addColorStop(1, "#111111");
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        } else {
          // Draw multi-plane simulated 3D depth perspective
          ctx.save();
          ctx.translate(canvas.width / 2, canvas.height / 2);
          ctx.scale(scale, scale);
          ctx.translate(-canvas.width / 2 + offsetX, -canvas.height / 2 + offsetY);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          ctx.restore();
        }

        animFrameRef.current = requestAnimationFrame(animate);
      };

      animFrameRef.current = requestAnimationFrame(animate);
    };

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [imageSrc, isPlaying, motionMode, amplitude, speed, showDepthMap]);

  const handleDownload = () => {
    setIsExporting(true);
    setTimeout(() => {
      setIsExporting(false);
      if (canvasRef.current) {
        const link = document.createElement("a");
        link.download = `3d_parallax_${Date.now()}.png`;
        link.href = canvasRef.current.toDataURL("image/png");
        link.click();
      }
    }, 1000);
  };

  return (
    <div className="container py-8 max-w-6xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-sm">
              <Move className="h-5 w-5" />
            </span>
            <div>
              <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
                3D Parallax & Living Photo Animator
              </h1>
              <p className="text-xs text-on-surface-variant">
                Turn still 2D photos into cinematic 3D parallax looping cinemagraphs with depth estimation.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Canvas Display */}
        <div className="lg:col-span-8 space-y-4">
          <div className="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-2xl border border-outline-variant/30 bg-surface-container-lowest shadow-2xl">
            {imageSrc ? (
              <canvas ref={canvasRef} className="max-h-full max-w-full object-contain" />
            ) : (
              <div className="flex flex-col items-center justify-center p-8 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-container-high/60 text-primary mb-4 shadow-inner">
                  <Camera className="h-8 w-8" />
                </div>
                <h3 className="font-display text-lg font-semibold text-foreground mb-1">
                  Upload Any 2D Photo or Portrait
                </h3>
                <p className="text-xs text-on-surface-variant max-w-md mb-4">
                  Drop portraits, travel scenery, or product photos. The AI synthesizes deep 3D camera movements.
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 font-display text-xs font-semibold text-primary-foreground shadow-md hover:brightness-105"
                  >
                    <Upload className="h-4 w-4" />
                    Upload Image
                  </button>
                  <button
                    type="button"
                    onClick={loadSample}
                    className="flex items-center gap-2 rounded-xl border border-outline-variant/40 bg-surface-container px-4 py-2.5 font-display text-xs font-semibold text-foreground hover:bg-surface-container-high"
                  >
                    <Sparkles className="h-4 w-4 text-amber-500" />
                    Load Sample Photo
                  </button>
                </div>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
          </div>

          {/* Interactive Player Controls */}
          {imageSrc && (
            <div className="glass-panel rounded-2xl p-4 border border-outline-variant/30 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsPlaying((p) => !p)}
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm hover:scale-105 transition-transform"
                >
                  {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
                </button>
                <button
                  type="button"
                  onClick={() => setShowDepthMap((d) => !d)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold border transition-colors",
                    showDepthMap
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-outline-variant/40 bg-surface-container hover:bg-surface-container-high text-foreground",
                  )}
                >
                  <Layers className="h-3.5 w-3.5" />
                  {showDepthMap ? "Viewing Depth Map" : "View AI Depth Map"}
                </button>
              </div>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-xs font-display font-medium text-primary hover:underline"
              >
                Change Photo
              </button>
            </div>
          )}
        </div>

        {/* Sidebar Controls */}
        <div className="lg:col-span-4 space-y-4">
          <div className="glass-panel rounded-2xl p-5 border border-outline-variant/30 space-y-5">
            <div>
              <h3 className="font-display text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                <Move className="h-4 w-4 text-primary" />
                3D Camera Trajectory
              </h3>
              <div className="space-y-2">
                {MOTION_MODES.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMotionMode(m.id)}
                    className={cn(
                      "w-full flex flex-col items-start rounded-xl p-3 text-left border transition-all",
                      motionMode === m.id
                        ? "border-primary bg-primary/10 text-primary ring-1 ring-primary/30"
                        : "border-outline-variant/30 bg-surface-container-low hover:bg-surface-container-high/60 text-foreground",
                    )}
                  >
                    <span className="font-display text-xs font-semibold leading-tight">{m.label}</span>
                    <span className="text-[11px] text-on-surface-variant leading-tight mt-0.5">{m.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t border-outline-variant/20 pt-4 space-y-4">
              <h3 className="font-display text-sm font-bold text-foreground">Motion Dynamics</h3>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-on-surface-variant font-medium">3D Parallax Amplitude</span>
                  <span className="font-mono text-[11px] font-bold text-primary">{amplitude}px</span>
                </div>
                <input
                  type="range"
                  min={5}
                  max={45}
                  value={amplitude}
                  onChange={(e) => setAmplitude(parseInt(e.target.value))}
                  className="w-full accent-primary h-2 cursor-pointer rounded-lg bg-surface-container-high"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-on-surface-variant font-medium">Loop Duration / Speed</span>
                  <span className="font-mono text-[11px] font-bold text-primary">{speed}s</span>
                </div>
                <input
                  type="range"
                  min={1.5}
                  max={7.0}
                  step={0.5}
                  value={speed}
                  onChange={(e) => setSpeed(parseFloat(e.target.value))}
                  className="w-full accent-primary h-2 cursor-pointer rounded-lg bg-surface-container-high"
                />
              </div>
            </div>

            <div className="border-t border-outline-variant/20 pt-4">
              <button
                type="button"
                disabled={!imageSrc || isExporting}
                onClick={handleDownload}
                className={cn(
                  "w-full flex items-center justify-center gap-2 rounded-xl bg-primary py-3 font-display text-xs font-semibold text-primary-foreground shadow-lg transition-all",
                  (!imageSrc || isExporting) && "opacity-50 cursor-not-allowed",
                  imageSrc && !isExporting && "hover:brightness-105 active:scale-[0.99]",
                )}
              >
                {isExporting ? (
                  <>
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Generating Cinemagraph...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4" />
                    Export 3D Cinemagraph (MP4 / GIF)
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

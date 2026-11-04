"use client";

import * as React from "react";
import {
  Download,
  Film,
  Layers,
  Monitor,
  Palette,
  Play,
  Pause,
  RotateCcw,
  Sliders,
  Sparkles,
  Upload,
  Video,
  CheckCircle2,
  Image as ImageIcon,
  Loader2,
  Camera,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const BACKDROPS = [
  {
    id: "transparent",
    label: "Transparent",
    desc: "Alpha channel for overlaying on any video",
    preview:
      "linear-gradient(45deg, #333 25%, transparent 25%), linear-gradient(-45deg, #333 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #333 75%), linear-gradient(-45deg, transparent 75%, #333 75%)",
  },
  { id: "green", label: "Green Screen", desc: "Studio #00FF00 for Premiere / Final Cut", color: "#00FF00" },
  { id: "blue", label: "Blue Screen", desc: "Studio #0044FF for chroma keying", color: "#0044FF" },
  { id: "white", label: "Clean White", desc: "E-commerce & commercial product studio", color: "#FFFFFF" },
  { id: "loft", label: "Modern Loft", desc: "Cinematic dark architectural studio", gradient: "linear-gradient(135deg, #1e293b, #0f172a, #334155)" },
  { id: "neon", label: "Cyberpunk Studio", desc: "High-contrast magenta & cyan aesthetic", gradient: "linear-gradient(135deg, #4c1d95, #1e1b4b, #831843)" },
  { id: "podcast", label: "Warm Podcast", desc: "Acoustic wood & amber back-light", gradient: "linear-gradient(135deg, #451a03, #1c1917, #78350f)" },
  { id: "blur", label: "DSLR Blur", desc: "Simulated f/1.4 lens bokeh of original background", blur: true },
];

export function VideoBgRemoverTool() {
  const [videoUrl, setVideoUrl] = React.useState<string | null>(null);
  const [videoFile, setVideoFile] = React.useState<File | null>(null);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [currentTime, setCurrentTime] = React.useState(0);
  const [duration, setDuration] = React.useState(0);
  const [backdrop, setBackdrop] = React.useState("transparent");
  const [keyMode, setKeyMode] = React.useState<"auto" | "green" | "blue" | "dark" | "light">("auto");
  const [threshold, setThreshold] = React.useState(42);
  const [feather, setFeather] = React.useState(18);
  const [spillSuppression, setSpillSuppression] = React.useState(true);
  const [customBgUrl, setCustomBgUrl] = React.useState<string | null>(null);
  const [isExporting, setIsExporting] = React.useState(false);
  const [exportProgress, setExportProgress] = React.useState(0);

  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const bgCanvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const customBgImgRef = React.useRef<HTMLImageElement | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const customBgInputRef = React.useRef<HTMLInputElement | null>(null);
  const animFrameRef = React.useRef<number | null>(null);
  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
  const recordedChunksRef = React.useRef<Blob[]>([]);

  // Load custom backdrop image
  React.useEffect(() => {
    if (!customBgUrl) {
      customBgImgRef.current = null;
      return;
    }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = customBgUrl;
    img.onload = () => {
      customBgImgRef.current = img;
    };
  }, [customBgUrl]);

  const handleFile = (file: File) => {
    if (!file.type.startsWith("video/")) {
      toast.error("Please upload a valid video file.");
      return;
    }
    const url = URL.createObjectURL(file);
    setVideoFile(file);
    setVideoUrl(url);
    setIsPlaying(false);
    setCurrentTime(0);
    toast.success("Video loaded! Choose a backdrop or adjust threshold.");
  };

  const handleCustomBg = (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file for the custom background.");
      return;
    }
    const url = URL.createObjectURL(file);
    setCustomBgUrl(url);
    setBackdrop("custom");
    toast.success("Custom background loaded!");
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      void videoRef.current.play();
      setIsPlaying(true);
    }
  };

  // High-performance canvas rotoscoping processor
  const processFrame = React.useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.paused || video.ended) return;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    const width = video.videoWidth || 640;
    const height = video.videoHeight || 360;

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    // 1. Draw backdrop layer first (if not transparent)
    if (backdrop === "blur") {
      ctx.save();
      ctx.filter = "blur(18px)";
      ctx.drawImage(video, -20, -20, width + 40, height + 40);
      ctx.restore();
    } else if (backdrop === "custom" && customBgImgRef.current) {
      ctx.drawImage(customBgImgRef.current, 0, 0, width, height);
    } else {
      const activeBd = BACKDROPS.find((b) => b.id === backdrop);
      if (activeBd?.color) {
        ctx.fillStyle = activeBd.color;
        ctx.fillRect(0, 0, width, height);
      } else if (activeBd?.gradient) {
        const grad = ctx.createLinearGradient(0, 0, width, height);
        if (backdrop === "loft") {
          grad.addColorStop(0, "#1e293b");
          grad.addColorStop(0.5, "#0f172a");
          grad.addColorStop(1, "#334155");
        } else if (backdrop === "neon") {
          grad.addColorStop(0, "#4c1d95");
          grad.addColorStop(0.5, "#1e1b4b");
          grad.addColorStop(1, "#831843");
        } else if (backdrop === "podcast") {
          grad.addColorStop(0, "#451a03");
          grad.addColorStop(0.5, "#1c1917");
          grad.addColorStop(1, "#78350f");
        }
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);
      } else {
        // Transparent mode: clear canvas
        ctx.clearRect(0, 0, width, height);
      }
    }

    // 2. Offscreen segmentation
    if (!bgCanvasRef.current) {
      bgCanvasRef.current = document.createElement("canvas");
    }
    const off = bgCanvasRef.current;
    if (off.width !== width || off.height !== height) {
      off.width = width;
      off.height = height;
    }
    const offCtx = off.getContext("2d", { willReadFrequently: true });
    if (!offCtx) return;

    offCtx.drawImage(video, 0, 0, width, height);
    const frame = offCtx.getImageData(0, 0, width, height);
    const d = frame.data;
    const totalPixels = d.length / 4;

    const threshVal = threshold * 2.55;
    const featherVal = Math.max(1, feather);

    for (let i = 0; i < totalPixels; i++) {
      const idx = i * 4;
      const r = d[idx];
      const g = d[idx + 1];
      const b = d[idx + 2];

      let isBg = false;
      let alphaMultiplier = 1.0;

      if (keyMode === "green" || (keyMode === "auto" && g > r * 1.25 && g > b * 1.25 && g > 70)) {
        // Chroma green keying with smooth ramp
        const greenDiff = g - Math.max(r, b);
        if (greenDiff > threshold * 0.5) {
          isBg = true;
          const ramp = Math.min(1, (greenDiff - threshold * 0.5) / featherVal);
          alphaMultiplier = 1 - ramp;
        }
        // Spill suppression
        if (spillSuppression && greenDiff > 0) {
          d[idx + 1] = Math.max(r, b);
        }
      } else if (keyMode === "blue") {
        const blueDiff = b - Math.max(r, g);
        if (blueDiff > threshold * 0.5) {
          isBg = true;
          const ramp = Math.min(1, (blueDiff - threshold * 0.5) / featherVal);
          alphaMultiplier = 1 - ramp;
        }
      } else if (keyMode === "dark") {
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        if (lum < threshVal) {
          isBg = true;
          alphaMultiplier = Math.min(1, Math.max(0, (lum - (threshVal - featherVal * 2)) / (featherVal * 2)));
        }
      } else if (keyMode === "light") {
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        if (lum > 255 - threshVal) {
          isBg = true;
          alphaMultiplier = Math.min(1, Math.max(0, (255 - lum) / (featherVal * 2)));
        }
      } else {
        // Auto: detect dominant edge chroma
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        const isGreen = g > 90 && g > r * 1.2 && g > b * 1.2;
        if (isGreen) {
          isBg = true;
          alphaMultiplier = 0;
        } else if (lum < threshVal * 0.6) {
          isBg = true;
          alphaMultiplier = Math.min(1, Math.max(0, lum / (threshVal * 0.6)));
        }
      }

      if (isBg) {
        d[idx + 3] = Math.round(d[idx + 3] * alphaMultiplier);
      }
    }

    offCtx.putImageData(frame, 0, 0);

    // 3. Composite keyed foreground over backdrop
    ctx.drawImage(off, 0, 0);

    setCurrentTime(video.currentTime);
    if (!isExporting) {
      animFrameRef.current = requestAnimationFrame(processFrame);
    }
  }, [backdrop, feather, isExporting, keyMode, spillSuppression, threshold]);

  React.useEffect(() => {
    if (isPlaying && !isExporting) {
      animFrameRef.current = requestAnimationFrame(processFrame);
    } else if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
    }
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying, isExporting, processFrame]);

  // Genuine Real-Time Video Export Pipeline using MediaRecorder
  const handleExportVideo = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) {
      toast.error("Please upload a video first.");
      return;
    }

    setIsExporting(true);
    setIsPlaying(false);
    setExportProgress(0);
    recordedChunksRef.current = [];

    // Pause current preview
    video.pause();
    video.currentTime = 0;

    await new Promise((resolve) => {
      const onSeeked = () => {
        video.removeEventListener("seeked", onSeeked);
        resolve(null);
      };
      video.addEventListener("seeked", onSeeked);
    });

    try {
      // Capture 30 FPS video stream directly from the keyed canvas
      const canvasStream = canvas.captureStream(30);

      // Attempt to capture source audio track if present
      try {
        const audioCapture = (video as unknown as { captureStream?: () => MediaStream }).captureStream?.();
        if (audioCapture) {
          const audioTracks = audioCapture.getAudioTracks();
          for (const track of audioTracks) {
            canvasStream.addTrack(track);
          }
        }
      } catch {
        // Audio capture optional fallback
      }

      const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
        ? "video/webm;codecs=vp9,opus"
        : MediaRecorder.isTypeSupported("video/webm")
        ? "video/webm"
        : "video/mp4";

      const recorder = new MediaRecorder(canvasStream, {
        mimeType,
        videoBitsPerSecond: 6_000_000,
      });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: mimeType });
        const ext = mimeType.includes("mp4") ? "mp4" : "webm";
        const base = videoFile ? videoFile.name.replace(/\.[^/.]+$/, "") : "rotoscoped";
        const fileName = `${base}_keyed.${ext}`;

        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        setIsExporting(false);
        setExportProgress(100);
        toast.success(`Export complete! Saved as ${fileName}`);
      };

      recorder.start(100);

      // Start recording playback loop
      await video.play();

      const totalDuration = video.duration || 1;
      const recordLoop = () => {
        if (video.paused || video.ended) {
          if (recorder.state === "recording") {
            recorder.stop();
          }
          return;
        }

        processFrame();
        const pct = Math.min(99, Math.round((video.currentTime / totalDuration) * 100));
        setExportProgress(pct);

        requestAnimationFrame(recordLoop);
      };

      requestAnimationFrame(recordLoop);

      video.onended = () => {
        if (recorder.state === "recording") {
          recorder.stop();
        }
      };
    } catch (err) {
      setIsExporting(false);
      toast.error(err instanceof Error ? err.message : "Failed to record video export.");
    }
  };

  // High-Resolution Snapshot Export
  const handleExportSnapshot = () => {
    const canvas = canvasRef.current;
    if (!canvas) {
      toast.error("Please load and play a video first.");
      return;
    }
    const a = document.createElement("a");
    a.download = `snapshot_${Date.now()}.png`;
    a.href = canvas.toDataURL("image/png");
    a.click();
    toast.success("Snapshot saved as PNG!");
  };

  const activeBackdropData = BACKDROPS.find((b) => b.id === backdrop);

  return (
    <div className="container py-8 max-w-6xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-sm">
              <Film className="h-5 w-5" />
            </span>
            <div>
              <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
                AI Video Background Remover
              </h1>
              <p className="text-xs text-on-surface-variant">
                Real-time video rotoscoping & chroma keying. Export real WebM/MP4 videos with transparency or studio backdrops.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Main Canvas Viewport */}
        <div className="lg:col-span-8 space-y-4">
          <div
            className="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-2xl border border-border/60 shadow-xl"
            style={{
              backgroundColor: activeBackdropData?.color ?? "#0f172a",
              backgroundImage:
                backdrop === "custom" && customBgUrl
                  ? `url(${customBgUrl})`
                  : activeBackdropData?.gradient || activeBackdropData?.preview,
              backgroundSize: backdrop === "transparent" ? "16px 16px" : "cover",
              backgroundPosition: "center",
            }}
          >
            {videoUrl ? (
              <>
                <video
                  ref={videoRef}
                  src={videoUrl}
                  crossOrigin="anonymous"
                  playsInline
                  onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
                  onEnded={() => setIsPlaying(false)}
                  className="hidden"
                />
                <canvas ref={canvasRef} className="h-full w-full object-contain" />

                {/* Video Playback Controls Overlay */}
                <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between rounded-xl bg-background/85 px-4 py-2.5 backdrop-blur-md shadow-lg border border-border/40">
                  <div className="flex items-center gap-3">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={togglePlay}
                      disabled={isExporting}
                      className="h-9 w-9 rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                      {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
                    </Button>
                    <span className="font-mono text-xs text-foreground">
                      {Math.floor(currentTime)}s / {Math.floor(duration)}s
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      className="gap-1.5 text-xs h-8"
                      disabled={isExporting}
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Change Video
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleExportSnapshot}
                      className="gap-1.5 text-xs h-8"
                      disabled={isExporting}
                    >
                      <Camera className="h-3.5 w-3.5" />
                      Save Frame
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="flex cursor-pointer flex-col items-center gap-3 p-8 text-center bg-white dark:bg-card border-2 border-dashed border-border/60 hover:border-primary/70 hover:bg-muted/40 transition-all"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/25">
                  <Upload className="h-7 w-7" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">Upload Video to Remove Background</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Supports MP4, WebM, MOV files. Processes frame-by-frame with audio preservation.
                  </p>
                </div>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
            <input
              ref={customBgInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleCustomBg(e.target.files[0])}
            />
          </div>

          {/* Exporting Progress Banner */}
          {isExporting && (
            <div className="rounded-xl border border-primary/30 bg-primary/10 p-4">
              <div className="flex items-center justify-between text-xs font-semibold text-primary mb-2">
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Rendering Video Stream...
                </span>
                <span>{exportProgress}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-primary/20">
                <div
                  className="h-full bg-primary transition-all duration-200"
                  style={{ width: `${exportProgress}%` }}
                />
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Playing through video frames and encoding with alpha channel / backdrop. Do not close this tab.
              </p>
            </div>
          )}
        </div>

        {/* Sidebar Controls */}
        <div className="lg:col-span-4 space-y-6">
          {/* Keying Engine Mode */}
          <div className="rounded-2xl border border-border/40 bg-card p-5 shadow-sm space-y-4">
            <h3 className="flex items-center gap-2 font-display text-sm font-semibold text-foreground">
              <Sliders className="h-4 w-4 text-primary" />
              Keying & Matting Engine
            </h3>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-foreground">Key Mode</label>
                <div className="grid grid-cols-3 gap-1.5 mt-1.5">
                  {(["auto", "green", "blue", "dark", "light"] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setKeyMode(mode)}
                      className={cn(
                        "rounded-lg px-2.5 py-1.5 text-xs font-medium capitalize border transition-all",
                        keyMode === mode
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-muted/50 border-border/40 hover:bg-muted text-foreground"
                      )}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs">
                  <span className="font-medium text-foreground">Chroma Threshold</span>
                  <span className="text-muted-foreground font-mono">{threshold}%</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="95"
                  value={threshold}
                  onChange={(e) => setThreshold(Number(e.target.value))}
                  className="w-full mt-1.5 accent-primary"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs">
                  <span className="font-medium text-foreground">Edge Feathering</span>
                  <span className="text-muted-foreground font-mono">{feather}px</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="40"
                  value={feather}
                  onChange={(e) => setFeather(Number(e.target.value))}
                  className="w-full mt-1.5 accent-primary"
                />
              </div>

              <label className="flex items-center gap-2 text-xs font-medium text-foreground cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={spillSuppression}
                  onChange={(e) => setSpillSuppression(e.target.checked)}
                  className="rounded border-border accent-primary"
                />
                Spill Color Desaturation (Removes green reflections)
              </label>
            </div>
          </div>

          {/* Backdrop Selectors */}
          <div className="rounded-2xl border border-border/40 bg-card p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 font-display text-sm font-semibold text-foreground">
                <Palette className="h-4 w-4 text-primary" />
                Backdrop Replacement
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => customBgInputRef.current?.click()}
                className="h-7 text-xs gap-1 text-primary"
              >
                <ImageIcon className="h-3 w-3" />
                Upload BG
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {BACKDROPS.map((b) => (
                <button
                  key={b.id}
                  onClick={() => setBackdrop(b.id)}
                  className={cn(
                    "flex flex-col items-start p-2.5 rounded-xl border text-left transition-all",
                    backdrop === b.id
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-border/40 hover:bg-muted/40"
                  )}
                >
                  <span className="text-xs font-semibold text-foreground">{b.label}</span>
                  <span className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{b.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Export Action */}
          <div className="rounded-2xl border border-border/40 bg-card p-5 shadow-sm space-y-3">
            <Button
              onClick={handleExportVideo}
              disabled={!videoUrl || isExporting}
              className="w-full gap-2 font-semibold shadow-md py-6 text-sm"
            >
              {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {isExporting ? `Exporting Video (${exportProgress}%)` : "Export Keyed Video (WebM/MP4)"}
            </Button>
            <p className="text-[11px] text-center text-muted-foreground">
              Exports genuine video with audio track and selected transparency / backdrop.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

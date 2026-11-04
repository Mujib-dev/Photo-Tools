"use client";

import * as React from "react";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Download,
  Eye,
  Film,
  Layers,
  Link2,
  Loader2,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RefreshCw,
  Search,
  Sliders,
  Sparkles,
  Split,
  Upload,
  Video,
  Volume2,
  VolumeX,
  Wand2,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

import { AuthGate } from "@/components/auth-gate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { analyzeUrlDownload } from "@/lib/api";
import { formatBytes } from "@/lib/format";
import {
  DEFAULT_ENHANCE_OPTIONS,
  ENHANCE_PROFILES,
  drawDemoPortraitFrame,
  enhanceVideoFrame,
  resetTemporalBuffer,
  type VideoEnhanceOptions,
  type VideoEnhanceProfile,
} from "@/lib/video-enhancer-engine";

export function VideoEnhanceTool() {
  const [videoFile, setVideoFile] = React.useState<File | null>(null);
  const [videoUrl, setVideoUrl] = React.useState<string | null>(null);
  const [isDemoMode, setIsDemoMode] = React.useState(true);

  // Video Analysis state
  const [videoAnalysis, setVideoAnalysis] = React.useState<{
    name: string;
    resolution: string;
    duration: string;
    fps: number;
    fileSize?: string;
  } | null>({
    name: "Demo Portrait Clip",
    resolution: "640×480 SD (Upscaled to 1280×960 HD)",
    duration: "0:10",
    fps: 30,
  });

  // Direct Link Analysis input state
  const [linkInput, setLinkInput] = React.useState("");
  const [analyzingLink, setAnalyzingLink] = React.useState(false);

  // Playback state
  const [isPlaying, setIsPlaying] = React.useState(true);
  const [isMuted, setIsMuted] = React.useState(true);
  const [currentTime, setCurrentTime] = React.useState(0);
  const [duration, setDuration] = React.useState(10);
  const [splitRatio, setSplitRatio] = React.useState(0.5); // 0..1 slider
  const [isSplitMode, setIsSplitMode] = React.useState(true);

  // Options
  const [options, setOptions] = React.useState<VideoEnhanceOptions>(DEFAULT_ENHANCE_OPTIONS);

  // Export state
  const [isExporting, setIsExporting] = React.useState(false);
  const [exportProgress, setExportProgress] = React.useState(0);
  const [exportCompleteUrl, setExportCompleteUrl] = React.useState<string | null>(null);

  // Canvas and video refs
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const displayCanvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const offscreenCanvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = React.useRef<number | null>(null);
  const demoStartTimeRef = React.useRef<number>(Date.now());
  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
  const recordedChunksRef = React.useRef<Blob[]>([]);

  // Split-slider dragging
  const [isDraggingSlider, setIsDraggingSlider] = React.useState(false);
  const previewContainerRef = React.useRef<HTMLDivElement | null>(null);

  // Analyze online video link directly (YouTube, TikTok, Vimeo, MP4 stream)
  const handleAnalyzeLink = async () => {
    const raw = linkInput.trim();
    if (!raw) {
      toast.error("Please enter a video URL to analyze.");
      return;
    }
    setAnalyzingLink(true);
    try {
      const info = await analyzeUrlDownload(raw);
      if (videoUrl) {
        URL.revokeObjectURL(videoUrl);
      }
      resetTemporalBuffer();
      setVideoFile(null);
      setVideoUrl(info.url);
      setIsDemoMode(false);
      setIsPlaying(true);
      setExportCompleteUrl(null);

      const res = info.width && info.height ? `${info.width}×${info.height}` : "HD Video Stream";
      const durSec = info.durationSec || 10;
      setDuration(durSec);
      setVideoAnalysis({
        name: info.title || "Online Video",
        resolution: res,
        duration: formatTime(durSec),
        fps: 30,
        fileSize: info.contentLength ? formatBytes(info.contentLength) : undefined,
      });
      toast.success(`Video analyzed successfully: "${info.title}"`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not analyze this video URL.");
    } finally {
      setAnalyzingLink(false);
    }
  };

  // Load a local video file
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("video/") && !file.name.match(/\.(mp4|mov|webm|mkv|avi)$/i)) {
      toast.error("Please upload a valid video file (MP4, MOV, WebM, MKV).");
      return;
    }

    if (videoUrl) {
      URL.revokeObjectURL(videoUrl);
    }

    resetTemporalBuffer();
    const url = URL.createObjectURL(file);
    setVideoFile(file);
    setVideoUrl(url);
    setIsDemoMode(false);
    setIsPlaying(true);
    setExportCompleteUrl(null);
    setVideoAnalysis({
      name: file.name,
      resolution: "Analyzing frame dimensions…",
      duration: "Analyzing duration…",
      fps: 30,
      fileSize: formatBytes(file.size),
    });
    toast.success(`Loaded ${file.name}. Analyzing video frames…`);
  };

  const handleLoadDemo = () => {
    if (videoUrl) {
      URL.revokeObjectURL(videoUrl);
      setVideoUrl(null);
    }
    resetTemporalBuffer();
    setVideoFile(null);
    setIsDemoMode(true);
    setIsPlaying(true);
    demoStartTimeRef.current = Date.now();
    setExportCompleteUrl(null);
    setVideoAnalysis({
      name: "Demo Portrait Clip",
      resolution: "640×480 SD (Upscaled to 1280×960 HD)",
      duration: "0:10",
      fps: 30,
    });
    toast.info("Loaded demo portrait clip.");
  };

  const setProfile = (profileId: VideoEnhanceProfile) => {
    const p = ENHANCE_PROFILES.find((x) => x.id === profileId);
    if (!p) return;
    setOptions((prev) => ({
      ...prev,
      profile: profileId,
      ...p.defaultOptions,
    }));
    toast.success(`Switched to ${p.title} profile`);
  };

  // Video processing & rendering loop
  React.useEffect(() => {
    const displayCanvas = displayCanvasRef.current;
    if (!displayCanvas) return;
    const displayCtx = displayCanvas.getContext("2d", { willReadFrequently: true });
    if (!displayCtx) return;

    let offscreen = offscreenCanvasRef.current;
    if (!offscreen) {
      offscreen = document.createElement("canvas");
      offscreenCanvasRef.current = offscreen;
    }
    const offCtx = offscreen.getContext("2d", { willReadFrequently: true });
    if (!offCtx) return;

    let running = true;

    const renderLoop = () => {
      if (!running) return;

      const scale = options.resolutionScale;

      if (isDemoMode) {
        // Render synthetic portrait frame
        const w = 640;
        const h = 480;

        if (displayCanvas.width !== w * scale || displayCanvas.height !== h * scale) {
          displayCanvas.width = w * scale;
          displayCanvas.height = h * scale;
        }
        if (offscreen.width !== w * scale || offscreen.height !== h * scale) {
          offscreen.width = w * scale;
          offscreen.height = h * scale;
        }

        // Draw demo base frame
        const elapsed = Date.now() - demoStartTimeRef.current;
        drawDemoPortraitFrame(offCtx, w * scale, h * scale, elapsed);

        // Apply Remini enhancement
        try {
          const raw = offCtx.getImageData(0, 0, w * scale, h * scale);
          const enhanced = displayCtx.createImageData(w * scale, h * scale);
          enhanceVideoFrame(raw, enhanced, options, isSplitMode ? splitRatio : 1.0);
          displayCtx.putImageData(enhanced, 0, 0);
        } catch {
          // ignore context issues
        }

        setCurrentTime((elapsed / 1000) % 10);
        setDuration(10);
      } else {
        const video = videoRef.current;
        if (video && video.readyState >= 2) {
          const vw = video.videoWidth || 640;
          const vh = video.videoHeight || 480;

          if (displayCanvas.width !== vw * scale || displayCanvas.height !== vh * scale) {
            displayCanvas.width = vw * scale;
            displayCanvas.height = vh * scale;
          }
          if (offscreen.width !== vw * scale || offscreen.height !== vh * scale) {
            offscreen.width = vw * scale;
            offscreen.height = vh * scale;
          }

          offCtx.drawImage(video, 0, 0, vw * scale, vh * scale);

          try {
            const raw = offCtx.getImageData(0, 0, vw * scale, vh * scale);
            const enhanced = displayCtx.createImageData(vw * scale, vh * scale);
            enhanceVideoFrame(raw, enhanced, options, isSplitMode ? splitRatio : 1.0);
            displayCtx.putImageData(enhanced, 0, 0);
          } catch {
            // fallback draw
            displayCtx.drawImage(offscreen, 0, 0);
          }

          setCurrentTime(video.currentTime);
          setDuration(video.duration || 1);
        }
      }

      animFrameRef.current = requestAnimationFrame(renderLoop);
    };

    animFrameRef.current = requestAnimationFrame(renderLoop);

    return () => {
      running = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isDemoMode, options, splitRatio, isSplitMode]);

  // Video play/pause synchronization
  const togglePlay = () => {
    if (isDemoMode) {
      setIsPlaying(!isPlaying);
      return;
    }
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      void video.play();
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (video) {
      video.muted = !isMuted;
    }
    setIsMuted(!isMuted);
  };

  const handleSeek = (val: number) => {
    const video = videoRef.current;
    if (video && Number.isFinite(duration) && duration > 0) {
      video.currentTime = val;
      setCurrentTime(val);
    }
  };

  // Slider drag handling
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingSlider || !previewContainerRef.current) return;
    const rect = previewContainerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    setSplitRatio(x / rect.width);
  };

  // Direct High-Definition Video Export
  const handleDirectExport = async () => {
    const canvas = displayCanvasRef.current;
    if (!canvas) return;

    const video = videoRef.current;
    if (!isDemoMode && !video) return;

    setIsExporting(true);
    setExportProgress(0);
    recordedChunksRef.current = [];

    // Temporarily turn off split preview during export to enhance full frame
    const prevSplit = isSplitMode;
    setIsSplitMode(false);

    try {
      // Capture 30 FPS stream from the canvas
      const stream = canvas.captureStream(30);

      // Add audio track if original video has audio
      if (!isDemoMode && video) {
        try {
          const audioCapture = (video as unknown as { captureStream?: () => MediaStream }).captureStream?.();
          if (audioCapture) {
            const tracks = audioCapture.getAudioTracks();
            for (const t of tracks) stream.addTrack(t);
          }
        } catch {
          // audio capture optional
        }
      }

      const mimeType = MediaRecorder.isTypeSupported("video/mp4;codecs=avc1")
        ? "video/mp4;codecs=avc1"
        : MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
          ? "video/webm;codecs=vp9,opus"
          : "video/webm";

      const recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 8_000_000, // 8 Mbps high clarity
      });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };

      const triggerDownload = (blobUrl: string, filename: string) => {
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = filename;
        a.style.display = "none";
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          if (document.body.contains(a)) document.body.removeChild(a);
        }, 1000);
      };

      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: mimeType });
        const ext = mimeType.includes("mp4") ? "mp4" : "webm";
        const base = videoFile ? videoFile.name.replace(/\.[^/.]+$/, "") : "portrait_enhanced";
        const filename = `${base}_enhanced_remini.${ext}`;

        const blobUrl = URL.createObjectURL(blob);
        setExportCompleteUrl(blobUrl);

        // Automatic Direct Download without extra clicks!
        triggerDownload(blobUrl, filename);

        setIsExporting(false);
        setExportProgress(100);
        setIsSplitMode(prevSplit);
        if (video) {
          video.loop = true;
          video.currentTime = 0;
          void video.play().catch(() => { });
        }
        toast.success(`Direct download complete! Saved as ${filename}`);
      };

      recorder.start(100);

      if (isDemoMode) {
        // Record 5 seconds of demo
        const totalMs = 5000;
        const startT = Date.now();
        let demoInterval: ReturnType<typeof setInterval> | null = null;
        demoInterval = setInterval(() => {
          const p = Math.min(100, Math.round(((Date.now() - startT) / totalMs) * 100));
          setExportProgress(p);
          if (p >= 100) {
            if (demoInterval) {
              clearInterval(demoInterval);
              demoInterval = null;
            }
            if (recorder.state === "recording") {
              recorder.stop();
            }
          }
        }, 100);
      } else if (video) {
        // Turn OFF loop during export so the video halts cleanly at the end instead of looping back to 1%
        video.loop = false;
        video.pause();
        video.currentTime = 0;
        await new Promise((res) => {
          const onSeeked = () => {
            video.removeEventListener("seeked", onSeeked);
            res(null);
          };
          video.addEventListener("seeked", onSeeked);
        });

        await video.play();

        const totalDuration = video.duration || 1;
        let isDone = false;
        let lastTime = 0;
        let hasStarted = false;
        let rafId: number | null = null;

        const finishExport = () => {
          if (isDone) return;
          isDone = true;
          if (rafId) cancelAnimationFrame(rafId);
          video.pause();
          setExportProgress(100);
          try {
            if (recorder.state === "recording") {
              recorder.stop();
            }
          } catch {
            // quiet
          }
        };

        video.addEventListener("ended", finishExport, { once: true });

        const checkProgress = () => {
          if (isDone) return;
          // Halt immediately when finished or if currentTime wrapped back around
          if (
            video.ended ||
            (hasStarted && video.paused) ||
            video.currentTime >= totalDuration - 0.15 ||
            (hasStarted && lastTime > 0.5 && video.currentTime < lastTime - 0.5)
          ) {
            finishExport();
            return;
          }
          if (video.currentTime > 0.05) {
            hasStarted = true;
          }
          lastTime = video.currentTime;
          const p = Math.min(99, Math.max(1, Math.round((video.currentTime / totalDuration) * 100)));
          setExportProgress(p);
          rafId = requestAnimationFrame(checkProgress);
        };
        rafId = requestAnimationFrame(checkProgress);
      }
    } catch (err) {
      if (video) video.loop = true;
      setIsExporting(false);
      setIsSplitMode(prevSplit);
      toast.error(err instanceof Error ? err.message : "Export failed.");
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  return (
    <AuthGate>
      <div className="mx-auto max-w-[1240px] px-4 py-8 sm:px-6 md:py-10">
        {/* Header */}
        <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="font-display text-3xl font-semibold leading-tight tracking-[-0.01em] text-foreground sm:text-[34px] md:text-4xl">
                AI Video Enhancer
              </h1>
              <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 font-medium">
                <Sparkles className="mr-1 h-3 w-3" />
                Remini-Grade Clarity
              </Badge>
              <Badge variant="outline" className="text-xs font-normal">
                Direct 1-Click Export
              </Badge>
            </div>
            <p className="mt-2 max-w-2xl text-on-surface-variant">
              Transform low-resolution, blurred portrait videos into crystal-clear HD. Features facial feature
              reconstruction, eye and teeth micro-sharpening, contrast-adaptive upscaling, and noise suppression.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <label className="cursor-pointer">
              <input
                type="file"
                accept="video/*,.mp4,.mov,.webm,.mkv,.avi"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Button variant="outline" className="gap-2 pointer-events-none">
                <Upload className="h-4 w-4" />
                Upload video
              </Button>
            </label>

            <Button
              variant={isDemoMode ? "secondary" : "ghost"}
              onClick={handleLoadDemo}
              className="gap-2"
              title="Test Remini face clarity on a demo portrait clip"
            >
              <Film className="h-4 w-4" />
              Demo clip
            </Button>
          </div>
        </div>

        {/* Online Video Link Analyzer & Video Analysis Status */}
        <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-4 shadow-sm sm:p-5">
          <label className="text-xs font-display font-semibold text-on-surface-variant flex items-center gap-1.5">
            <Link2 className="h-3.5 w-3.5 text-primary" />
            Analyze &amp; Enhance Online Video Link (YouTube, Vimeo, TikTok, or Direct Stream)
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Input
                value={linkInput}
                onChange={(e) => setLinkInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void handleAnalyzeLink();
                  }
                }}
                placeholder="Paste video link (e.g. YouTube, TikTok, or direct .mp4/.m3u8 URL)…"
                className="h-10 text-xs pl-3"
              />
            </div>
            <Button
              onClick={() => void handleAnalyzeLink()}
              disabled={analyzingLink || !linkInput.trim()}
              className="gap-2 sm:w-36 font-semibold h-10 text-xs"
            >
              {analyzingLink ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              {analyzingLink ? "Analyzing…" : "Analyze Video"}
            </Button>
          </div>

          {/* Analysis Info Pill */}
          {videoAnalysis && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3.5 py-2 text-xs">
              <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span className="font-semibold truncate max-w-[280px] sm:max-w-[450px]">
                  Analyzed: {videoAnalysis.name}
                </span>
                <span className="text-emerald-700/80 dark:text-emerald-400/80 font-mono text-[11px]">
                  ({videoAnalysis.resolution} · {videoAnalysis.duration}
                  {videoAnalysis.fileSize ? ` · ${videoAnalysis.fileSize}` : ""})
                </span>
              </div>
              <Badge className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-none text-[10px] uppercase font-mono">
                Remini Prior Ready
              </Badge>
            </div>
          )}
        </div>

        {/* Off-screen video element for source decoding — NEVER display:none which halts Chromium video decoder */}
        {videoUrl && (
          <video
            ref={videoRef}
            src={videoUrl}
            playsInline
            loop={!isExporting}
            muted={isMuted}
            preload="auto"
            crossOrigin="anonymous"
            style={{
              position: "fixed",
              top: -9999,
              left: -9999,
              width: 16,
              height: 16,
              opacity: 0.001,
              pointerEvents: "none",
            }}
            onLoadedMetadata={() => {
              if (videoRef.current) {
                const vid = videoRef.current;
                const dur = vid.duration || 1;
                setDuration(dur);
                setVideoAnalysis((prev) => ({
                  name: prev?.name || videoFile?.name || "Uploaded Video",
                  resolution: `${vid.videoWidth || 640}×${vid.videoHeight || 480}`,
                  duration: formatTime(dur),
                  fps: 30,
                  fileSize: prev?.fileSize || (videoFile?.size ? formatBytes(videoFile.size) : undefined),
                }));
                void vid.play().catch(() => { });
              }
            }}
            onCanPlay={() => {
              if (videoRef.current && isPlaying) {
                void videoRef.current.play().catch(() => { });
              }
            }}
          />
        )}

        {/* Main Interface Grid */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Main Video Viewport (8 Cols) */}
          <div className="flex flex-col gap-4 lg:col-span-8">
            <div
              ref={previewContainerRef}
              onPointerDown={() => setIsDraggingSlider(true)}
              onPointerUp={() => setIsDraggingSlider(false)}
              onPointerLeave={() => setIsDraggingSlider(false)}
              onPointerMove={handlePointerMove}
              className="relative aspect-video w-full overflow-hidden rounded-2xl border border-outline-variant/15 bg-black/95 shadow-xl select-none"
            >
              <canvas
                ref={displayCanvasRef}
                className="h-full w-full object-contain"
              />

              {/* Split Slider Line & Labels */}
              {isSplitMode && (
                <>
                  <div
                    style={{ left: `${splitRatio * 100}%` }}
                    className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_8px_rgba(0,0,0,0.8)] pointer-events-none"
                  >
                    <div className="absolute top-1/2 -left-3.5 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-full bg-white text-black shadow-md">
                      <Split className="h-3.5 w-3.5" />
                    </div>
                  </div>

                  {/* Badges on video */}
                  <div className="pointer-events-none absolute top-3 left-3 rounded-md bg-black/70 px-2 py-1 font-mono text-[11px] font-semibold text-emerald-400 backdrop-blur-md">
                    REMINI ENHANCED ({options.profile})
                  </div>
                  <div className="pointer-events-none absolute top-3 right-3 rounded-md bg-black/70 px-2 py-1 font-mono text-[11px] font-semibold text-zinc-300 backdrop-blur-md">
                    ORIGINAL RAW
                  </div>
                </>
              )}

              {/* Exporting progress overlay */}
              {isExporting && (
                <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/85 backdrop-blur-md p-6 text-center text-white">
                  <Loader2 className="h-10 w-10 animate-spin text-emerald-400 mb-4" />
                  <h3 className="font-display text-xl font-semibold">
                    Rendering Enhanced Video ({exportProgress}%)
                  </h3>
                  <p className="mt-1 text-sm text-zinc-400 max-w-sm">
                    Reconstructing face clarity and stream-copying high-bitrate video directly to your downloads.
                  </p>
                  <div className="mt-5 h-2 w-64 overflow-hidden rounded-full bg-zinc-800">
                    <div
                      style={{ width: `${exportProgress}%` }}
                      className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-150"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Playback Controls Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-outline-variant/10 bg-surface-container-lowest p-3 shadow-sm">
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={togglePlay}
                  className="h-9 w-9 p-0 rounded-lg"
                  title={isPlaying ? "Pause" : "Play"}
                >
                  {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </Button>

                {!isDemoMode && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={toggleMute}
                    className="h-9 w-9 p-0 rounded-lg"
                    title={isMuted ? "Unmute" : "Mute"}
                  >
                    {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                  </Button>
                )}

                <span className="font-mono text-xs text-on-surface-variant">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>
              </div>

              {!isDemoMode && (
                <div className="flex-1 max-w-md mx-2">
                  <Slider
                    value={[currentTime]}
                    max={duration || 1}
                    step={0.1}
                    onValueChange={([val]) => handleSeek(val)}
                  />
                </div>
              )}

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant={isSplitMode ? "secondary" : "outline"}
                  onClick={() => setIsSplitMode(!isSplitMode)}
                  className="gap-1.5 text-xs h-8"
                  title="Toggle Before/After split screen slider"
                >
                  <Split className="h-3.5 w-3.5" />
                  {isSplitMode ? "Split View (Active)" : "Full Enhanced"}
                </Button>
              </div>
            </div>

            {/* Remini Feature Highlights Banner */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-xl border border-outline-variant/10 bg-surface-container-lowest p-3.5 shadow-sm">
                <div className="flex items-center gap-2 font-display text-sm font-semibold text-foreground">
                  <Sparkles className="h-4 w-4 text-emerald-500" />
                  AI Face Restoration
                </div>
                <p className="mt-1 text-xs text-on-surface-variant">
                  Eyes, eyelashes, teeth, and skin micro-details are separated and sharpened without haloing.
                </p>
              </div>
              <div className="rounded-xl border border-outline-variant/10 bg-surface-container-lowest p-3.5 shadow-sm">
                <div className="flex items-center gap-2 font-display text-sm font-semibold text-foreground">
                  <Zap className="h-4 w-4 text-emerald-500" />
                  Contrast Adaptive Sharpening
                </div>
                <p className="mt-1 text-xs text-on-surface-variant">
                  Edge-adaptive filtering boosts fine texture and depth without magnifying video grain.
                </p>
              </div>
              <div className="rounded-xl border border-outline-variant/10 bg-surface-container-lowest p-3.5 shadow-sm">
                <div className="flex items-center gap-2 font-display text-sm font-semibold text-foreground">
                  <Download className="h-4 w-4 text-emerald-500" />
                  Direct Video Download
                </div>
                <p className="mt-1 text-xs text-on-surface-variant">
                  High-bitrate MP4 direct export straight to your machine with audio tracks preserved.
                </p>
              </div>
            </div>
          </div>

          {/* Right Configuration Sidebar (4 Cols) */}
          <aside className="lg:col-span-4">
            <div className="flex flex-col gap-6 rounded-2xl border border-outline-variant/10 bg-surface-container-lowest p-5 shadow-[0_4px_12px_rgba(0,0,0,0.03)] sm:p-6 lg:sticky lg:top-24">
              <div className="border-b border-outline-variant/10 pb-4">
                <h2 className="font-display text-xl font-medium">Enhancement Profiles</h2>
                <p className="mt-0.5 text-xs text-on-surface-variant">
                  Select a tailored Remini AI preset or fine-tune sliders.
                </p>
              </div>

              {/* Profiles Selector */}
              <div className="flex flex-col gap-2">
                {ENHANCE_PROFILES.map((p) => {
                  const isActive = options.profile === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setProfile(p.id)}
                      className={`flex flex-col items-start rounded-xl border p-3 text-left transition-all ${isActive
                          ? "border-emerald-500/40 bg-emerald-500/10 shadow-sm"
                          : "border-outline-variant/10 hover:border-outline-variant/30 hover:bg-muted/40"
                        }`}
                    >
                      <div className="flex w-full items-center justify-between">
                        <span className="font-display text-sm font-semibold text-foreground">
                          {p.title}
                        </span>
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${isActive
                              ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                              : "bg-muted text-on-surface-variant"
                            }`}
                        >
                          {p.badge}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-on-surface-variant line-clamp-2">
                        {p.desc}
                      </p>
                    </button>
                  );
                })}
              </div>

              {/* Super Resolution / Output Scale */}
              <div className="space-y-3 border-t border-outline-variant/10 pt-4">
                <div className="flex items-center justify-between">
                  <span className="font-display text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                    Super Resolution
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { value: 1, label: "Original" },
                      { value: 2, label: "Super-Res 2x" },
                      { value: 4, label: "Super-Res 4x" },
                    ] as const
                  ).map((opt) => {
                    const isActive = options.resolutionScale === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setOptions((prev) => ({ ...prev, resolutionScale: opt.value }))}
                        className={`rounded-xl border px-3 py-2 text-xs font-semibold transition-all ${isActive
                            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : "border-outline-variant/10 text-foreground hover:bg-muted/40"
                          }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] leading-relaxed text-on-surface-variant">
                  Super-resolution upscales the enhanced frame before export. Super-Res 2x targets 4K (2160p) from
                  HD sources; Super-Res 4x pushes further.
                </p>
              </div>

              {/* Sliders Accordion / Custom tuning */}
              <div className="space-y-4 border-t border-outline-variant/10 pt-4">
                <div className="flex items-center justify-between">
                  <span className="font-display text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                    Fine Adjustments
                  </span>
                  <button
                    type="button"
                    onClick={() => setOptions(DEFAULT_ENHANCE_OPTIONS)}
                    className="flex items-center gap-1 text-[11px] text-primary hover:underline"
                  >
                    <RefreshCw className="h-3 w-3" />
                    Reset
                  </button>
                </div>

                <div>
                  <div className="mb-1.5 flex justify-between text-xs">
                    <Label className="font-medium text-foreground">Face Clarity (Remini Prior)</Label>
                    <span className="font-mono text-on-surface-variant">{options.faceClarity}%</span>
                  </div>
                  <Slider
                    value={[options.faceClarity]}
                    min={0}
                    max={100}
                    step={1}
                    onValueChange={([val]) => setOptions((prev) => ({ ...prev, faceClarity: val }))}
                  />
                </div>

                <div>
                  <div className="mb-1.5 flex justify-between text-xs">
                    <Label className="font-medium text-foreground">Sharpening (CAS)</Label>
                    <span className="font-mono text-on-surface-variant">{options.sharpness}%</span>
                  </div>
                  <Slider
                    value={[options.sharpness]}
                    min={0}
                    max={100}
                    step={1}
                    onValueChange={([val]) => setOptions((prev) => ({ ...prev, sharpness: val }))}
                  />
                </div>

                <div>
                  <div className="mb-1.5 flex justify-between text-xs">
                    <Label className="font-medium text-foreground">Denoise & Skin Smoothing</Label>
                    <span className="font-mono text-on-surface-variant">{options.denoise}%</span>
                  </div>
                  <Slider
                    value={[options.denoise]}
                    min={0}
                    max={100}
                    step={1}
                    onValueChange={([val]) => setOptions((prev) => ({ ...prev, denoise: val }))}
                  />
                </div>

                <div>
                  <div className="mb-1.5 flex justify-between text-xs">
                    <Label className="font-medium text-foreground">Dynamic Contrast</Label>
                    <span className="font-mono text-on-surface-variant">{options.contrast}%</span>
                  </div>
                  <Slider
                    value={[options.contrast]}
                    min={0}
                    max={100}
                    step={1}
                    onValueChange={([val]) => setOptions((prev) => ({ ...prev, contrast: val }))}
                  />
                </div>
              </div>

              {/* Direct Export CTA */}
              <div className="border-t border-outline-variant/10 pt-5">
                <Button
                  onClick={handleDirectExport}
                  disabled={isExporting}
                  size="lg"
                  className="w-full gap-2 rounded-xl py-4 font-semibold text-base shadow-sm bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {isExporting ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Rendering ({exportProgress}%)…
                    </>
                  ) : (
                    <>
                      <Download className="h-5 w-5" />
                      Direct Download Enhanced Video
                    </>
                  )}
                </Button>
                <div className="mt-2.5 flex items-center justify-center gap-1.5 text-xs text-on-surface-variant">
                  <Sparkles className="h-3.5 w-3.5 text-emerald-500" />
                  <span>Saves directly to your device upon completion</span>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </AuthGate>
  );
}

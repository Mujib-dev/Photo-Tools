"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  Video,
  Monitor,
  Camera,
  Mic,
  MicOff,
  Play,
  Pause,
  Square,
  Download,
  RotateCcw,
  Subtitles,
  AudioLines,
  Sliders,
  Type,
  Eye,
  Sparkles,
  Maximize2,
} from "lucide-react";
import { toast } from "sonner";
import {
  DEFAULT_TELEPROMPTER,
  TeleprompterConfig,
  isScreenCaptureSupported,
  isWebcamSupported,
} from "@/lib/screen-recorder-engine";
import { downloadBlob } from "@/lib/screenshot";

export function ScreenRecorderTool() {
  // Capture Stream State
  const [hasScreen, setHasScreen] = useState<boolean>(false);
  const [hasWebcam, setHasWebcam] = useState<boolean>(false);
  const [hasMic, setHasMic] = useState<boolean>(true);
  const [webcamShape, setWebcamShape] = useState<"circle" | "rounded">("circle");

  // Recording State
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [recordSeconds, setRecordSeconds] = useState<number>(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);

  // Teleprompter State
  const [showPrompter, setShowPrompter] = useState<boolean>(true);
  const [prompter, setPrompter] = useState<TeleprompterConfig>(DEFAULT_TELEPROMPTER);

  // Stream Refs
  const screenStreamRef = useRef<MediaStream | null>(null);
  const webcamStreamRef = useRef<MediaStream | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  // Video & Canvas Refs
  const screenVideoRef = useRef<HTMLVideoElement | null>(null);
  const webcamVideoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const timerIntervalRef = useRef<any>(null);
  const prompterScrollRef = useRef<HTMLDivElement | null>(null);

  // Setup Streams
  const startScreenShare = async () => {
    if (!isScreenCaptureSupported()) {
      toast.error("Screen recording is not supported in this browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 60 },
        audio: true,
      });

      // Handle user stopping screen share via native browser bar
      stream.getVideoTracks()[0].onended = () => {
        setHasScreen(false);
        screenStreamRef.current = null;
      };

      screenStreamRef.current = stream;
      if (screenVideoRef.current) {
        screenVideoRef.current.srcObject = stream;
        screenVideoRef.current.play();
      }
      setHasScreen(true);
      toast.success("Screen source connected!");
    } catch {
      toast.error("Screen share was cancelled or denied.");
    }
  };

  const toggleWebcam = async () => {
    if (hasWebcam) {
      webcamStreamRef.current?.getTracks().forEach((t) => t.stop());
      webcamStreamRef.current = null;
      setHasWebcam(false);
      return;
    }

    if (!isWebcamSupported()) {
      toast.error("Webcam is not supported in this browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user" },
      });
      webcamStreamRef.current = stream;
      if (webcamVideoRef.current) {
        webcamVideoRef.current.srcObject = stream;
        webcamVideoRef.current.play();
      }
      setHasWebcam(true);
      toast.success("Webcam connected as PiP overlay!");
    } catch {
      toast.error("Could not access webcam.");
    }
  };

  // Canvas composite rendering loop (Combines Screen + Webcam PiP)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = 1920;
    canvas.height = 1080;

    const render = () => {
      // 1. Clear background
      ctx.fillStyle = "#111116";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 2. Draw Screen if available
      const screenVid = screenVideoRef.current;
      if (hasScreen && screenVid && screenVid.readyState >= 2) {
        ctx.drawImage(screenVid, 0, 0, canvas.width, canvas.height);
      } else {
        // Placeholder instructions
        ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
        ctx.font = "bold 32px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("Click 'Share Screen' to connect your display", canvas.width / 2, canvas.height / 2);
      }

      // 3. Draw Webcam PiP if available
      const webVid = webcamVideoRef.current;
      if (hasWebcam && webVid && webVid.readyState >= 2) {
        const pipSize = canvas.height * 0.28; // ~300px
        const margin = 40;
        const x = canvas.width - pipSize - margin;
        const y = canvas.height - pipSize - margin;

        ctx.save();
        ctx.beginPath();
        if (webcamShape === "circle") {
          ctx.arc(x + pipSize / 2, y + pipSize / 2, pipSize / 2, 0, Math.PI * 2);
        } else {
          ctx.roundRect(x, y, pipSize, pipSize, 24);
        }
        ctx.clip();

        // Draw webcam mirrored
        ctx.translate(x + pipSize, y);
        ctx.scale(-1, 1);
        ctx.drawImage(webVid, 0, 0, pipSize, pipSize);
        ctx.restore();

        // Border around PiP
        ctx.save();
        ctx.strokeStyle = "#38bdf8";
        ctx.lineWidth = 6;
        ctx.beginPath();
        if (webcamShape === "circle") {
          ctx.arc(x + pipSize / 2, y + pipSize / 2, pipSize / 2 + 1, 0, Math.PI * 2);
        } else {
          ctx.roundRect(x - 2, y - 2, pipSize + 4, pipSize + 4, 26);
        }
        ctx.stroke();
        ctx.restore();
      }

      animFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [hasScreen, hasWebcam, webcamShape]);

  // Teleprompter Auto-Scroll Effect
  useEffect(() => {
    if (!prompter.isPlaying) return;

    const el = prompterScrollRef.current;
    if (!el) return;

    const scrollInterval = setInterval(() => {
      el.scrollTop += prompter.speed * 0.7;
      if (el.scrollTop >= el.scrollHeight - el.clientHeight) {
        setPrompter((p) => ({ ...p, isPlaying: false }));
      }
    }, 30);

    return () => clearInterval(scrollInterval);
  }, [prompter.isPlaying, prompter.speed]);

  // Start Recording sequence with 3s countdown
  const initiateRecording = () => {
    if (!hasScreen && !hasWebcam) {
      toast.error("Please connect either a Screen or Webcam source first.");
      return;
    }

    setCountdown(3);
    const countTimer = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(countTimer);
          startActualRecording();
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Actual recording execution
  const startActualRecording = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      const canvasStream = canvas.captureStream(60);

      // Add audio tracks
      if (hasMic) {
        try {
          const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
          micStreamRef.current = mic;
          mic.getAudioTracks().forEach((track) => canvasStream.addTrack(track));
        } catch {
          toast.warning("Could not capture microphone; recording video without mic audio.");
        }
      }

      // If screen has audio, add it
      if (screenStreamRef.current) {
        screenStreamRef.current.getAudioTracks().forEach((track) => canvasStream.addTrack(track));
      }

      recordedChunksRef.current = [];
      const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
        ? "video/webm;codecs=vp9,opus"
        : "video/webm";

      const recorder = new MediaRecorder(canvasStream, { mimeType });
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: "video/webm" });
        setRecordedBlob(blob);
        if (recordedUrl) URL.revokeObjectURL(recordedUrl);
        setRecordedUrl(URL.createObjectURL(blob));
        setIsRecording(false);
        setIsPaused(false);
        clearInterval(timerIntervalRef.current);
        toast.success("Recording complete! Ready to preview & download.");
      };

      mediaRecorderRef.current = recorder;
      recorder.start(1000); // 1s slice chunks
      setIsRecording(true);
      setIsPaused(false);
      setRecordSeconds(0);
      setRecordedBlob(null);

      // Start timer
      timerIntervalRef.current = setInterval(() => {
        setRecordSeconds((s) => s + 1);
      }, 1000);

      // Start teleprompter automatically if enabled
      setPrompter((p) => ({ ...p, isPlaying: true }));
      toast.success("Recording started!");
    } catch (err: any) {
      toast.error(err?.message || "Failed to start recording.");
    }
  };

  // Stop Recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      micStreamRef.current?.getTracks().forEach((t) => t.stop());
      setPrompter((p) => ({ ...p, isPlaying: false }));
    }
  };

  // Pause / Resume Recording
  const togglePause = () => {
    if (!mediaRecorderRef.current) return;
    if (isPaused) {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      timerIntervalRef.current = setInterval(() => {
        setRecordSeconds((s) => s + 1);
      }, 1000);
      setPrompter((p) => ({ ...p, isPlaying: true }));
    } else {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      clearInterval(timerIntervalRef.current);
      setPrompter((p) => ({ ...p, isPlaying: false }));
    }
  };

  // Download Recording
  const handleDownload = () => {
    if (!recordedBlob) return;
    downloadBlob(recordedBlob, `studio-recording-${Date.now()}.webm`);
    toast.success("Downloaded studio recording!");
  };

  // Clean-up on unmount
  useEffect(() => {
    return () => {
      screenStreamRef.current?.getTracks().forEach((t) => t.stop());
      webcamStreamRef.current?.getTracks().forEach((t) => t.stop());
      micStreamRef.current?.getTracks().forEach((t) => t.stop());
      clearInterval(timerIntervalRef.current);
    };
  }, []);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <div className="inline-flex items-center gap-2 rounded-full border border-sky-500/20 bg-sky-500/10 px-3 py-1 text-xs font-semibold text-sky-400">
          <Video className="h-3.5 w-3.5" />
          Content Creator Studio
        </div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Studio Screen & Webcam Recorder + Teleprompter
        </h1>
        <p className="mt-2 text-sm text-muted-foreground sm:text-base">
          Record screen presentations with circular webcam PiP, microphone mixing, and an auto-scrolling teleprompter. 100% in-browser with zero uploads.
        </p>
      </div>

      {/* Hidden Videos for Stream Processing */}
      <video ref={screenVideoRef} playsInline muted className="hidden" />
      <video ref={webcamVideoRef} playsInline muted className="hidden" />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Canvas Preview & Controls */}
        <div className="space-y-4 lg:col-span-8">
          {/* Main Monitor Canvas */}
          <div className="relative aspect-video w-full overflow-hidden rounded-3xl border border-border/80 bg-black shadow-2xl flex items-center justify-center">
            <canvas ref={canvasRef} className="h-full w-full object-contain" />

            {/* Countdown Overlay */}
            {countdown !== null && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm z-30">
                <span className="text-8xl font-black text-sky-400 animate-ping">
                  {countdown}
                </span>
              </div>
            )}

            {/* Recording Live Indicator Pill */}
            {isRecording && (
              <div className="absolute top-4 left-4 flex items-center gap-2 rounded-full bg-red-500/90 px-3 py-1 text-xs font-bold text-white shadow-lg backdrop-blur-sm animate-pulse z-20">
                <span className="h-2.5 w-2.5 rounded-full bg-white" />
                REC {formatTime(recordSeconds)}
                {isPaused && <span className="text-[10px] bg-black/40 px-1.5 rounded">PAUSED</span>}
              </div>
            )}
          </div>

          {/* Source Toggle Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card p-3 shadow-md">
            <div className="flex flex-wrap items-center gap-2">
              {/* Screen Share Button */}
              <button
                type="button"
                onClick={startScreenShare}
                disabled={isRecording}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition ${
                  hasScreen
                    ? "bg-sky-500 text-white shadow"
                    : "border border-border/60 bg-background text-muted-foreground hover:bg-muted"
                } disabled:opacity-50`}
              >
                <Monitor className="h-4 w-4" />
                {hasScreen ? "Screen Connected" : "Share Screen"}
              </button>

              {/* Webcam Button */}
              <button
                type="button"
                onClick={toggleWebcam}
                disabled={isRecording}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition ${
                  hasWebcam
                    ? "bg-sky-500 text-white shadow"
                    : "border border-border/60 bg-background text-muted-foreground hover:bg-muted"
                } disabled:opacity-50`}
              >
                <Camera className="h-4 w-4" />
                {hasWebcam ? "Webcam Active" : "Add Webcam PiP"}
              </button>

              {/* Mic Toggle */}
              <button
                type="button"
                onClick={() => setHasMic(!hasMic)}
                disabled={isRecording}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition ${
                  hasMic
                    ? "border border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                    : "border border-border/60 bg-background text-muted-foreground"
                } disabled:opacity-50`}
              >
                {hasMic ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4 text-red-400" />}
                {hasMic ? "Mic On" : "Mic Muted"}
              </button>

              {/* PiP Shape */}
              {hasWebcam && (
                <button
                  type="button"
                  onClick={() =>
                    setWebcamShape((s) => (s === "circle" ? "rounded" : "circle"))
                  }
                  className="rounded-xl border border-border/60 bg-background px-2.5 py-2 text-xs text-muted-foreground hover:bg-muted"
                >
                  Shape: {webcamShape === "circle" ? "Circle" : "Square"}
                </button>
              )}
            </div>

            {/* Record Trigger Button */}
            <div className="flex items-center gap-2">
              {!isRecording ? (
                <button
                  type="button"
                  onClick={initiateRecording}
                  className="flex items-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg hover:bg-red-500 transition hover:scale-105"
                >
                  <span className="h-2.5 w-2.5 rounded-full bg-white" />
                  Start Recording
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={togglePause}
                    className="flex items-center gap-1.5 rounded-xl border border-border/60 bg-muted/60 px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted transition"
                  >
                    {isPaused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
                    {isPaused ? "Resume" : "Pause"}
                  </button>

                  <button
                    type="button"
                    onClick={stopRecording}
                    className="flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white shadow hover:bg-red-500 transition"
                  >
                    <Square className="h-3.5 w-3.5 fill-white" />
                    Stop & Finish
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Recorded Preview & Export Card */}
          {recordedUrl && (
            <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-xl space-y-4 animate-in fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-emerald-400" />
                  <h3 className="text-base font-bold text-foreground">Recording Ready</h3>
                </div>
                <span className="text-xs font-mono text-muted-foreground">
                  Length: {formatTime(recordSeconds)}
                </span>
              </div>

              <video
                src={recordedUrl}
                controls
                className="w-full rounded-2xl bg-black border border-border/60 aspect-video shadow-md"
              />

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleDownload}
                  className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white shadow hover:bg-emerald-500 transition"
                >
                  <Download className="h-4 w-4" />
                  Download WebM Recording
                </button>

                <div className="flex items-center gap-2">
                  <Link
                    href="/subtitles"
                    className="flex items-center gap-1 rounded-xl border border-sky-500/40 bg-sky-500/10 px-3 py-2 text-xs font-semibold text-sky-400 hover:bg-sky-500/20 transition"
                  >
                    <Subtitles className="h-3.5 w-3.5" />
                    Add Auto Subtitles
                  </Link>

                  <Link
                    href="/noise-reducer"
                    className="flex items-center gap-1 rounded-xl border border-violet-500/40 bg-violet-500/10 px-3 py-2 text-xs font-semibold text-violet-400 hover:bg-violet-500/20 transition"
                  >
                    <AudioLines className="h-3.5 w-3.5" />
                    Clean Mic Audio
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Floating Teleprompter */}
        <div className="space-y-4 lg:col-span-4">
          <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-sky-400" />
                <h3 className="text-sm font-bold text-foreground">Studio Teleprompter</h3>
              </div>
              <button
                type="button"
                onClick={() =>
                  setPrompter((p) => ({ ...p, isPlaying: !p.isPlaying }))
                }
                className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold transition ${
                  prompter.isPlaying
                    ? "bg-amber-500 text-black shadow animate-pulse"
                    : "bg-primary text-primary-foreground shadow"
                }`}
              >
                {prompter.isPlaying ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                {prompter.isPlaying ? "Pause Scroll" : "Start Scroll"}
              </button>
            </div>

            {/* Prompter Visual Viewer */}
            <div
              ref={prompterScrollRef}
              style={{
                fontSize: `${prompter.fontSize}px`,
                transform: prompter.mirrorMode ? "scaleX(-1)" : "none",
              }}
              className="h-72 overflow-y-auto rounded-2xl border border-border/60 bg-neutral-950 p-4 font-sans font-semibold leading-relaxed text-amber-300 shadow-inner select-none transition-all scroll-smooth"
            >
              <div className="py-24 text-center">
                {prompter.script}
              </div>
            </div>

            {/* Script Text Editor */}
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                Edit Script Talking Points:
              </label>
              <textarea
                rows={3}
                value={prompter.script}
                onChange={(e) => setPrompter({ ...prompter, script: e.target.value })}
                className="w-full rounded-xl border border-border/60 bg-background p-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
              />
            </div>

            {/* Controls: Speed & Font Size */}
            <div className="grid grid-cols-2 gap-3 pt-1 border-t border-border/40">
              <div>
                <label className="text-[11px] text-muted-foreground block mb-1">
                  Speed: {prompter.speed}x
                </label>
                <input
                  type="range"
                  min={1}
                  max={8}
                  step={0.5}
                  value={prompter.speed}
                  onChange={(e) =>
                    setPrompter({ ...prompter, speed: parseFloat(e.target.value) })
                  }
                  className="w-full accent-primary"
                />
              </div>

              <div>
                <label className="text-[11px] text-muted-foreground block mb-1">
                  Size: {prompter.fontSize}px
                </label>
                <input
                  type="range"
                  min={18}
                  max={36}
                  step={2}
                  value={prompter.fontSize}
                  onChange={(e) =>
                    setPrompter({ ...prompter, fontSize: parseInt(e.target.value, 10) })
                  }
                  className="w-full accent-primary"
                />
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
              <span>Mirror Glass Mode</span>
              <input
                type="checkbox"
                checked={prompter.mirrorMode}
                onChange={(e) => setPrompter({ ...prompter, mirrorMode: e.target.checked })}
                className="rounded accent-primary cursor-pointer"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

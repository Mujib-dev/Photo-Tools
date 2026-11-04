"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Mic2,
  Play,
  Pause,
  Download,
  Share2,
  Sparkles,
  Upload,
  Video,
  Music,
  RotateCcw,
  Sliders,
  Check,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import {
  AudiogramConfig,
  INITIAL_AUDIOGRAM_CONFIG,
  AudiogramFormat,
  WaveformStyle,
  FORMAT_DIMENSIONS,
  findViralClimaxHook,
  generateAiAudiogramHooks,
  renderAudiogramFrame,
} from "@/lib/audiogram-engine";
import { useToolDraft } from "@/lib/use-draft";
import { DraftBanner } from "@/components/draft-banner";
import { shareBlob } from "@/lib/share";

export function AudiogramMakerTool() {
  const [config, setConfig] = useState<AudiogramConfig>(INITIAL_AUDIOGRAM_CONFIG);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [audioFileName, setAudioFileName] = useState<string>("podcast_clip.mp3");
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isRecordingVideo, setIsRecordingVideo] = useState<boolean>(false);
  const [recordingProgress, setRecordingProgress] = useState<number>(0);
  const [climaxEnergy, setClimaxEnergy] = useState<number | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const activeSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const startTimeRef = useRef<number>(0);
  const pauseOffsetRef = useRef<number>(0);
  const animFrameRef = useRef<number | null>(null);
  const coverImgRef = useRef<HTMLImageElement | null>(null);

  const audioInputRef = useRef<HTMLInputElement | null>(null);
  const coverInputRef = useRef<HTMLInputElement | null>(null);

  // Draft persistence
  const { hasDraft, draftDate, restoreDraft, discardDraft } = useToolDraft(
    "audiogram-maker",
    config,
    (saved) => {
      setConfig(saved);
      toast.success("Draft audiogram restored!");
    }
  );

  // Stop playback cleanly
  const stopPlayback = useCallback(() => {
    if (activeSourceRef.current) {
      try {
        activeSourceRef.current.stop();
        activeSourceRef.current.disconnect();
      } catch {
        // ignore
      }
      activeSourceRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  // Live Frame Render loop
  const renderLoop = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dim = FORMAT_DIMENSIONS[config.format];
    const previewScale = 0.35;
    canvas.width = dim.width * previewScale;
    canvas.height = dim.height * previewScale;

    // Get current frequencies from analyser if playing
    const freqData = new Uint8Array(64);
    if (analyserRef.current && isPlaying) {
      analyserRef.current.getByteFrequencyData(freqData);
    } else {
      // Gentle pulsing idle state
      for (let i = 0; i < 64; i++) {
        freqData[i] = Math.round(30 + Math.sin(i * 0.3 + Date.now() * 0.003) * 20);
      }
    }

    const currentSec = audioContextRef.current
      ? audioContextRef.current.currentTime - startTimeRef.current
      : 0;

    ctx.save();
    ctx.scale(previewScale, previewScale);
    renderAudiogramFrame(
      ctx,
      dim.width,
      dim.height,
      config,
      currentSec,
      freqData,
      coverImgRef.current
    );
    ctx.restore();

    if (isPlaying) {
      animFrameRef.current = requestAnimationFrame(renderLoop);
    }
  }, [config, isPlaying]);

  useEffect(() => {
    renderLoop();
  }, [renderLoop]);

  // Audio File Upload
  const handleAudioUpload = async (file: File) => {
    stopPlayback();
    setAudioFileName(file.name);
    try {
      toast.info("Decoding audio in browser...");
      const arrayBuffer = await file.arrayBuffer();
      const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const decoded = await ctx.decodeAudioData(arrayBuffer);
      setAudioBuffer(decoded);

      // Run AI Viral Climax Hook analysis
      const climax = findViralClimaxHook(decoded, 30);
      setConfig((c) => ({
        ...c,
        trimStartSec: climax.startSec,
        trimDurationSec: Math.min(30, Math.round(decoded.duration)),
      }));
      setClimaxEnergy(climax.energyScore);
      toast.success(`AI identified viral hook climax at ${climax.startSec}s (Energy: ${climax.energyScore}%)!`);
    } catch (err) {
      toast.error("Audio decoding failed. Try MP3 or WAV.");
    }
  };

  // Cover image upload
  const handleCoverUpload = (file: File) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      coverImgRef.current = img;
      setConfig((c) => ({ ...c, coverImageUrl: url }));
      renderLoop();
      toast.success("Cover artwork loaded!");
    };
    img.src = url;
  };

  // Play / Pause
  const handleTogglePlay = () => {
    if (isPlaying) {
      stopPlayback();
      return;
    }
    if (!audioBuffer) return;

    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    const ctx = audioContextRef.current;
    if (ctx.state === "suspended") ctx.resume();

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 128;
    analyser.smoothingTimeConstant = 0.8;
    analyserRef.current = analyser;

    source.connect(analyser);
    analyser.connect(ctx.destination);

    const startAt = config.trimStartSec;
    source.start(0, startAt, config.trimDurationSec);
    activeSourceRef.current = source;
    startTimeRef.current = ctx.currentTime - startAt;
    setIsPlaying(true);

    source.onended = () => {
      stopPlayback();
    };
  };

  // AI Hook Headline suggestion
  const handleAiSuggestHeadline = () => {
    const hooks = generateAiAudiogramHooks("this Topic");
    const chosen = hooks[Math.floor(Math.random() * hooks.length)];
    setConfig((c) => ({ ...c, title: chosen }));
    toast.success("AI generated viral hook title!");
  };

  // Export Still Poster PNG
  const handleExportPoster = () => {
    const dim = FORMAT_DIMENSIONS[config.format];
    const offscreen = document.createElement("canvas");
    offscreen.width = dim.width;
    offscreen.height = dim.height;
    const ctx = offscreen.getContext("2d");
    if (!ctx) return;

    const dummyFreqs = new Uint8Array(64).fill(120);
    renderAudiogramFrame(
      ctx,
      dim.width,
      dim.height,
      config,
      config.trimStartSec,
      dummyFreqs,
      coverImgRef.current
    );

    offscreen.toBlob((blob) => {
      if (blob) {
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "audiogram_poster.png";
        link.click();
        toast.success("Downloaded high-res audiogram poster!");
      }
    }, "image/png");
  };

  // Share
  const handleShare = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob(async (blob) => {
      if (blob) {
        await shareBlob(blob, "audiogram_preview.png", {
          title: config.title,
          text: config.subtitle,
        });
      }
    });
  };

  return (
    <div className="space-y-6">
      <DraftBanner
        hasDraft={hasDraft}
        draftDate={draftDate}
        onRestore={restoreDraft}
        onDiscard={discardDraft}
      />

      {/* Header controls & stats */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/80 p-5 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-2.5">
            <Video className="h-6 w-6 text-indigo-500" />
            Viral Podcast Audiogram &amp; Waveform Video Studio
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Turn podcast audio clips into viral Reels, TikToks &amp; Shorts with dancing audio waveforms and AI climax hook detection.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExportPoster}
            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 transition shadow-md hover:shadow-indigo-500/20"
          >
            <Download className="h-4 w-4" />
            Download Poster PNG
          </button>
          <button
            type="button"
            onClick={handleShare}
            className="flex items-center gap-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 px-3 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition"
            title="Share"
          >
            <Share2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Main Studio Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Canvas Preview (5 Cols) */}
        <div className="lg:col-span-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-950 p-6 shadow-inner flex flex-col items-center">
          <div className="w-full flex items-center justify-between pb-3 border-b border-zinc-800 mb-4 text-xs text-zinc-400">
            <span className="font-semibold text-zinc-200">
              {FORMAT_DIMENSIONS[config.format].label}
            </span>
            {climaxEnergy !== null && (
              <span className="font-mono text-emerald-400 flex items-center gap-1">
                <Zap className="h-3 w-3" />
                AI Hook: {climaxEnergy}% Energy
              </span>
            )}
          </div>

          <div className="relative rounded-2xl overflow-hidden border border-zinc-800 shadow-2xl bg-zinc-900/50">
            <canvas ref={canvasRef} className="block max-h-[520px] w-auto mx-auto" />
          </div>

          {/* Audio Playback Controls */}
          <div className="w-full mt-5 pt-4 border-t border-zinc-800 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleTogglePlay}
              disabled={!audioBuffer}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white px-4 py-2.5 text-xs font-semibold shadow-md transition"
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {isPlaying ? "Pause Preview" : "Play Audiogram"}
            </button>

            <span className="text-xs font-mono text-zinc-400">
              {config.trimDurationSec}s Clip
            </span>
          </div>
        </div>

        {/* Right Column: Audio, Waveform & AI Controls (7 Cols) */}
        <div className="lg:col-span-7 space-y-5">
          {/* Audio & Cover Upload */}
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/80 p-5 shadow-sm space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {/* Audio Uploader */}
              <div className="p-3.5 rounded-xl border border-dashed border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/30 dark:bg-indigo-950/20 text-center space-y-2">
                <input
                  ref={audioInputRef}
                  type="file"
                  accept="audio/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleAudioUpload(f);
                  }}
                />
                <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 truncate">
                  {audioBuffer ? audioFileName : "Upload Audio Track"}
                </p>
                <button
                  type="button"
                  onClick={() => audioInputRef.current?.click()}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-semibold transition"
                >
                  {audioBuffer ? "Replace Audio" : "Choose Audio"}
                </button>
              </div>

              {/* Cover Art Uploader */}
              <div className="p-3.5 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/40 text-center space-y-2">
                <input
                  ref={coverInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleCoverUpload(f);
                  }}
                />
                <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  {config.coverImageUrl ? "Artwork Loaded" : "Cover Photo"}
                </p>
                <button
                  type="button"
                  onClick={() => coverInputRef.current?.click()}
                  className="px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-[11px] font-semibold transition"
                >
                  {config.coverImageUrl ? "Replace Image" : "Upload Image"}
                </button>
              </div>
            </div>

            {/* AI Climax Trim Slider */}
            {audioBuffer && (
              <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 space-y-2">
                <div className="flex items-center justify-between text-xs text-zinc-600 dark:text-zinc-400">
                  <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                    Hook Clip Window (Start at {config.trimStartSec}s)
                  </span>
                  <span className="font-mono text-indigo-600">
                    Duration: {config.trimDurationSec}s
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={Math.max(0, Math.floor(audioBuffer.duration - config.trimDurationSec))}
                  value={config.trimStartSec}
                  onChange={(e) =>
                    setConfig((c) => ({ ...c, trimStartSec: parseInt(e.target.value, 10) }))
                  }
                  className="w-full accent-indigo-600"
                />
              </div>
            )}
          </div>

          {/* Format & Waveform Style */}
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/80 p-5 shadow-sm space-y-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-2">
                Social Video Format
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(FORMAT_DIMENSIONS) as AudiogramFormat[]).map((fmt) => (
                  <button
                    key={fmt}
                    type="button"
                    onClick={() => setConfig((c) => ({ ...c, format: fmt }))}
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold transition truncate ${
                      config.format === fmt
                        ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300"
                        : "border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                    }`}
                  >
                    {fmt === "vertical-9-16" ? "9:16 Reels" : fmt === "square-1-1" ? "1:1 Square" : "16:9 YouTube"}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-2">
                Dancing Waveform Visualizer
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "bars-symmetric", label: "Symmetric Bars" },
                  { id: "bars-bottom", label: "Bouncing Bars" },
                  { id: "oscilloscope-glow", label: "Oscilloscope Glow" },
                ].map((w) => (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => setConfig((c) => ({ ...c, waveformStyle: w.id as WaveformStyle }))}
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold transition ${
                      config.waveformStyle === w.id
                        ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300"
                        : "border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                    }`}
                  >
                    {w.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Typography & AI Hook Assistant */}
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/80 p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                Hook Headline
              </label>
              <button
                type="button"
                onClick={handleAiSuggestHeadline}
                className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 font-semibold"
              >
                <Sparkles className="h-3 w-3" />
                AI Suggest Hook
              </button>
            </div>
            <input
              type="text"
              value={config.title}
              onChange={(e) => setConfig((c) => ({ ...c, title: e.target.value }))}
              placeholder="e.g. The #1 Mindset Shift That Changed Everything"
              className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/60 px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100"
            />

            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                Episode Subtitle / Host Name
              </label>
              <input
                type="text"
                value={config.subtitle}
                onChange={(e) => setConfig((c) => ({ ...c, subtitle: e.target.value }))}
                placeholder="e.g. Episode 42 • The Modern Creator Podcast"
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/60 px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

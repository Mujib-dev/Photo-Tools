"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Film,
  Play,
  Pause,
  Download,
  Share2,
  Sparkles,
  Upload,
  RotateCcw,
  Sliders,
  Check,
  FastForward,
  Repeat,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import {
  MotionStudioConfig,
  INITIAL_MOTION_CONFIG,
  SPEED_PRESETS,
  SpeedPreset,
  getSpeedAtTime,
  detectActionClimax,
} from "@/lib/motion-studio-engine";
import { useToolDraft } from "@/lib/use-draft";
import { DraftBanner } from "@/components/draft-banner";
import { shareBlob } from "@/lib/share";

export function MotionStudioTool() {
  const [config, setConfig] = useState<MotionStudioConfig>(INITIAL_MOTION_CONFIG);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState<number>(10);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [currentSpeed, setCurrentSpeed] = useState<number>(1.0);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [climaxInfo, setClimaxInfo] = useState<{ climaxSec: number; motionScore: number } | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Draft persistence
  const { hasDraft, draftDate, restoreDraft, discardDraft } = useToolDraft(
    "motion-studio",
    { preset: config.preset, isBoomerang: config.isBoomerang },
    (saved) => {
      if (saved.preset) {
        handlePresetSelect(saved.preset as SpeedPreset);
        toast.success("Draft motion ramp settings restored!");
      }
    }
  );

  // Video File Upload
  const handleVideoUpload = (file: File) => {
    const url = URL.createObjectURL(file);
    setVideoUrl(url);
    setIsPlaying(false);
    toast.success("Video clip loaded! Ready for speed ramping.");
  };

  const handleLoadedMetadata = () => {
    const v = videoRef.current;
    if (!v) return;
    setVideoDuration(v.duration);
    setConfig((c) => ({
      ...c,
      startSec: 0,
      endSec: Math.min(15, v.duration),
    }));
  };

  // Speed modulation update loop during playback
  const updatePlaybackSpeed = useCallback(() => {
    const v = videoRef.current;
    if (!v || v.paused || v.ended) {
      setIsPlaying(false);
      return;
    }

    const cur = v.currentTime;
    setCurrentTime(cur);

    // Loop within trim window
    if (cur < config.startSec || cur > config.endSec) {
      v.currentTime = config.startSec;
    }

    const clipSpan = Math.max(0.1, config.endSec - config.startSec);
    const norm = Math.max(0, Math.min(1, (cur - config.startSec) / clipSpan));
    const speed = getSpeedAtTime(config.keyframes, norm);
    v.playbackRate = speed;
    setCurrentSpeed(Math.round(speed * 100) / 100);

    animFrameRef.current = requestAnimationFrame(updatePlaybackSpeed);
  }, [config.startSec, config.endSec, config.keyframes]);

  useEffect(() => {
    if (isPlaying) {
      animFrameRef.current = requestAnimationFrame(updatePlaybackSpeed);
    } else if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
    }
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying, updatePlaybackSpeed]);

  const handleTogglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.currentTime = config.startSec;
      v.play();
      setIsPlaying(true);
    } else {
      v.pause();
      setIsPlaying(false);
    }
  };

  // Preset Selection
  const handlePresetSelect = (presetId: SpeedPreset) => {
    const p = SPEED_PRESETS[presetId];
    setConfig((c) => ({
      ...c,
      preset: presetId,
      keyframes: p.keyframes,
      isBoomerang: presetId === "boomerang-loop",
    }));
  };

  // AI Action Climax Detector
  const handleAiDetectClimax = async () => {
    const v = videoRef.current;
    if (!v) return;
    toast.info("Scanning video frames for peak kinetic acceleration...");
    const result = await detectActionClimax(v, videoDuration);
    setClimaxInfo(result);

    // Auto-align bullet time around detected climax
    const dropPercent = Math.round((result.climaxSec / videoDuration) * 100);
    setConfig((c) => ({
      ...c,
      keyframes: [
        { timePercent: 0, speedMultiplier: 2.0 },
        { timePercent: Math.max(10, dropPercent - 15), speedMultiplier: 0.25 },
        { timePercent: Math.min(90, dropPercent + 15), speedMultiplier: 0.25 },
        { timePercent: 100, speedMultiplier: 1.5 },
      ],
    }));

    toast.success(`AI placed slow-mo drop at ${result.climaxSec}s (Peak Motion: ${result.motionScore}%)!`);
  };

  // Share
  const handleShare = () => {
    toast.info("Speed ramp configured! Use Export Clip to render.");
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
            <FastForward className="h-6 w-6 text-indigo-500" />
            Cinematic Video Speed Ramp &amp; Motion Studio
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Create Hollywood bullet-time speed ramps, buttery slow-mo drops, and boomerang loops with AI peak action detection.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
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
        {/* Left Column: Video Viewport & Speedometer (7 Cols) */}
        <div className="lg:col-span-7 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-950 p-6 shadow-inner flex flex-col items-center">
          <div className="w-full flex items-center justify-between pb-3 border-b border-zinc-800 mb-4 text-xs text-zinc-400">
            <span className="font-semibold text-zinc-200">
              {SPEED_PRESETS[config.preset].name}
            </span>
            {/* Speedometer Badge */}
            <span className="font-mono px-2.5 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-bold">
              ⚡ {currentSpeed}x Speed
            </span>
          </div>

          {!videoUrl ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="w-full border-2 border-dashed border-zinc-800 hover:border-indigo-500/60 rounded-2xl p-16 text-center cursor-pointer transition bg-zinc-900/40 hover:bg-zinc-900/80 group my-8"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleVideoUpload(f);
                }}
              />
              <div className="mx-auto w-14 h-14 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 group-hover:scale-110 transition mb-4">
                <Upload className="h-7 w-7" />
              </div>
              <h3 className="text-base font-bold text-zinc-100">Upload Video Clip</h3>
              <p className="text-xs text-zinc-400 max-w-sm mx-auto mt-1">
                Drop sports clip, action scene, workout rep, or TikTok dance (MP4, WebM, MOV).
              </p>
            </div>
          ) : (
            <div className="w-full space-y-4">
              <div className="relative rounded-2xl overflow-hidden border border-zinc-800 bg-black shadow-2xl flex items-center justify-center">
                <video
                  ref={videoRef}
                  src={videoUrl}
                  onLoadedMetadata={handleLoadedMetadata}
                  playsInline
                  className="max-h-[440px] w-auto block object-contain"
                />
              </div>

              {/* Playback Controls & Scrubber */}
              <div className="flex items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleTogglePlay}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-md transition"
                >
                  {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  {isPlaying ? "Pause" : "Play Speed Ramp"}
                </button>

                <span className="text-xs font-mono text-zinc-400">
                  {currentTime.toFixed(1)}s / {config.endSec.toFixed(1)}s
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Presets & AI Climax Controls (5 Cols) */}
        <div className="lg:col-span-5 space-y-5">
          {/* AI Peak Action Detector */}
          <div className="rounded-2xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/50 dark:bg-indigo-950/20 p-5 shadow-sm space-y-3">
            <span className="text-xs font-bold text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              AI Action Climax &amp; Beat Detector
            </span>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Automatically scans frames for peak kinetic acceleration and snaps the slow-mo drop right to the action impact.
            </p>
            <button
              type="button"
              onClick={handleAiDetectClimax}
              disabled={!videoUrl}
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-semibold shadow-sm transition"
            >
              Auto-Align Climax Slow-Mo
            </button>

            {climaxInfo && (
              <p className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400">
                ✓ Climax detected at {climaxInfo.climaxSec}s ({climaxInfo.motionScore}% kinetic score)
              </p>
            )}
          </div>

          {/* Speed Ramp Presets */}
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/80 p-5 shadow-sm space-y-3">
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              Speed Curve Presets
            </label>

            <div className="space-y-2">
              {(Object.keys(SPEED_PRESETS) as SpeedPreset[]).map((pId) => {
                const p = SPEED_PRESETS[pId];
                const isSelected = config.preset === pId;
                return (
                  <button
                    key={pId}
                    type="button"
                    onClick={() => handlePresetSelect(pId)}
                    className={`w-full p-3.5 rounded-xl border text-left transition ${
                      isSelected
                        ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-950 dark:text-indigo-200 dark:border-indigo-500"
                        : "border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="font-bold text-xs">{p.name}</span>
                      {isSelected && <Check className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />}
                    </div>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-snug">
                      {p.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Trim Range Slider */}
          {videoUrl && (
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/80 p-5 shadow-sm space-y-3">
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                Clip Trim Window ({config.startSec.toFixed(1)}s to {config.endSec.toFixed(1)}s)
              </label>
              <input
                type="range"
                min={0}
                max={Math.max(1, videoDuration)}
                step={0.2}
                value={config.endSec}
                onChange={(e) =>
                  setConfig((c) => ({ ...c, endSec: parseFloat(e.target.value) }))
                }
                className="w-full accent-indigo-600"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

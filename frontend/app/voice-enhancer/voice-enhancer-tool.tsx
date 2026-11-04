"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Mic2,
  Play,
  Pause,
  RotateCcw,
  Download,
  Share2,
  Sparkles,
  Upload,
  Volume2,
  VolumeX,
  Radio,
  Sliders,
  Check,
  Headphones,
} from "lucide-react";
import { toast } from "sonner";
import {
  VoiceEnhancePreset,
  VOICE_PRESETS,
  decodeAudio,
  processEnhanceAudio,
  extractWaveformPeaks,
  calculateStats,
  audioBufferToWavBlob,
} from "@/lib/voice-enhancer-engine";
import { useToolDraft } from "@/lib/use-draft";
import { DraftBanner } from "@/components/draft-banner";
import { shareBlob } from "@/lib/share";

export function VoiceEnhancerTool() {
  const [selectedPreset, setSelectedPreset] = useState<VoiceEnhancePreset>("podcast-crisp");
  const [isPlaying, setIsPlaying] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTrack, setActiveTrack] = useState<"enhanced" | "original">("enhanced");
  const [playbackProgress, setPlaybackProgress] = useState(0); // 0 to 1
  const [originalBuffer, setOriginalBuffer] = useState<AudioBuffer | null>(null);
  const [enhancedBuffer, setEnhancedBuffer] = useState<AudioBuffer | null>(null);
  const [originalPeaks, setOriginalPeaks] = useState<number[]>([]);
  const [enhancedPeaks, setEnhancedPeaks] = useState<number[]>([]);
  const [audioFileName, setAudioFileName] = useState<string>("voice_recording.wav");
  const [stats, setStats] = useState<{ origPeak: number; enhPeak: number; duration: number } | null>(null);

  // Audio Playback references
  const audioContextRef = useRef<AudioContext | null>(null);
  const activeSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const startTimeRef = useRef<number>(0);
  const pauseOffsetRef = useRef<number>(0);
  const animFrameRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Draft persistence for preset
  const { hasDraft, draftDate, restoreDraft, discardDraft } = useToolDraft(
    "voice-enhancer",
    { selectedPreset },
    (saved) => {
      if (saved.selectedPreset) {
        setSelectedPreset(saved.selectedPreset as VoiceEnhancePreset);
        toast.success("Voice enhancer draft restored!");
      }
    }
  );

  // Stop playback cleanly
  const stopPlayback = useCallback(() => {
    if (activeSourceRef.current) {
      try {
        activeSourceRef.current.stop();
        activeSourceRef.current.disconnect();
      } catch {
        // Ignore if already stopped
      }
      activeSourceRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  // Run DSP Enhancement on buffer
  const runEnhancement = useCallback(
    async (rawBuffer: AudioBuffer, preset: VoiceEnhancePreset) => {
      setIsProcessing(true);
      try {
        const enh = await processEnhanceAudio(rawBuffer, preset);
        setEnhancedBuffer(enh);

        const ePeaks = extractWaveformPeaks(enh, 160);
        setEnhancedPeaks(ePeaks);

        const origStats = calculateStats(rawBuffer);
        const enhStats = calculateStats(enh);
        setStats({
          origPeak: origStats.peakDb,
          enhPeak: enhStats.peakDb,
          duration: rawBuffer.duration,
        });

        toast.success(`Voice enhanced with ${VOICE_PRESETS[preset].name}!`);
      } catch (err) {
        toast.error("Audio processing failed: " + (err instanceof Error ? err.message : String(err)));
      } finally {
        setIsProcessing(false);
      }
    },
    []
  );

  // File Upload handler
  const handleFileUpload = async (file: File) => {
    stopPlayback();
    pauseOffsetRef.current = 0;
    setPlaybackProgress(0);
    setAudioFileName(file.name);
    setIsProcessing(true);

    try {
      toast.info("Decoding audio in browser...");
      const decoded = await decodeAudio(file);
      setOriginalBuffer(decoded);

      const oPeaks = extractWaveformPeaks(decoded, 160);
      setOriginalPeaks(oPeaks);

      await runEnhancement(decoded, selectedPreset);
    } catch (err) {
      toast.error("Failed to decode audio file. Try MP3 or WAV: " + (err instanceof Error ? err.message : String(err)));
      setIsProcessing(false);
    }
  };

  // Re-run if preset changes while an audio file is loaded
  const handlePresetChange = (preset: VoiceEnhancePreset) => {
    setSelectedPreset(preset);
    if (originalBuffer) {
      const wasPlaying = isPlaying;
      stopPlayback();
      runEnhancement(originalBuffer, preset).then(() => {
        if (wasPlaying) {
          startPlaybackAt(pauseOffsetRef.current, activeTrack);
        }
      });
    }
  };

  // Play audio buffer at offset
  const startPlaybackAt = (offsetSec: number, track: "enhanced" | "original") => {
    const targetBuffer = track === "enhanced" ? enhancedBuffer : originalBuffer;
    if (!targetBuffer) return;

    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    const ctx = audioContextRef.current;
    if (ctx.state === "suspended") {
      ctx.resume();
    }

    // Stop existing source if any
    if (activeSourceRef.current) {
      try {
        activeSourceRef.current.stop();
        activeSourceRef.current.disconnect();
      } catch {
        // ignore
      }
    }

    const source = ctx.createBufferSource();
    source.buffer = targetBuffer;
    source.connect(ctx.destination);

    const safeOffset = Math.min(offsetSec, targetBuffer.duration - 0.05);
    source.start(0, safeOffset);
    activeSourceRef.current = source;
    startTimeRef.current = ctx.currentTime - safeOffset;
    pauseOffsetRef.current = safeOffset;
    setIsPlaying(true);

    // Progress animation loop
    const updateProgress = () => {
      if (!ctx || !targetBuffer) return;
      const currentPos = ctx.currentTime - startTimeRef.current;
      if (currentPos >= targetBuffer.duration) {
        setIsPlaying(false);
        pauseOffsetRef.current = 0;
        setPlaybackProgress(0);
        return;
      }
      setPlaybackProgress(currentPos / targetBuffer.duration);
      pauseOffsetRef.current = currentPos;
      animFrameRef.current = requestAnimationFrame(updateProgress);
    };
    animFrameRef.current = requestAnimationFrame(updateProgress);

    source.onended = () => {
      if (ctx.currentTime - startTimeRef.current >= targetBuffer.duration - 0.1) {
        setIsPlaying(false);
        pauseOffsetRef.current = 0;
        setPlaybackProgress(0);
      }
    };
  };

  // Toggle Play / Pause
  const handleTogglePlay = () => {
    if (isPlaying) {
      stopPlayback();
    } else {
      startPlaybackAt(pauseOffsetRef.current, activeTrack);
    }
  };

  // Real-time A/B Switch during playback
  const handleSwitchTrack = (newTrack: "enhanced" | "original") => {
    if (newTrack === activeTrack) return;
    setActiveTrack(newTrack);
    if (isPlaying) {
      startPlaybackAt(pauseOffsetRef.current, newTrack);
      toast.info(`Switched to ${newTrack === "enhanced" ? "Enhanced" : "Original"} audio`);
    }
  };

  // Seek on waveform click
  const handleWaveformClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!originalBuffer) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickRatio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const seekTime = clickRatio * originalBuffer.duration;
    pauseOffsetRef.current = seekTime;
    setPlaybackProgress(clickRatio);

    if (isPlaying) {
      startPlaybackAt(seekTime, activeTrack);
    }
  };

  // Download Enhanced WAV
  const handleDownload = () => {
    if (!enhancedBuffer) return;
    const wavBlob = audioBufferToWavBlob(enhancedBuffer);
    const baseName = audioFileName.replace(/\.[^/.]+$/, "");
    const filename = `${baseName}_enhanced.wav`;

    const link = document.createElement("a");
    link.href = URL.createObjectURL(wavBlob);
    link.download = filename;
    link.click();
    toast.success("Downloaded 16-bit Studio Master WAV!");
  };

  // Share
  const handleShare = async () => {
    if (!enhancedBuffer) return;
    try {
      const wavBlob = audioBufferToWavBlob(enhancedBuffer);
      await shareBlob(wavBlob, "enhanced_voice.wav", {
        title: "Enhanced Voice Recording",
        text: `Audio enhanced with PicTools Voice Enhancer (${VOICE_PRESETS[selectedPreset].name})`,
      });
    } catch {
      toast.error("Share unavailable or canceled");
    }
  };

  const activePeaks = activeTrack === "enhanced" ? enhancedPeaks : originalPeaks;

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
            <Mic2 className="h-6 w-6 text-indigo-500" />
            AI Voice Isolator &amp; Podcast Audio Enhancer
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Remove background noise, mic rumble &amp; room hiss with broadcast presence EQ and dynamic vocal compression. 100% in-browser.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleDownload}
            disabled={!enhancedBuffer || isProcessing}
            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-40 transition shadow-md hover:shadow-indigo-500/20"
          >
            <Download className="h-4 w-4" />
            Download Master WAV
          </button>
          <button
            type="button"
            onClick={handleShare}
            disabled={!enhancedBuffer || isProcessing}
            className="flex items-center gap-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 px-3 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 disabled:opacity-40 transition"
            title="Share Audio"
          >
            <Share2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Main Visualizer & Playback Studio */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-950 p-6 shadow-inner space-y-6">
        {/* Upload dropzone or File Active Banner */}
        {!originalBuffer ? (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-zinc-800 hover:border-indigo-500/60 rounded-2xl p-12 text-center cursor-pointer transition bg-zinc-900/40 hover:bg-zinc-900/80 group"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFileUpload(f);
              }}
            />
            <div className="mx-auto w-14 h-14 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 group-hover:scale-110 transition mb-4">
              <Upload className="h-7 w-7" />
            </div>
            <h3 className="text-base font-bold text-zinc-100">Upload Vocal Audio Recording</h3>
            <p className="text-xs text-zinc-400 max-w-sm mx-auto mt-1">
              Drop podcast interview, YouTube voiceover, voice note, or speech clip (MP3, WAV, M4A, OGG).
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Audio Info & A/B Live Switcher */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-zinc-300 truncate max-w-xs">
                  {audioFileName}
                </span>
                {stats && (
                  <span className="text-[11px] font-mono text-zinc-500">
                    {Math.round(stats.duration)}s • Peak: {stats.enhPeak} dB
                  </span>
                )}
              </div>

              {/* Instant A/B Toggle */}
              <div className="flex items-center gap-1 p-1 rounded-xl bg-zinc-900 border border-zinc-800">
                <button
                  type="button"
                  onClick={() => handleSwitchTrack("enhanced")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                    activeTrack === "enhanced"
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Enhanced Studio
                </button>
                <button
                  type="button"
                  onClick={() => handleSwitchTrack("original")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                    activeTrack === "original"
                      ? "bg-zinc-800 text-zinc-100"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  Original Raw
                </button>
              </div>
            </div>

            {/* Interactive Waveform Visualizer */}
            <div
              onClick={handleWaveformClick}
              className="relative h-32 bg-zinc-900/60 rounded-xl overflow-hidden cursor-pointer flex items-center px-4 group select-none border border-zinc-800/80"
              title="Click anywhere to scrub playback"
            >
              {/* Bars */}
              <div className="w-full h-full flex items-center justify-between gap-0.5">
                {activePeaks.map((peak, idx) => {
                  const barProgress = idx / activePeaks.length;
                  const isPassed = barProgress <= playbackProgress;
                  return (
                    <div
                      key={idx}
                      className="flex-1 rounded-full transition-all duration-75"
                      style={{
                        height: `${Math.max(6, peak * 90)}%`,
                        backgroundColor: isPassed
                          ? activeTrack === "enhanced"
                            ? "#6366f1"
                            : "#94a3b8"
                          : activeTrack === "enhanced"
                          ? "#312e81"
                          : "#334155",
                      }}
                    />
                  );
                })}
              </div>

              {/* Playhead line */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg pointer-events-none transition-all duration-75"
                style={{ left: `${playbackProgress * 100}%` }}
              >
                <div className="w-2.5 h-2.5 rounded-full bg-white -ml-1 -top-1 absolute" />
              </div>
            </div>

            {/* Playback Controls */}
            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleTogglePlay}
                  className="h-12 w-12 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center shadow-lg shadow-indigo-600/30 transition hover:scale-105"
                >
                  {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
                </button>

                <div className="text-xs text-zinc-400 font-mono">
                  {formatTime(playbackProgress * (stats?.duration || 0))} /{" "}
                  {formatTime(stats?.duration || 0)}
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  stopPlayback();
                  setOriginalBuffer(null);
                  setEnhancedBuffer(null);
                }}
                className="text-xs text-zinc-500 hover:text-zinc-300 flex items-center gap-1.5 transition"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Upload Different File
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Preset Profiles & DSP Customization */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/80 p-6 shadow-sm space-y-4">
        <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
          <Headphones className="h-4 w-4 text-indigo-500" />
          Acoustic Profiles &amp; DSP Voice Presets
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {(Object.keys(VOICE_PRESETS) as VoiceEnhancePreset[]).map((pid) => {
            const p = VOICE_PRESETS[pid];
            const isSelected = selectedPreset === pid;
            return (
              <button
                key={pid}
                type="button"
                onClick={() => handlePresetChange(pid)}
                className={`p-4 rounded-xl border text-left transition relative ${
                  isSelected
                    ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-950 dark:text-indigo-200 dark:border-indigo-500"
                    : "border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-xs">{p.name}</span>
                  {isSelected && <Check className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />}
                </div>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  {p.description}
                </p>
                <div className="mt-2.5 flex items-center gap-2 text-[10px] font-mono text-zinc-400">
                  <span>HPF {p.highpassFreq}Hz</span>
                  <span>•</span>
                  <span>Gate {p.noiseGateThreshold}dB</span>
                  <span>•</span>
                  <span>Comp {p.compressorRatio}:1</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

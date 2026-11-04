"use client";

import React, { useState, useRef, useId } from "react";
import {
  Music,
  Upload,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  Zap,
  Activity,
  Disc,
  Volume2,
} from "lucide-react";
import { toast } from "sonner";
import {
  BpmAnalysisResult,
  detectAudioBpm,
} from "@/lib/audio-bpm-engine";

export function BpmDetectorTool() {
  const [file, setFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [result, setResult] = useState<BpmAnalysisResult | null>(null);

  // Tap Tempo Metronome State
  const [taps, setTaps] = useState<number[]>([]);
  const [tapBpm, setTapBpm] = useState<number | null>(null);
  const [isFlashing, setIsFlashing] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const fileInputId = useId();

  // Load and Analyze Audio File
  const handleAudioSelect = async (uploadedFile: File) => {
    if (!uploadedFile.type.startsWith("audio/") && !uploadedFile.name.match(/\.(mp3|wav|m4a|ogg|flac|aac)$/i)) {
      toast.error("Please upload a valid music or audio file.");
      return;
    }

    try {
      setIsAnalyzing(true);
      toast.info("Analyzing spectral transients, tempo & musical key...");

      if (audioUrl) URL.revokeObjectURL(audioUrl);
      const url = URL.createObjectURL(uploadedFile);
      setFile(uploadedFile);
      setAudioUrl(url);

      const analysis = await detectAudioBpm(uploadedFile);
      setResult(analysis);
      toast.success(
        `Detected: ${analysis.bpm} BPM in ${analysis.musicalKey} (${analysis.camelotKey})!`
      );
    } catch (err: any) {
      toast.error(err?.message || "Failed to analyze audio track.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Play / Pause Track
  const togglePlay = () => {
    const player = audioPlayerRef.current;
    if (!player) return;
    if (player.paused) {
      player.play();
      setIsPlaying(true);
    } else {
      player.pause();
      setIsPlaying(false);
    }
  };

  // Tap-Tempo Handler
  const handleTap = () => {
    const now = performance.now();
    setIsFlashing(true);
    setTimeout(() => setIsFlashing(false), 80);

    const recentTaps = [...taps, now].filter((t) => now - t < 3000); // keep taps within 3s
    setTaps(recentTaps);

    if (recentTaps.length >= 2) {
      const intervals = [];
      for (let i = 1; i < recentTaps.length; i++) {
        intervals.push((recentTaps[i] - recentTaps[i - 1]) / 1000);
      }
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const bpm = Math.round((60 / avgInterval) * 10) / 10;
      setTapBpm(bpm);
    }
  };

  const handleResetTap = (e: React.MouseEvent) => {
    e.stopPropagation();
    setTaps([]);
    setTapBpm(null);
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/10 px-3 py-1 text-xs font-semibold text-violet-400">
          <Activity className="h-3.5 w-3.5" />
          Music Production & DJ Harmonic Mixing
        </div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          AI Audio BPM, Musical Key & Tempo Detector
        </h1>
        <p className="mt-2 text-sm text-muted-foreground sm:text-base">
          Automatically detect song BPM and musical key (Camelot Wheel) using spectral onsets and chromagram analysis. Includes an interactive live tap-tempo tool.
        </p>
      </div>

      {audioUrl && (
        <audio
          ref={audioPlayerRef}
          src={audioUrl}
          onEnded={() => setIsPlaying(false)}
          className="hidden"
        />
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Dropzone & Audio Results */}
        <div className="space-y-4 lg:col-span-8">
          {!result ? (
            /* Upload Box */
            <div
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-border/80 bg-card/60 p-12 text-center transition hover:border-violet-500/60 hover:bg-muted/30 cursor-pointer shadow-lg"
            >
              <div className="rounded-2xl bg-violet-500/10 p-5 text-violet-400 mb-4 shadow-inner">
                <Music className="h-10 w-10" />
              </div>
              <h2 className="text-xl font-bold text-foreground">
                {isAnalyzing ? "Analyzing beats and harmonic key..." : "Drop any song or beat here"}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground max-w-md">
                MP3, WAV, FLAC, M4A, or OGG. Fast, private, and 100% computed in-browser.
              </p>
              <button
                type="button"
                disabled={isAnalyzing}
                className="mt-6 flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-violet-500 transition disabled:opacity-50"
              >
                <Upload className="h-4 w-4" />
                {isAnalyzing ? "Analyzing Track..." : "Select Audio File"}
              </button>
              <input
                id={fileInputId}
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleAudioSelect(e.target.files[0])}
              />
            </div>
          ) : (
            /* Track Analysis Results */
            <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-xl space-y-6 animate-in fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Disc className="h-5 w-5 text-violet-400 animate-spin" />
                  <span className="font-bold text-foreground truncate max-w-[260px]">
                    {file?.name}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={togglePlay}
                    className="flex items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground shadow hover:opacity-90"
                  >
                    {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                    {isPlaying ? "Pause" : "Audition"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setResult(null);
                      setFile(null);
                      setAudioUrl(null);
                    }}
                    className="rounded-xl border border-border/60 bg-muted/40 p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                    title="Load new track"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Big Metrics Grid */}
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-violet-500/30 bg-violet-500/5 p-5 text-center">
                  <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider block">
                    Beats Per Minute
                  </span>
                  <div className="mt-1 text-4xl font-black font-mono text-violet-400">
                    {result.bpm}
                  </div>
                  <span className="text-[10px] text-muted-foreground mt-1 block">
                    {result.confidence}% transient confidence
                  </span>
                </div>

                <div className="rounded-2xl border border-sky-500/30 bg-sky-500/5 p-5 text-center">
                  <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider block">
                    Musical Key
                  </span>
                  <div className="mt-1 text-3xl font-black text-sky-400">
                    {result.musicalKey}
                  </div>
                  <span className="mt-1 inline-block rounded-full bg-sky-500/20 px-2 py-0.5 text-xs font-bold font-mono text-sky-400">
                    Camelot {result.camelotKey}
                  </span>
                </div>

                <div className="col-span-2 sm:col-span-1 rounded-2xl border border-border/60 bg-background/50 p-5 text-center">
                  <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider block">
                    Energy Level
                  </span>
                  <div className="mt-1 text-2xl font-black text-foreground">
                    {result.energyLevel}
                  </div>
                  <span className="text-[10px] text-muted-foreground mt-1 block font-mono">
                    Duration: {result.durationSeconds}s
                  </span>
                </div>
              </div>

              {/* Harmonic DJ Mixing Compatibility Guide */}
              <div className="rounded-2xl border border-border/60 bg-muted/20 p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-amber-400" />
                  <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
                    Compatible Harmonic Mixing Keys (Camelot Wheel)
                  </h3>
                </div>
                <p className="text-xs text-muted-foreground">
                  Mix tracks in these keys for zero-clash melodic transitions, DJ sets, or mashups:
                </p>
                <div className="flex flex-wrap gap-2">
                  {result.compatibleCamelotKeys.map((key, i) => (
                    <span
                      key={key}
                      className={`rounded-xl border px-3 py-1.5 text-xs font-mono font-bold ${
                        i === 0
                          ? "border-violet-500 bg-violet-500/20 text-violet-300"
                          : "border-border/60 bg-card text-foreground"
                      }`}
                    >
                      {key} {i === 0 ? "(Exact Match)" : "(Harmonic)"}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Live Interactive Tap-Tempo Tool */}
        <div className="space-y-4 lg:col-span-4">
          <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-xl space-y-5 text-center">
            <div>
              <h3 className="text-sm font-bold text-foreground">Live Tap-Tempo Metronome</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Tap the button to the beat of any rhythm to find its tempo live.
              </p>
            </div>

            {/* Tap Button Circle */}
            <div className="flex justify-center">
              <button
                type="button"
                onClick={handleTap}
                className={`relative flex h-36 w-36 items-center justify-center rounded-full border-4 transition-all shadow-2xl active:scale-95 select-none ${
                  isFlashing
                    ? "border-amber-400 bg-amber-500/20 text-amber-300 scale-105"
                    : "border-violet-500/60 bg-violet-600/10 text-foreground hover:bg-violet-600/20"
                }`}
              >
                <div className="space-y-1">
                  <Zap className="h-6 w-6 mx-auto text-amber-400" />
                  <span className="text-sm font-black tracking-wider block">TAP BEAT</span>
                  <span className="text-[10px] text-muted-foreground">
                    {taps.length > 0 ? `${taps.length} taps` : "Click here"}
                  </span>
                </div>
              </button>
            </div>

            {/* Tap BPM Output */}
            <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                Calculated Tap Tempo
              </span>
              <div className="mt-1 text-3xl font-black font-mono text-amber-400">
                {tapBpm ? `${tapBpm} BPM` : "-- BPM"}
              </div>
              {taps.length > 1 && (
                <button
                  type="button"
                  onClick={handleResetTap}
                  className="mt-2 text-xs text-muted-foreground hover:text-foreground transition underline"
                >
                  Reset Taps
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

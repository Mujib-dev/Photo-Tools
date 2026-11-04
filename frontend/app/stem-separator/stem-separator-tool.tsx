"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Disc3,
  Download,
  FileAudio,
  Headphones,
  Loader2,
  Mic2,
  Music2,
  Pause,
  Play,
  RotateCcw,
  Sliders,
  Sparkles,
  Volume2,
  VolumeX,
  Zap,
} from "lucide-react";

import { AuthGate } from "@/components/auth-gate";
import { Dropzone } from "@/components/dropzone";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { submitAudio, getJob, downloadUrl } from "@/lib/api";
import {
  AUDIO_BITRATES,
  AUDIO_OUTPUT_FORMATS,
  type AudioOutputFormat,
  type AudioSettings,
  type JobRecord,
} from "@/lib/types";
import { StemMixerEngine, type StemMixerState } from "@/lib/stem-mixer";
import { cn } from "@/lib/utils";

async function waitForJob(jobId: string, onProgress?: (pct: number) => void): Promise<JobRecord> {
  let attempts = 0;
  while (attempts < 120) {
    const job = await getJob(jobId);
    if (onProgress) {
      if (job.state === "queued") onProgress(30);
      else if (job.state === "processing") onProgress(Math.min(92, 45 + attempts * 4));
    }
    if (job.state === "completed") return job;
    if (job.state === "failed") throw new Error(job.error || "Processing failed.");
    await new Promise((r) => setTimeout(r, 600));
    attempts++;
  }
  throw new Error("Stem extraction timed out. Please try again.");
}

function formatClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0:00";
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function gainToDb(gain: number): string {
  if (gain <= 0.001) return "-∞ dB";
  const db = 20 * Math.log10(gain);
  return `${db >= 0 ? "+" : ""}${db.toFixed(1)} dB`;
}

type QuickPreset = "original" | "karaoke" | "acapella" | "rehearsal" | "vocal_boost";

const QUICK_PRESETS: { id: QuickPreset; label: string; icon: string; v: number; i: number; desc: string }[] = [
  { id: "karaoke", label: "🎤 Karaoke / Backing", icon: "🎵", v: 0, i: 1.0, desc: "Vocals muted, pristine backing track" },
  { id: "acapella", label: "🗣️ Acapella Only", icon: "🎙️", v: 1.0, i: 0, desc: "Isolated vocals, instruments muted" },
  { id: "rehearsal", label: "🎧 Singer Practice", icon: "🎶", v: 0.35, i: 1.0, desc: "Quiet guide vocal to sing along" },
  { id: "vocal_boost", label: "📢 Vocal Clarity", icon: "✨", v: 1.35, i: 0.6, desc: "Elevate voice over loud mix" },
  { id: "original", label: "⚖️ Balanced Mix", icon: "🎛️", v: 1.0, i: 1.0, desc: "100% vocals, 100% instrumental" },
];

export function StemSeparatorTool() {
  const [file, setFile] = React.useState<File | null>(null);
  const [fileInfo, setFileInfo] = React.useState<{ duration: number; sampleRate: number; channels: number } | null>(null);

  // Engine & playback state
  const engineRef = React.useRef<StemMixerEngine | null>(null);
  const [mixerState, setMixerState] = React.useState<StemMixerState>({
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    vocalVolume: 1.0,
    instVolume: 1.0,
    isVocalMuted: false,
    isInstMuted: false,
    isVocalSolo: false,
    isInstSolo: false,
    vocalLevel: 0,
    instLevel: 0,
  });

  const [waveforms, setWaveforms] = React.useState<{ vocalPeaks: number[]; instPeaks: number[] } | null>(null);
  const [selectedPreset, setSelectedPreset] = React.useState<QuickPreset>("original");
  const [isLoadingAudio, setIsLoadingAudio] = React.useState(false);

  // Export settings
  const [exportFormat, setExportFormat] = React.useState<AudioOutputFormat>("mp3");
  const [exportBitrate, setExportBitrate] = React.useState<number>(320);

  // Export jobs state
  const [isExporting, setIsExporting] = React.useState<string | null>(null); // "vocals" | "instrumental" | "both" | "client-vocals" | "client-inst"
  const [exportProgress, setExportProgress] = React.useState(0);
  const [vocalJob, setVocalJob] = React.useState<JobRecord | null>(null);
  const [instJob, setInstJob] = React.useState<JobRecord | null>(null);
  const [clientVocalUrl, setClientVocalUrl] = React.useState<string | null>(null);
  const [clientInstUrl, setClientInstUrl] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  // Initialize engine
  React.useEffect(() => {
    const engine = new StemMixerEngine();
    engine.onStateUpdate = (state) => {
      setMixerState({ ...state });
    };
    engineRef.current = engine;

    return () => {
      engine.destroy();
    };
  }, []);

  // Keyboard shortcut: Spacebar to toggle Play/Pause
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && file && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
        e.preventDefault();
        togglePlay();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [file, mixerState.isPlaying]);

  // Load file into Web Audio engine
  const handleFileSelect = async (files: File[]) => {
    if (!files.length) return;
    const selected = files[0];
    setFile(selected);
    setError(null);
    setVocalJob(null);
    setInstJob(null);
    if (clientVocalUrl) URL.revokeObjectURL(clientVocalUrl);
    if (clientInstUrl) URL.revokeObjectURL(clientInstUrl);
    setClientVocalUrl(null);
    setClientInstUrl(null);
    setIsLoadingAudio(true);

    try {
      if (engineRef.current) {
        const info = await engineRef.current.loadFile(selected);
        setFileInfo(info);
        const peaks = engineRef.current.getWaveformPeaks(120);
        setWaveforms(peaks);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to decode audio file.");
    } finally {
      setIsLoadingAudio(false);
    }
  };

  const togglePlay = () => {
    if (!engineRef.current) return;
    if (mixerState.isPlaying) {
      engineRef.current.pause();
    } else {
      engineRef.current.play();
    }
  };

  const handleSeek = (pct: number) => {
    if (!engineRef.current || !mixerState.duration) return;
    const target = pct * mixerState.duration;
    engineRef.current.seek(target);
  };

  const handleVocalVolume = (val: number) => {
    if (!engineRef.current) return;
    engineRef.current.setVocalVolume(val);
    setSelectedPreset("original");
  };

  const handleInstVolume = (val: number) => {
    if (!engineRef.current) return;
    engineRef.current.setInstrumentalVolume(val);
    setSelectedPreset("original");
  };

  const applyPreset = (preset: QuickPreset) => {
    if (!engineRef.current) return;
    setSelectedPreset(preset);
    const target = QUICK_PRESETS.find((p) => p.id === preset);
    if (!target) return;

    engineRef.current.setVocalSolo(false);
    engineRef.current.setInstrumentalSolo(false);
    engineRef.current.setVocalMuted(false);
    engineRef.current.setInstrumentalMuted(false);
    engineRef.current.setVocalVolume(target.v);
    engineRef.current.setInstrumentalVolume(target.i);
  };

  // Export using Backend Studio FFmpeg pipeline (produces MP3/WAV/FLAC)
  const handleServerExport = async (targetStem: "vocals" | "instrumental" | "both") => {
    if (!file) return;
    setIsExporting(targetStem);
    setExportProgress(10);
    setError(null);

    try {
      const baseSettings: AudioSettings = {
        format: exportFormat,
        bitrate: exportBitrate,
      };

      if (targetStem === "vocals" || targetStem === "both") {
        setExportProgress(25);
        const submitRes = await submitAudio(file, {
          ...baseSettings,
          stemMode: "vocals",
        });
        const completed = await waitForJob(submitRes.jobId, (p) => setExportProgress(p));
        setVocalJob(completed);
      }

      if (targetStem === "instrumental" || targetStem === "both") {
        setExportProgress(targetStem === "both" ? 60 : 25);
        const submitRes = await submitAudio(file, {
          ...baseSettings,
          stemMode: "instrumental",
        });
        const completed = await waitForJob(submitRes.jobId, (p) =>
          setExportProgress(targetStem === "both" ? 60 + Math.round(p * 0.4) : p)
        );
        setInstJob(completed);
      }

      setExportProgress(100);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Stem extraction failed.");
    } finally {
      setIsExporting(null);
    }
  };

  // Instant client-side offline WAV export (runs 100% in browser)
  const handleClientOfflineExport = async (targetStem: "vocals" | "instrumental") => {
    if (!engineRef.current) return;
    setIsExporting(`client-${targetStem}`);
    setExportProgress(15);
    setError(null);

    try {
      const blob = await engineRef.current.renderStemOffline(targetStem, (p) => setExportProgress(p));
      const url = URL.createObjectURL(blob);
      if (targetStem === "vocals") {
        setClientVocalUrl(url);
      } else {
        setClientInstUrl(url);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Client export failed.");
    } finally {
      setIsExporting(null);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Hero Header */}
      <div className="text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-sky-500/30 bg-sky-500/10 px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-sky-400">
          <Sparkles className="h-3.5 w-3.5 text-sky-400 animate-pulse" />
          AI Audio Stem Isolation Studio
        </div>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl">
          Vocal Remover & <span className="bg-gradient-to-r from-sky-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">Karaoke Stem Separator</span>
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-sm sm:text-base text-muted-foreground">
          Extract pristine <strong>Acapella Vocals</strong> and crystal-clear <strong>Karaoke Backing Tracks</strong>. Live dual-track interactive faders, real-time VU meters, and studio-grade export.
        </p>
      </div>

      {/* Main Container */}
      <div className="mt-8 space-y-6">
        {/* Upload Zone */}
        {!file && (
          <div className="rounded-2xl border border-border/80 bg-card p-6 shadow-xl sm:p-10">
            <Dropzone
              kind="audio"
              accept="audio/*,video/*,.mp3,.wav,.flac,.m4a,.aac,.ogg,.oga,.opus,.webm,.mp4,.m4v,.mov,.mkv,.avi,.wmv,.mpg,.mpeg,.3gp"
              onFiles={handleFileSelect}
            />
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Supports MP3, WAV, FLAC, M4A, OGG, AAC, MP4, MKV, MOV up to 250MB
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-6 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" /> 100% Private & In-Memory
              </span>
              <span className="flex items-center gap-1.5">
                <Zap className="h-4 w-4 text-amber-400" /> Real-Time Dual Live Faders
              </span>
              <span className="flex items-center gap-1.5">
                <Headphones className="h-4 w-4 text-sky-400" /> Instant Solo / Mute Audition
              </span>
            </div>
          </div>
        )}

        {/* Active Audio Workspace */}
        {file && (
          <div className="space-y-6">
            {/* Audio Info & Replace Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border/60 bg-card/60 px-5 py-3 backdrop-blur-md">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-500/10 text-sky-400">
                  <Disc3 className={cn("h-5 w-5", mixerState.isPlaying && "animate-spin text-sky-300")} />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(file.size / (1024 * 1024)).toFixed(2)} MB • {fileInfo ? `${formatClock(fileInfo.duration)} • ${fileInfo.sampleRate} Hz • ${fileInfo.channels === 1 ? "Mono" : "Stereo"}` : "Analyzing..."}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (engineRef.current) engineRef.current.stop();
                    setFile(null);
                    setFileInfo(null);
                  }}
                  className="rounded-lg border border-border bg-background/80 px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
                >
                  Upload New Song
                </button>
              </div>
            </div>

            {/* Error Notification */}
            {error && (
              <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
                {error}
              </div>
            )}

            {/* Quick Mix Preset Buttons */}
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Quick Mix Modes
                </span>
                <span className="text-xs text-muted-foreground">Press Space to Play / Pause</span>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                {QUICK_PRESETS.map((preset) => {
                  const isSelected = selectedPreset === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => applyPreset(preset.id)}
                      className={cn(
                        "flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition",
                        isSelected
                          ? "border-sky-500 bg-sky-500/10 text-sky-400 shadow-sm"
                          : "border-border/70 bg-card hover:border-border hover:bg-muted/50"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-base">{preset.icon}</span>
                        <span className="text-xs font-semibold">{preset.label}</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground leading-tight">{preset.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Synchronized Transport & Dual Waveform Timeline */}
            <div className="rounded-2xl border border-border bg-card p-6 shadow-lg">
              {/* Transport Controls */}
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={togglePlay}
                    disabled={isLoadingAudio}
                    className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-r from-sky-500 to-indigo-600 text-white shadow-md shadow-sky-500/20 transition hover:scale-105 active:scale-95 disabled:opacity-50"
                  >
                    {isLoadingAudio ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : mixerState.isPlaying ? (
                      <Pause className="h-5 w-5 fill-current" />
                    ) : (
                      <Play className="h-5 w-5 fill-current ml-0.5" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (engineRef.current) engineRef.current.seek(0);
                    }}
                    title="Restart from beginning"
                    className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition hover:text-foreground"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </button>

                  <div className="font-mono text-sm font-semibold tracking-wider">
                    <span className="text-foreground">{formatClock(mixerState.currentTime)}</span>
                    <span className="text-muted-foreground"> / {formatClock(mixerState.duration)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-2 w-2 rounded-full bg-sky-400" />
                    <span className="text-muted-foreground">Vocals: <strong>{Math.round(mixerState.vocalVolume * 100)}%</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-2 w-2 rounded-full bg-purple-400" />
                    <span className="text-muted-foreground">Instrumental: <strong>{Math.round(mixerState.instVolume * 100)}%</strong></span>
                  </div>
                </div>
              </div>

              {/* Waveform Scrubber */}
              <div className="relative mt-6 group select-none">
                <div
                  className="relative h-20 w-full cursor-pointer overflow-hidden rounded-xl bg-muted/40 border border-border/50 p-1 flex items-center gap-[2px]"
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const clickX = e.clientX - rect.left;
                    const pct = Math.max(0, Math.min(1, clickX / rect.width));
                    handleSeek(pct);
                  }}
                >
                  {/* Waveform Bars */}
                  {waveforms && waveforms.instPeaks.map((instPeak, idx) => {
                    const vocalPeak = waveforms.vocalPeaks[idx] ?? instPeak;
                    const progressRatio = mixerState.duration > 0 ? mixerState.currentTime / mixerState.duration : 0;
                    const barRatio = idx / waveforms.instPeaks.length;
                    const isPassed = barRatio <= progressRatio;

                    return (
                      <div
                        key={idx}
                        className="flex-1 flex flex-col justify-center items-center h-full gap-[1px]"
                      >
                        {/* Upper half: Vocals */}
                        <div
                          style={{ height: `${Math.max(4, vocalPeak * 36)}px` }}
                          className={cn(
                            "w-full rounded-t-sm transition-colors",
                            isPassed
                              ? "bg-sky-400"
                              : "bg-sky-500/25 group-hover:bg-sky-500/40"
                          )}
                        />
                        {/* Lower half: Instrumental */}
                        <div
                          style={{ height: `${Math.max(4, instPeak * 36)}px` }}
                          className={cn(
                            "w-full rounded-b-sm transition-colors",
                            isPassed
                              ? "bg-purple-400"
                              : "bg-purple-500/25 group-hover:bg-purple-500/40"
                          )}
                        />
                      </div>
                    );
                  })}

                  {/* Playhead Marker */}
                  {mixerState.duration > 0 && (
                    <div
                      className="absolute top-0 bottom-0 w-[2px] bg-white shadow-[0_0_10px_2px_rgba(255,255,255,0.7)] pointer-events-none transition-all"
                      style={{
                        left: `${(mixerState.currentTime / mixerState.duration) * 100}%`,
                      }}
                    >
                      <div className="absolute -top-1.5 -left-1.5 h-3.5 w-3.5 rounded-full bg-white shadow-md border-2 border-sky-500" />
                    </div>
                  )}
                </div>

                <div className="mt-1 flex justify-between text-[11px] text-muted-foreground font-mono">
                  <span>0:00</span>
                  <span>{formatClock(mixerState.duration)}</span>
                </div>
              </div>
            </div>

            {/* Dual Stem Interactive Mixer Console */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {/* Channel 1: Vocals / Acapella */}
              <div className="relative overflow-hidden rounded-2xl border border-sky-500/30 bg-gradient-to-b from-sky-950/20 via-card to-card p-6 shadow-md">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/20 text-sky-400">
                      <Mic2 className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-base text-foreground flex items-center gap-1.5">
                        Vocals Only <span className="text-xs font-medium text-sky-400">(Acapella)</span>
                      </h3>
                      <p className="text-xs text-muted-foreground">Isolates singing, rap & speech</p>
                    </div>
                  </div>

                  {/* Solo & Mute Buttons */}
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        if (engineRef.current) engineRef.current.setVocalSolo(!mixerState.isVocalSolo);
                      }}
                      className={cn(
                        "h-8 px-2.5 rounded-lg text-xs font-bold transition",
                        mixerState.isVocalSolo
                          ? "bg-amber-500 text-black shadow-sm"
                          : "border border-border bg-background text-muted-foreground hover:text-foreground"
                      )}
                    >
                      SOLO
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (engineRef.current) engineRef.current.toggleVocalMuted();
                      }}
                      className={cn(
                        "h-8 px-2.5 rounded-lg text-xs font-bold transition",
                        mixerState.isVocalMuted
                          ? "bg-rose-500 text-white shadow-sm"
                          : "border border-border bg-background text-muted-foreground hover:text-foreground"
                      )}
                    >
                      MUTE
                    </button>
                  </div>
                </div>

                {/* Level Meter & Slider */}
                <div className="mt-6 space-y-3">
                  <div className="flex items-center justify-between text-xs font-medium">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <Volume2 className="h-4 w-4 text-sky-400" /> Channel Fader
                    </span>
                    <span className="font-mono text-sky-400 font-bold">
                      {Math.round(mixerState.vocalVolume * 100)}% ({gainToDb(mixerState.vocalVolume)})
                    </span>
                  </div>

                  <Slider
                    value={[mixerState.vocalVolume]}
                    min={0}
                    max={1.5}
                    step={0.01}
                    onValueChange={([val]) => handleVocalVolume(val)}
                    className="py-1 cursor-pointer"
                  />

                  {/* Real-time Dynamic VU Meter Bar */}
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted/60">
                    <div
                      className="h-full bg-gradient-to-r from-sky-500 via-teal-400 to-emerald-400 transition-all duration-75"
                      style={{
                        width: `${Math.min(100, mixerState.vocalLevel * 100)}%`,
                      }}
                    />
                  </div>
                </div>

                {/* Quick Stem Action Buttons */}
                <div className="mt-6 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={isExporting !== null}
                    onClick={() => handleServerExport("vocals")}
                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-sky-500/15 border border-sky-500/30 px-3.5 py-2.5 text-xs font-semibold text-sky-400 transition hover:bg-sky-500/25 active:scale-95 disabled:opacity-50"
                  >
                    {isExporting === "vocals" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                    Export Studio Acapella ({exportFormat.toUpperCase()})
                  </button>

                  <button
                    type="button"
                    disabled={isExporting !== null}
                    onClick={() => handleClientOfflineExport("vocals")}
                    title="Instant client-side WAV export"
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2.5 text-xs font-medium text-muted-foreground transition hover:text-foreground active:scale-95 disabled:opacity-50"
                  >
                    ⚡ Fast WAV
                  </button>
                </div>

                {/* Finished Downloads for Vocals */}
                {(vocalJob || clientVocalUrl) && (
                  <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs space-y-2">
                    <div className="flex items-center justify-between text-emerald-400 font-medium">
                      <span className="flex items-center gap-1.5">
                        <CheckCircle2 className="h-4 w-4" /> Vocals Ready!
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {vocalJob && (
                        <a
                          href={downloadUrl(vocalJob.id)}
                          download
                          className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-white font-semibold hover:bg-emerald-500"
                        >
                          <Download className="h-3.5 w-3.5" /> Download Studio ({exportFormat.toUpperCase()})
                        </a>
                      )}
                      {clientVocalUrl && (
                        <a
                          href={clientVocalUrl}
                          download={`${file.name.replace(/\.[^/.]+$/, "")}_vocals.wav`}
                          className="flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 text-white font-semibold hover:bg-sky-500"
                        >
                          <Download className="h-3.5 w-3.5" /> Download WAV (Lossless)
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Channel 2: Instrumental / Karaoke */}
              <div className="relative overflow-hidden rounded-2xl border border-purple-500/30 bg-gradient-to-b from-purple-950/20 via-card to-card p-6 shadow-md">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500/20 text-purple-400">
                      <Music2 className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-base text-foreground flex items-center gap-1.5">
                        Instrumental Only <span className="text-xs font-medium text-purple-400">(Karaoke)</span>
                      </h3>
                      <p className="text-xs text-muted-foreground">Full backing track without vocals</p>
                    </div>
                  </div>

                  {/* Solo & Mute Buttons */}
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        if (engineRef.current) engineRef.current.setInstrumentalSolo(!mixerState.isInstSolo);
                      }}
                      className={cn(
                        "h-8 px-2.5 rounded-lg text-xs font-bold transition",
                        mixerState.isInstSolo
                          ? "bg-amber-500 text-black shadow-sm"
                          : "border border-border bg-background text-muted-foreground hover:text-foreground"
                      )}
                    >
                      SOLO
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (engineRef.current) engineRef.current.toggleInstrumentalMuted();
                      }}
                      className={cn(
                        "h-8 px-2.5 rounded-lg text-xs font-bold transition",
                        mixerState.isInstMuted
                          ? "bg-rose-500 text-white shadow-sm"
                          : "border border-border bg-background text-muted-foreground hover:text-foreground"
                      )}
                    >
                      MUTE
                    </button>
                  </div>
                </div>

                {/* Level Meter & Slider */}
                <div className="mt-6 space-y-3">
                  <div className="flex items-center justify-between text-xs font-medium">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <Volume2 className="h-4 w-4 text-purple-400" /> Channel Fader
                    </span>
                    <span className="font-mono text-purple-400 font-bold">
                      {Math.round(mixerState.instVolume * 100)}% ({gainToDb(mixerState.instVolume)})
                    </span>
                  </div>

                  <Slider
                    value={[mixerState.instVolume]}
                    min={0}
                    max={1.5}
                    step={0.01}
                    onValueChange={([val]) => handleInstVolume(val)}
                    className="py-1 cursor-pointer"
                  />

                  {/* Real-time Dynamic VU Meter Bar */}
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted/60">
                    <div
                      className="h-full bg-gradient-to-r from-purple-500 via-pink-400 to-amber-400 transition-all duration-75"
                      style={{
                        width: `${Math.min(100, mixerState.instLevel * 100)}%`,
                      }}
                    />
                  </div>
                </div>

                {/* Quick Stem Action Buttons */}
                <div className="mt-6 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={isExporting !== null}
                    onClick={() => handleServerExport("instrumental")}
                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-purple-500/15 border border-purple-500/30 px-3.5 py-2.5 text-xs font-semibold text-purple-400 transition hover:bg-purple-500/25 active:scale-95 disabled:opacity-50"
                  >
                    {isExporting === "instrumental" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                    Export Studio Karaoke ({exportFormat.toUpperCase()})
                  </button>

                  <button
                    type="button"
                    disabled={isExporting !== null}
                    onClick={() => handleClientOfflineExport("instrumental")}
                    title="Instant client-side WAV export"
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2.5 text-xs font-medium text-muted-foreground transition hover:text-foreground active:scale-95 disabled:opacity-50"
                  >
                    ⚡ Fast WAV
                  </button>
                </div>

                {/* Finished Downloads for Instrumental */}
                {(instJob || clientInstUrl) && (
                  <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs space-y-2">
                    <div className="flex items-center justify-between text-emerald-400 font-medium">
                      <span className="flex items-center gap-1.5">
                        <CheckCircle2 className="h-4 w-4" /> Instrumental Ready!
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {instJob && (
                        <a
                          href={downloadUrl(instJob.id)}
                          download
                          className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-white font-semibold hover:bg-emerald-500"
                        >
                          <Download className="h-3.5 w-3.5" /> Download Studio ({exportFormat.toUpperCase()})
                        </a>
                      )}
                      {clientInstUrl && (
                        <a
                          href={clientInstUrl}
                          download={`${file.name.replace(/\.[^/.]+$/, "")}_instrumental.wav`}
                          className="flex items-center gap-1.5 rounded-lg bg-purple-600 px-3 py-1.5 text-white font-semibold hover:bg-purple-500"
                        >
                          <Download className="h-3.5 w-3.5" /> Download WAV (Lossless)
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Studio Export & Mastering Hub */}
            <div className="rounded-2xl border border-border bg-card p-6 shadow-lg">
              <div className="flex items-center justify-between border-b border-border/60 pb-4">
                <div>
                  <h3 className="text-base font-bold text-foreground">Studio Stem Export Hub</h3>
                  <p className="text-xs text-muted-foreground">Select audio format and batch export separate stems</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground">Format:</span>
                    <Select value={exportFormat} onValueChange={(v) => setExportFormat(v as AudioOutputFormat)}>
                      <SelectTrigger className="h-8 w-24 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {AUDIO_OUTPUT_FORMATS.map((f) => (
                          <SelectItem key={f} value={f} className="text-xs">
                            {f.toUpperCase()}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {["mp3", "m4a", "ogg", "opus"].includes(exportFormat) && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-muted-foreground">Bitrate:</span>
                      <Select value={String(exportBitrate)} onValueChange={(v) => setExportBitrate(Number(v))}>
                        <SelectTrigger className="h-8 w-28 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {AUDIO_BITRATES.map((b) => (
                            <SelectItem key={b} value={String(b)} className="text-xs">
                              {b} kbps
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </div>

              {/* Progress Bar during Export */}
              {isExporting && (
                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-sky-400" />
                      Exporting {isExporting === "both" ? "both Acapella & Karaoke stems" : isExporting}...
                    </span>
                    <span className="font-mono font-semibold">{exportProgress}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-gradient-to-r from-sky-500 to-purple-500 transition-all duration-300"
                      style={{ width: `${exportProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
                <button
                  type="button"
                  disabled={isExporting !== null}
                  onClick={() => handleServerExport("both")}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-purple-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-sky-500/20 transition hover:opacity-95 active:scale-95 disabled:opacity-50"
                >
                  {isExporting === "both" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  Export Both Stems (Separate Tracks)
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Feature Cards / Educational Explanation */}
        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-3">
          <div className="rounded-2xl border border-border/80 bg-card p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/15 text-sky-400">
              <Headphones className="h-5 w-5" />
            </div>
            <h4 className="mt-3 font-semibold text-sm">Karaoke & Backing Tracks</h4>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              Mute vocals while preserving punchy bass and stereo instruments. Perfect for karaoke parties, singing practice, or backing tracks.
            </p>
          </div>

          <div className="rounded-2xl border border-border/80 bg-card p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/15 text-purple-400">
              <Mic2 className="h-5 w-5" />
            </div>
            <h4 className="mt-3 font-semibold text-sm">Clean Acapellas for DJs & Remixes</h4>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              Isolate lead and backup vocal lines for electronic remixes, mashups, hip-hop sampling, or podcast dialogue enhancement.
            </p>
          </div>

          <div className="rounded-2xl border border-border/80 bg-card p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
              <Zap className="h-5 w-5" />
            </div>
            <h4 className="mt-3 font-semibold text-sm">Instant Client & Studio Modes</h4>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              Mix and preview in real-time in your browser with zero server latency, and export high-fidelity 320kbps MP3s or lossless WAVs.
            </p>
          </div>
        </div>

        {/* Pro features auth gate promo */}
        <div className="mt-8">
          <AuthGate>
            <div className="rounded-2xl border border-border/60 bg-muted/30 p-4 text-center text-xs text-muted-foreground">
              Pro users enjoy unlimited high-fidelity 320kbps and 24-bit 96kHz lossless stem exports.
            </div>
          </AuthGate>
        </div>
      </div>
    </div>
  );
}

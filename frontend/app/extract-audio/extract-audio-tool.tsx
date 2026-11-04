"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Download,
  FileAudio,
  Film,
  Loader2,
  Mic,
  Scissors,
  Sparkles,
  Volume2,
  Wand2,
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
  AUDIO_CHANNELS,
  AUDIO_OUTPUT_FORMATS,
  type AudioChannels,
  type AudioOutputFormat,
  type AudioSettings,
  type JobRecord,
} from "@/lib/types";
import { cn } from "@/lib/utils";

async function waitForJob(jobId: string, onProgress?: (pct: number) => void): Promise<JobRecord> {
  let attempts = 0;
  while (attempts < 120) {
    const job = await getJob(jobId);
    if (onProgress) {
      if (job.state === "queued") onProgress(35);
      else if (job.state === "processing") onProgress(Math.min(92, 50 + attempts * 5));
    }
    if (job.state === "completed") return job;
    if (job.state === "failed") throw new Error(job.error || "Processing failed.");
    await new Promise((r) => setTimeout(r, 600));
    attempts++;
  }
  throw new Error("Processing timed out. Please try again.");
}

function formatClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0:00";
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

type ExtractionPreset = "copy" | "mp3-hq" | "mp3-std" | "wav" | "m4a" | "flac" | "opus";

const EXTRACTION_PRESETS: {
  id: ExtractionPreset;
  title: string;
  badge: string;
  desc: string;
  format: AudioOutputFormat;
  bitrate: number;
  copyStream?: boolean;
}[] = [
  {
    id: "copy",
    title: "⚡ Lossless Direct Copy",
    badge: "Fastest (0.5s)",
    desc: "Extracts original audio track instantly without any re-encoding quality loss.",
    format: "m4a",
    bitrate: 192,
    copyStream: true,
  },
  {
    id: "mp3-hq",
    title: "🎵 High-Fidelity MP3",
    badge: "320 kbps",
    desc: "Maximum MP3 studio bitrate with rich treble and wide stereo image.",
    format: "mp3",
    bitrate: 320,
  },
  {
    id: "mp3-std",
    title: "🎧 Universal MP3",
    badge: "192 kbps",
    desc: "Universal compatibility with crisp quality and compact file size.",
    format: "mp3",
    bitrate: 192,
  },
  {
    id: "wav",
    title: "🎙️ Lossless WAV Master",
    badge: "Uncompressed",
    desc: "Bit-perfect uncompressed PCM for video editing and audio production.",
    format: "wav",
    bitrate: 192,
  },
  {
    id: "m4a",
    title: "🍏 Apple M4A / AAC",
    badge: "Modern AAC",
    desc: "Optimized for iPhone, iPad, Mac and high-efficiency streaming.",
    format: "m4a",
    bitrate: 256,
  },
  {
    id: "flac",
    title: "🎼 Lossless FLAC",
    badge: "Audiophile",
    desc: "Compressed lossless audio format for archiving and high-end sound.",
    format: "flac",
    bitrate: 192,
  },
  {
    id: "opus",
    title: "🌐 OPUS Voice & Web",
    badge: "Compact",
    desc: "Next-generation ultra-efficient speech and music codec.",
    format: "opus",
    bitrate: 128,
  },
];

export function ExtractAudioTool() {
  const [file, setFile] = React.useState<File | null>(null);
  const [videoUrl, setVideoUrl] = React.useState<string | null>(null);
  const [duration, setDuration] = React.useState<number>(0);
  const videoRef = React.useRef<HTMLVideoElement | null>(null);

  // Settings
  const [selectedPreset, setSelectedPreset] = React.useState<ExtractionPreset>("mp3-hq");
  const [format, setFormat] = React.useState<AudioOutputFormat>("mp3");
  const [bitrate, setBitrate] = React.useState<number>(320);
  const [copyStream, setCopyStream] = React.useState<boolean>(false);
  const [channels, setChannels] = React.useState<AudioChannels>("keep");
  const [volume, setVolume] = React.useState<number>(1.0);
  const [trimStart, setTrimStart] = React.useState<number>(0);
  const [trimEnd, setTrimEnd] = React.useState<number>(0);

  // Processing state
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [completedJob, setCompletedJob] = React.useState<JobRecord | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  // Clean up object URL
  React.useEffect(() => {
    return () => {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
    };
  }, [videoUrl]);

  const handleSelectFile = (f: File) => {
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    setFile(f);
    const url = URL.createObjectURL(f);
    setVideoUrl(url);
    setCompletedJob(null);
    setError(null);
    setTrimStart(0);
    setTrimEnd(0);
  };

  const handleApplyPreset = (presetId: ExtractionPreset) => {
    setSelectedPreset(presetId);
    const preset = EXTRACTION_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;

    setFormat(preset.format);
    setBitrate(preset.bitrate);
    setCopyStream(Boolean(preset.copyStream));
  };

  const handleVideoLoadedMetadata = () => {
    if (videoRef.current) {
      const dur = videoRef.current.duration;
      if (Number.isFinite(dur) && dur > 0) {
        setDuration(dur);
      }
    }
  };

  const handleExtract = async () => {
    if (!file) return;
    setIsProcessing(true);
    setProgress(15);
    setError(null);

    try {
      const settings: AudioSettings = {
        format,
        bitrate,
        channels,
        volume,
        trimStart: trimStart > 0 ? trimStart : undefined,
        trimEnd: trimEnd > 0 && trimEnd < duration ? trimEnd : undefined,
        copyStream: copyStream && trimStart === 0 && (!trimEnd || trimEnd >= duration),
      };

      const res = await submitAudio(file, settings);
      setProgress(40);

      const job = await waitForJob(res.jobId, (prog: number) => {
        setProgress(Math.max(40, Math.min(95, prog)));
      });

      setCompletedJob(job);
      setProgress(100);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to extract audio.";
      setError(msg);
    } finally {
      setIsProcessing(false);
    }
  };

  const effectiveEnd = trimEnd > 0 ? Math.min(trimEnd, duration) : duration;
  const clipLength = duration > 0 ? Math.max(0, effectiveEnd - trimStart) : 0;

  return (
    <AuthGate>
      <div className="container max-w-5xl py-8 sm:py-12">
        {/* Header */}
        <div className="mb-8 text-center sm:text-left">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 font-mono text-xs text-primary mb-3">
            <Film className="h-3.5 w-3.5" />
            Audio Extractor from Video
          </div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Audio Extractor from Video
          </h1>
          <p className="mt-2 text-sm text-muted-foreground sm:text-base max-w-2xl">
            Extract pristine audio tracks from MP4, MKV, MOV, WebM, AVI and video clips into MP3, WAV,
            AAC, FLAC, M4A or OPUS with one-click lossless stream copy, timeline trimming and volume boost.
          </p>
        </div>

        {/* Main Grid */}
        <div className="grid gap-8 lg:grid-cols-12">
          {/* Left Column: Upload & Video Player */}
          <div className="space-y-6 lg:col-span-7">
            {/* Upload Box */}
            <div className="rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-4 sm:p-5 shadow-xs">
              {!file ? (
                <div>
                  <Dropzone
                    kind="audio"
                    onFiles={(files) => {
                      if (files.length > 0) handleSelectFile(files[0]);
                    }}
                  />
                  <p className="mt-2 text-center text-xs text-muted-foreground">
                    Upload any video format (MP4, MKV, MOV, WebM, AVI, WMV, 3GP) or audio file.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 truncate">
                      <Film className="h-4 w-4 text-primary shrink-0" />
                      <span className="font-semibold truncate text-foreground">{file.name}</span>
                      <span className="text-muted-foreground font-mono">
                        ({(file.size / (1024 * 1024)).toFixed(2)} MB)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setFile(null);
                        setVideoUrl(null);
                        setCompletedJob(null);
                      }}
                      className="font-mono text-[11px] text-muted-foreground hover:text-destructive cursor-pointer ml-2"
                    >
                      Change Video
                    </button>
                  </div>

                  {/* Video Player */}
                  {videoUrl && (
                    <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black border border-outline-variant/30">
                      <video
                        ref={videoRef}
                        src={videoUrl}
                        controls
                        playsInline
                        onLoadedMetadata={handleVideoLoadedMetadata}
                        className="h-full w-full object-contain"
                      />
                    </div>
                  )}

                  {/* Interactive Timeline Trimmer */}
                  {duration > 0 && (
                    <div className="space-y-3 rounded-xl border border-outline-variant/20 bg-muted/30 p-3.5">
                      <div className="flex items-center justify-between">
                        <span className="font-display text-xs font-semibold text-foreground flex items-center gap-1.5">
                          <Scissors className="h-3.5 w-3.5 text-primary" />
                          Timeline Segment Trimmer
                        </span>
                        <span className="font-mono text-xs font-semibold text-primary">
                          {clipLength.toFixed(1)}s ({formatClock(clipLength)})
                        </span>
                      </div>

                      <div className="flex justify-between font-mono text-[11px] text-muted-foreground">
                        <span>Start: {formatClock(trimStart)}</span>
                        <span>End: {formatClock(effectiveEnd)}</span>
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between text-[11px] text-muted-foreground">
                          <span>Scrub Start: {trimStart.toFixed(1)}s</span>
                        </div>
                        <Slider
                          value={[trimStart]}
                          min={0}
                          max={Math.max(0, effectiveEnd - 0.5)}
                          step={0.1}
                          onValueChange={([s]) => setTrimStart(Math.round(s * 10) / 10)}
                        />

                        <div className="flex justify-between text-[11px] text-muted-foreground">
                          <span>Scrub End: {effectiveEnd.toFixed(1)}s</span>
                        </div>
                        <Slider
                          value={[effectiveEnd]}
                          min={Math.min(duration, trimStart + 0.5)}
                          max={duration}
                          step={0.1}
                          onValueChange={([e]) => {
                            const rounded = Math.round(e * 10) / 10;
                            setTrimEnd(rounded >= duration ? 0 : rounded);
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Extraction Quality Presets */}
            <div className="rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-4 sm:p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-on-surface-variant">
                    Audio Output Presets
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Choose from standard extraction recipes or lossless direct copy.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {EXTRACTION_PRESETS.map((preset) => {
                  const isSelected = selectedPreset === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleApplyPreset(preset.id)}
                      className={cn(
                        "flex flex-col items-start rounded-xl border p-3 text-left transition-all cursor-pointer",
                        isSelected
                          ? "border-primary bg-primary/10 text-primary shadow-xs ring-2 ring-primary"
                          : "border-outline-variant/25 bg-surface-container-low/50 hover:border-primary/40 hover:bg-muted/30",
                      )}
                    >
                      <div className="flex w-full items-center justify-between">
                        <span className="font-display text-xs font-bold text-foreground">
                          {preset.title}
                        </span>
                        <span className="rounded-full bg-muted/80 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                          {preset.badge}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-muted-foreground leading-snug">
                        {preset.desc}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Column: Audio Customization & Export */}
          <div className="space-y-6 lg:col-span-5">
            <div className="rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileAudio className="h-5 w-5 text-primary" />
                  <h3 className="font-display text-sm font-bold text-foreground">
                    Audio Settings
                  </h3>
                </div>
                <span className="font-mono text-xs uppercase font-semibold text-primary">
                  {format.toUpperCase()}
                </span>
              </div>

              {/* Format & Bitrate Selectors */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block font-mono text-xs text-on-surface-variant">Format</label>
                  <Select
                    value={format}
                    onValueChange={(f) => {
                      setFormat(f as AudioOutputFormat);
                      setCopyStream(false);
                    }}
                  >
                    <SelectTrigger className="bg-muted">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {AUDIO_OUTPUT_FORMATS.map((fmt) => (
                        <SelectItem key={fmt} value={fmt}>
                          {fmt.toUpperCase()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="mb-1 block font-mono text-xs text-on-surface-variant">Bitrate</label>
                  <Select
                    value={String(bitrate)}
                    disabled={format === "wav" || format === "flac" || copyStream}
                    onValueChange={(b) => setBitrate(Number(b))}
                  >
                    <SelectTrigger className="bg-muted">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {AUDIO_BITRATES.map((b) => (
                        <SelectItem key={b} value={String(b)}>
                          {b} kbps {b >= 256 ? "(Studio)" : b >= 192 ? "(Standard)" : "(Compact)"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Channels & Volume */}
              <div className="space-y-4 pt-2 border-t border-outline-variant/15">
                <div>
                  <label className="mb-1 block font-mono text-xs text-on-surface-variant">Channels</label>
                  <Select
                    value={channels}
                    onValueChange={(ch) => setChannels(ch as AudioChannels)}
                  >
                    <SelectTrigger className="bg-muted">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="keep">Keep Original Channels</SelectItem>
                      <SelectItem value="stereo">Stereo (2-ch)</SelectItem>
                      <SelectItem value="mono">Mono (1-ch Downmix)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-on-surface-variant flex items-center gap-1">
                      <Volume2 className="h-3.5 w-3.5" />
                      Dialogue & Audio Volume
                    </span>
                    <span className="font-mono font-semibold text-primary">
                      {Math.round(volume * 100)}%
                    </span>
                  </div>
                  <Slider
                    value={[volume]}
                    min={0.25}
                    max={2.0}
                    step={0.05}
                    onValueChange={([v]) => setVolume(Math.round(v * 100) / 100)}
                  />
                  <div className="flex justify-between font-mono text-[9px] text-muted-foreground">
                    <span>25% (Quiet)</span>
                    <span>100% (Original)</span>
                    <span>200% (2x Boost)</span>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleExtract}
                  disabled={!file || isProcessing}
                  className={cn(
                    "flex w-full items-center justify-center gap-2 rounded-xl py-3 font-display text-sm font-semibold shadow-md transition-all cursor-pointer",
                    !file || isProcessing
                      ? "bg-muted text-muted-foreground opacity-50 cursor-not-allowed"
                      : "bg-primary text-primary-foreground hover:bg-primary/95 active:scale-[0.99]",
                  )}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Extracting Audio... {progress}%
                    </>
                  ) : (
                    <>
                      <FileAudio className="h-4 w-4" />
                      Extract Audio ({format.toUpperCase()})
                    </>
                  )}
                </button>
              </div>

              {error && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                  {error}
                </div>
              )}

              {/* Completed Job & Next Actions Card */}
              {completedJob && completedJob.outputFilename && (
                <div className="rounded-xl border border-primary/30 bg-primary/10 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-primary">
                    <CheckCircle2 className="h-5 w-5 shrink-0" />
                    <div>
                      <p className="font-display text-xs font-bold">Audio Extracted Successfully!</p>
                      <p className="text-[11px] text-muted-foreground">
                        {completedJob.outputFilename}
                      </p>
                    </div>
                  </div>

                  <audio
                    controls
                    src={downloadUrl(completedJob.id)}
                    className="w-full h-10 rounded"
                  />

                  <div className="flex flex-col gap-2 pt-1">
                    <a
                      href={downloadUrl(completedJob.id)}
                      download={completedJob.outputFilename}
                      className="flex items-center justify-center gap-2 rounded-lg bg-primary py-2.5 font-display text-xs font-semibold text-primary-foreground hover:bg-primary/90 shadow-xs"
                    >
                      <Download className="h-4 w-4" />
                      Download {completedJob.outputFilename}
                    </a>

                    {/* Quick Cross-Tool Handoff Buttons */}
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-primary/20">
                      <Link
                        href="/voice-changer"
                        className="flex items-center justify-center gap-1.5 rounded-lg border border-primary/40 bg-background/80 py-2 text-center font-display text-[11px] font-semibold text-primary hover:bg-primary/10"
                      >
                        <Wand2 className="h-3.5 w-3.5" />
                        AI Voice Changer
                      </Link>
                      <Link
                        href="/speech-to-text"
                        className="flex items-center justify-center gap-1.5 rounded-lg border border-primary/40 bg-background/80 py-2 text-center font-display text-[11px] font-semibold text-primary hover:bg-primary/10"
                      >
                        <Mic className="h-3.5 w-3.5" />
                        Transcribe Audio
                      </Link>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Related Tools */}
            <div className="rounded-xl border border-outline-variant/15 bg-muted/20 p-4 text-xs space-y-2">
              <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                More Audio Suite Tools
              </p>
              <div className="flex flex-col gap-1.5">
                <Link
                  href="/voice-changer"
                  className="flex items-center justify-between rounded-lg p-2 hover:bg-muted text-on-surface-variant hover:text-primary transition-colors"
                >
                  <span>👧 AI Voice Changer (Man to Girl, Baby, Robot)</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
                <Link
                  href="/video"
                  className="flex items-center justify-between rounded-lg p-2 hover:bg-muted text-on-surface-variant hover:text-primary transition-colors"
                >
                  <span>🎬 Video Studio (Compress, Trim & Frame Export)</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
                <Link
                  href="/audio"
                  className="flex items-center justify-between rounded-lg p-2 hover:bg-muted text-on-surface-variant hover:text-primary transition-colors"
                >
                  <span>🎧 Audio Studio & Converter</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AuthGate>
  );
}

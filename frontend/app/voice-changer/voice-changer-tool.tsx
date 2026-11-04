"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Download,
  Loader2,
  Mic,
  MicOff,
  Music,
  Pause,
  Play,
  RotateCcw,
  Sliders,
  Sparkles,
  Upload,
  Volume2,
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
  type VoicePreset,
} from "@/lib/types";
import { VOICE_CHARACTERS, getVoiceCharacter } from "@/lib/voice-presets";
import { WebAudioVoicePreview } from "@/lib/web-audio-preview";
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

export function VoiceChangerTool() {
  const [inputMode, setInputMode] = React.useState<"upload" | "mic">("upload");
  const [file, setFile] = React.useState<File | null>(null);

  // Microphone recording state
  const [isRecording, setIsRecording] = React.useState(false);
  const [recordingSeconds, setRecordingSeconds] = React.useState(0);
  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
  const recordedChunksRef = React.useRef<Blob[]>([]);
  const recordTimerRef = React.useRef<number | null>(null);

  // Voice preset & fine-tuning state
  const [selectedPreset, setSelectedPreset] = React.useState<VoicePreset>("girl");
  const [pitchShift, setPitchShift] = React.useState(4.2);
  const [speed, setSpeed] = React.useState(1.0);
  const [reverb, setReverb] = React.useState(0.1);
  const [volume, setVolume] = React.useState(1.0);
  const [format, setFormat] = React.useState<AudioOutputFormat>("mp3");
  const [bitrate, setBitrate] = React.useState(192);

  // Web Audio preview player
  const playerRef = React.useRef<WebAudioVoicePreview | null>(null);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [currentTime, setCurrentTime] = React.useState(0);
  const [duration, setDuration] = React.useState(0);
  const [isAudioLoaded, setIsAudioLoaded] = React.useState(false);

  // Processing state
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [completedJob, setCompletedJob] = React.useState<JobRecord | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  // Initialize Web Audio preview player
  React.useEffect(() => {
    const player = new WebAudioVoicePreview();
    player.onStateChange = (playing, cur, dur) => {
      setIsPlaying(playing);
      setCurrentTime(cur);
      setDuration(dur);
    };
    playerRef.current = player;

    return () => {
      player.destroy();
      if (recordTimerRef.current !== null) {
        clearInterval(recordTimerRef.current);
      }
    };
  }, []);

  // Update file when user selects or records
  const handleSelectFile = React.useCallback(async (f: File) => {
    setFile(f);
    setCompletedJob(null);
    setError(null);
    if (playerRef.current) {
      try {
        await playerRef.current.loadFile(f);
        setIsAudioLoaded(true);
      } catch (err) {
        console.warn("Could not decode audio for client-side preview:", err);
      }
    }
  }, []);

  // Handle Preset Selection
  const handleSelectPreset = (preset: VoicePreset) => {
    setSelectedPreset(preset);
    const char = getVoiceCharacter(preset);
    setPitchShift(char.pitchShift);
    setSpeed(char.speed);
    setReverb(char.reverb);

    // If already playing, update live playback immediately
    if (playerRef.current && isPlaying) {
      playerRef.current.play(preset, char.pitchShift, char.speed, char.reverb);
    }
  };

  // Toggle Live Web Audio Preview
  const togglePreview = () => {
    if (!playerRef.current || !isAudioLoaded) return;
    if (isPlaying) {
      playerRef.current.pause();
    } else {
      playerRef.current.play(selectedPreset, pitchShift, speed, reverb);
    }
  };

  // Microphone recording
  const startRecording = async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      recordedChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(recordedChunksRef.current, { type: "audio/webm" });
        const recordedFile = new File([blob], `mic-recording-${Date.now()}.webm`, {
          type: "audio/webm",
        });
        await handleSelectFile(recordedFile);
      };

      recorder.start(100);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordingSeconds(0);

      recordTimerRef.current = window.setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      setError("Microphone permission denied or microphone not detected.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordTimerRef.current !== null) {
        clearInterval(recordTimerRef.current);
        recordTimerRef.current = null;
      }
    }
  };

  // Submit to Backend for Studio-Quality Processing
  const handleExport = async () => {
    if (!file) return;
    setIsProcessing(true);
    setProgress(15);
    setError(null);

    try {
      const settings: AudioSettings = {
        format,
        bitrate,
        volume,
        voicePreset: selectedPreset,
        pitchShift,
        speed,
        reverb,
      };

      const res = await submitAudio(file, settings);
      setProgress(40);

      // Poll until completed
      const job = await waitForJob(res.jobId, (prog: number) => {
        setProgress(Math.max(40, Math.min(95, prog)));
      });

      setCompletedJob(job);
      setProgress(100);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to process voice change.";
      setError(msg);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <AuthGate>
      <div className="container max-w-5xl py-8 sm:py-12">
        {/* Header */}
        <div className="mb-8 text-center sm:text-left">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 font-mono text-xs text-primary mb-3">
            <Sparkles className="h-3.5 w-3.5" />
            AI Voice Changer & Character Morpher
          </div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            AI Voice Changer & Character Morpher
          </h1>
          <p className="mt-2 text-sm text-muted-foreground sm:text-base max-w-2xl">
            Transform voice recordings and video clips into different characters: Man to Girl,
            Woman to Deep Man, Baby & Kid, Robot, Monster, Chipmunk, Helium, Radio & Cathedral Reverb.
          </p>
        </div>

        {/* Main Grid */}
        <div className="grid gap-8 lg:grid-cols-12">
          {/* Left Column: Input & Character Grid */}
          <div className="space-y-6 lg:col-span-7">
            {/* Input Selection Tabs */}
            <div className="rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-4 sm:p-5 shadow-xs">
              <div className="flex items-center gap-2 mb-4 border-b border-outline-variant/15 pb-3">
                <button
                  type="button"
                  onClick={() => setInputMode("upload")}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-1.5 font-display text-xs font-semibold transition-colors cursor-pointer",
                    inputMode === "upload"
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <Upload className="h-3.5 w-3.5" />
                  Upload Audio or Video
                </button>
                <button
                  type="button"
                  onClick={() => setInputMode("mic")}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-1.5 font-display text-xs font-semibold transition-colors cursor-pointer",
                    inputMode === "mic"
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <Mic className="h-3.5 w-3.5" />
                  Record from Microphone
                </button>
              </div>

              {inputMode === "upload" ? (
                <div>
                  <Dropzone
                    kind="audio"
                    accept="audio/*,video/*,.mp3,.wav,.flac,.m4a,.aac,.ogg,.oga,.opus,.webm,.mp4,.m4v,.mov,.mkv,.avi,.wmv,.mpg,.mpeg,.3gp"
                    onFiles={(files) => {
                      if (files.length > 0) handleSelectFile(files[0]);
                    }}
                  />
                  <p className="mt-2 text-center text-xs text-muted-foreground">
                    Accepts voice notes, audio (MP3, WAV, M4A, OGG, FLAC) and video clips (MP4, MKV, MOV, WebM).
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-6 text-center space-y-4">
                  {isRecording ? (
                    <div className="space-y-3">
                      <div className="relative inline-flex items-center justify-center">
                        <span className="absolute h-16 w-16 animate-ping rounded-full bg-destructive/30" />
                        <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-lg">
                          <Mic className="h-6 w-6 animate-pulse" />
                        </div>
                      </div>
                      <div className="font-mono text-xl font-bold text-destructive">
                        {formatClock(recordingSeconds)}
                      </div>
                      <p className="text-xs text-muted-foreground">Speaking into microphone...</p>
                      <button
                        type="button"
                        onClick={stopRecording}
                        className="inline-flex items-center gap-2 rounded-lg bg-destructive px-4 py-2 font-display text-xs font-semibold text-destructive-foreground hover:bg-destructive/90 cursor-pointer shadow-xs"
                      >
                        <MicOff className="h-4 w-4" />
                        Stop Recording
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <Mic className="h-6 w-6" />
                      </div>
                      <div>
                        <p className="font-display text-sm font-semibold text-foreground">
                          Record Your Voice
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Speak naturally into your mic, then choose a voice character below.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={startRecording}
                        className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 font-display text-xs font-semibold text-primary-foreground hover:bg-primary/90 cursor-pointer shadow-xs"
                      >
                        <Mic className="h-4 w-4" />
                        Start Recording
                      </button>
                    </div>
                  )}
                </div>
              )}

              {file && (
                <div className="mt-4 flex items-center justify-between rounded-lg border border-outline-variant/30 bg-muted/40 p-2.5 text-xs">
                  <div className="flex items-center gap-2 truncate">
                    <Music className="h-4 w-4 text-primary shrink-0" />
                    <span className="font-medium truncate text-foreground">{file.name}</span>
                    <span className="text-muted-foreground font-mono">
                      ({(file.size / (1024 * 1024)).toFixed(2)} MB)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setFile(null);
                      setCompletedJob(null);
                      if (playerRef.current) playerRef.current.stop();
                    }}
                    className="font-mono text-[11px] text-muted-foreground hover:text-destructive cursor-pointer ml-2"
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>

            {/* Voice Characters Selection Grid */}
            <div className="rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-4 sm:p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-on-surface-variant">
                    Voice Character Presets
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Select a voice persona to transform your recording.
                  </p>
                </div>
                <span className="font-mono text-[11px] text-primary font-semibold">
                  {VOICE_CHARACTERS.length} Personas
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {VOICE_CHARACTERS.map((char) => {
                  const isSelected = selectedPreset === char.id;
                  return (
                    <button
                      key={char.id}
                      type="button"
                      onClick={() => handleSelectPreset(char.id)}
                      className={cn(
                        "flex flex-col items-start rounded-xl border p-3 text-left transition-all cursor-pointer relative",
                        isSelected
                          ? "border-primary bg-primary/10 text-primary shadow-xs ring-2 ring-primary"
                          : "border-outline-variant/25 bg-surface-container-low/50 hover:border-primary/40 hover:bg-muted/30",
                      )}
                    >
                      <div className="flex w-full items-center justify-between">
                        <span className="text-2xl">{char.emoji}</span>
                        <span className="rounded-full bg-muted/80 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                          {char.badge}
                        </span>
                      </div>
                      <span className="mt-2 font-display text-sm font-bold leading-tight text-foreground">
                        {char.name}
                      </span>
                      <span className="font-mono text-[10px] text-primary font-semibold mt-0.5">
                        {char.transformation}
                      </span>
                      <p className="mt-1 text-[11px] text-muted-foreground line-clamp-2 leading-snug">
                        {char.tagline}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Column: Live Player, Controls & Export */}
          <div className="space-y-6 lg:col-span-5">
            {/* Live Web Audio Preview Card */}
            <div className="rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{getVoiceCharacter(selectedPreset).emoji}</span>
                  <div>
                    <h3 className="font-display text-sm font-bold text-foreground">
                      {getVoiceCharacter(selectedPreset).name}
                    </h3>
                    <p className="text-[11px] text-muted-foreground">
                      {getVoiceCharacter(selectedPreset).transformation}
                    </p>
                  </div>
                </div>
                <span className="rounded-full bg-primary/15 px-2 py-0.5 font-mono text-[10px] font-semibold text-primary">
                  Live Preview
                </span>
              </div>

              {/* Scrubber & Player Controls */}
              <div className="rounded-xl border border-outline-variant/20 bg-muted/40 p-4 space-y-3">
                <div className="flex items-center justify-between font-mono text-xs text-on-surface-variant">
                  <span>{formatClock(currentTime)}</span>
                  <span>{formatClock(duration)}</span>
                </div>

                <div className="relative">
                  <Slider
                    value={[currentTime]}
                    min={0}
                    max={duration > 0 ? duration : 100}
                    step={0.1}
                    disabled={!isAudioLoaded}
                    onValueChange={([v]) => {
                      if (playerRef.current) playerRef.current.seek(v);
                    }}
                  />
                </div>

                <div className="flex items-center justify-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={togglePreview}
                    disabled={!file || !isAudioLoaded}
                    className={cn(
                      "flex h-12 w-12 items-center justify-center rounded-full shadow-md transition-transform active:scale-95 cursor-pointer",
                      !file || !isAudioLoaded
                        ? "bg-muted text-muted-foreground opacity-50 cursor-not-allowed"
                        : "bg-primary text-primary-foreground hover:bg-primary/90",
                    )}
                  >
                    {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (playerRef.current) playerRef.current.stop();
                    }}
                    disabled={!file || !isAudioLoaded}
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-outline-variant/30 text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Character Details Description */}
              <p className="rounded-lg bg-surface-container-low p-3 text-xs leading-relaxed text-muted-foreground">
                {getVoiceCharacter(selectedPreset).description}
              </p>

              {/* Fine-Tuning Sliders */}
              <div className="space-y-4 pt-2 border-t border-outline-variant/15">
                <div className="flex items-center justify-between">
                  <span className="font-display text-xs font-semibold text-on-surface-variant flex items-center gap-1.5">
                    <Sliders className="h-3.5 w-3.5 text-primary" />
                    Fine-Tune Pitch & Timbre
                  </span>
                  <button
                    type="button"
                    onClick={() => handleSelectPreset(selectedPreset)}
                    className="font-mono text-[10px] text-muted-foreground hover:text-primary cursor-pointer"
                  >
                    Reset Preset
                  </button>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-on-surface-variant">Pitch Shift</span>
                    <span className="font-mono font-semibold text-primary">
                      {pitchShift > 0 ? `+${pitchShift}` : pitchShift} semitones
                    </span>
                  </div>
                  <Slider
                    value={[pitchShift]}
                    min={-12}
                    max={12}
                    step={0.5}
                    onValueChange={([p]) => setPitchShift(Math.round(p * 10) / 10)}
                  />
                  <div className="flex justify-between font-mono text-[9px] text-muted-foreground">
                    <span>-12 (Deep Bass)</span>
                    <span>0 (Normal)</span>
                    <span>+12 (Squeak)</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-on-surface-variant">Speed / Cadence</span>
                    <span className="font-mono font-semibold text-primary">{speed.toFixed(2)}x</span>
                  </div>
                  <Slider
                    value={[speed]}
                    min={0.25}
                    max={2.5}
                    step={0.05}
                    onValueChange={([s]) => setSpeed(Math.round(s * 100) / 100)}
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-on-surface-variant">Echo & Reverb</span>
                    <span className="font-mono font-semibold text-primary">
                      {Math.round(reverb * 100)}%
                    </span>
                  </div>
                  <Slider
                    value={[reverb]}
                    min={0}
                    max={1.0}
                    step={0.05}
                    onValueChange={([rv]) => setReverb(Math.round(rv * 100) / 100)}
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-on-surface-variant flex items-center gap-1">
                      <Volume2 className="h-3.5 w-3.5" />
                      Volume
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
                </div>
              </div>

              {/* Output Format & Bitrate */}
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-outline-variant/15">
                <div>
                  <label className="mb-1 block font-mono text-xs text-on-surface-variant">Format</label>
                  <Select
                    value={format}
                    onValueChange={(f) => setFormat(f as AudioOutputFormat)}
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
                    onValueChange={(b) => setBitrate(Number(b))}
                  >
                    <SelectTrigger className="bg-muted">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {AUDIO_BITRATES.map((b) => (
                        <SelectItem key={b} value={String(b)}>
                          {b} kbps
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleExport}
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
                      Rendering Studio Audio... {progress}%
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Export Changed Voice ({format.toUpperCase()})
                    </>
                  )}
                </button>
              </div>

              {error && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                  {error}
                </div>
              )}

              {/* Success & Download Card */}
              {completedJob && completedJob.outputFilename && (
                <div className="rounded-xl border border-primary/30 bg-primary/10 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-primary">
                    <CheckCircle2 className="h-5 w-5 shrink-0" />
                    <div>
                      <p className="font-display text-xs font-bold">Voice Transformation Complete!</p>
                      <p className="text-[11px] text-muted-foreground">
                        Ready for instant playback and download.
                      </p>
                    </div>
                  </div>

                  <audio
                    controls
                    src={downloadUrl(completedJob.id)}
                    className="w-full h-10 rounded"
                  />

                  <div className="flex items-center gap-2">
                    <a
                      href={downloadUrl(completedJob.id)}
                      download={completedJob.outputFilename}
                      className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-primary py-2.5 font-display text-xs font-semibold text-primary-foreground hover:bg-primary/90 shadow-xs"
                    >
                      <Download className="h-4 w-4" />
                      Download {completedJob.outputFilename}
                    </a>
                  </div>
                </div>
              )}
            </div>

            {/* Related Audio Tools Quick Links */}
            <div className="rounded-xl border border-outline-variant/15 bg-muted/20 p-4 text-xs space-y-2">
              <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                More Audio Suite Tools
              </p>
              <div className="flex flex-col gap-1.5">
                <Link
                  href="/extract-audio"
                  className="flex items-center justify-between rounded-lg p-2 hover:bg-muted text-on-surface-variant hover:text-primary transition-colors"
                >
                  <span>🎵 Audio Extractor from Video</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
                <Link
                  href="/speech-to-text"
                  className="flex items-center justify-between rounded-lg p-2 hover:bg-muted text-on-surface-variant hover:text-primary transition-colors"
                >
                  <span>📝 Transcribe to Text (Speech-to-Text)</span>
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

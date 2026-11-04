"use client";

import React, { useState, useRef, useId } from "react";
import {
  Scissors,
  Upload,
  Mic,
  Square,
  Play,
  Pause,
  Download,
  RotateCcw,
  Sparkles,
  Clock,
  Zap,
  Volume2,
} from "lucide-react";
import { toast } from "sonner";
import {
  decodeAudio,
  cutAudioSilence,
  extractWaveformPeaks,
  SilenceCutResult,
  SilenceCutOptions,
} from "@/lib/silence-cutter-engine";
import { downloadBlob } from "@/lib/screenshot";

type SensitivityPreset = "gentle" | "standard" | "aggressive";

const PRESETS: Record<SensitivityPreset, SilenceCutOptions> = {
  gentle: {
    thresholdDb: -45,
    minSilenceDuration: 0.6,
    paddingDuration: 0.08,
  },
  standard: {
    thresholdDb: -38,
    minSilenceDuration: 0.4,
    paddingDuration: 0.05,
  },
  aggressive: {
    thresholdDb: -32,
    minSilenceDuration: 0.25,
    paddingDuration: 0.03,
  },
};

export function SilenceCutterTool() {
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [waveformPeaks, setWaveformPeaks] = useState<number[]>([]);
  const [isDecoding, setIsDecoding] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Settings
  const [preset, setPreset] = useState<SensitivityPreset>("standard");
  const [options, setOptions] = useState<SilenceCutOptions>(PRESETS.standard);

  // Result
  const [result, setResult] = useState<SilenceCutResult | null>(null);
  const [originalAudioUrl, setOriginalAudioUrl] = useState<string | null>(null);
  const [trimmedAudioUrl, setTrimmedAudioUrl] = useState<string | null>(null);

  // Audio Playback
  const [playingTrack, setPlayingTrack] = useState<"original" | "trimmed" | null>(null);
  const [isRecording, setIsRecording] = useState<boolean>(false);

  // Refs
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputId = useId();

  // Load Audio
  const handleAudioUpload = async (file: File) => {
    if (!file.type.startsWith("audio/") && !file.name.match(/\.(mp3|wav|m4a|ogg|aac|webm)$/i)) {
      toast.error("Please upload a valid audio file (MP3, WAV, M4A, OGG).");
      return;
    }

    try {
      setIsDecoding(true);
      toast.info("Decoding audio waveform...");

      if (originalAudioUrl) URL.revokeObjectURL(originalAudioUrl);
      if (trimmedAudioUrl) URL.revokeObjectURL(trimmedAudioUrl);

      const buffer = await decodeAudio(file);
      const peaks = extractWaveformPeaks(buffer, 100);

      setAudioFile(file);
      setAudioBuffer(buffer);
      setWaveformPeaks(peaks);
      setOriginalAudioUrl(URL.createObjectURL(file));
      setResult(null);
      setTrimmedAudioUrl(null);
      setPlayingTrack(null);

      toast.success(`Loaded audio: ${file.name} (${Math.round(buffer.duration)}s)`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to decode audio file.");
    } finally {
      setIsDecoding(false);
    }
  };

  // Run Cut Silence
  const handleCutSilence = async () => {
    if (!audioBuffer) return;

    try {
      setIsProcessing(true);
      toast.info("Scanning for pauses and dead air...");

      const res = await cutAudioSilence(audioBuffer, options);
      setResult(res);

      if (trimmedAudioUrl) URL.revokeObjectURL(trimmedAudioUrl);
      const url = URL.createObjectURL(res.wavBlob);
      setTrimmedAudioUrl(url);

      toast.success(
        `Cut ${res.silenceCount} pauses! Saved ${res.timeSavedSeconds}s (${res.timeSavedPercent}% shorter).`
      );
    } catch (err: any) {
      toast.error(err?.message || "Failed to process audio.");
    } finally {
      setIsProcessing(false);
    }
  };

  // Preset Selection
  const handleSelectPreset = (p: SensitivityPreset) => {
    setPreset(p);
    setOptions(PRESETS[p]);
  };

  // Microphone Recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const micFile = new File([blob], `mic-recording-${Date.now()}.webm`, {
          type: "audio/webm",
        });
        await handleAudioUpload(micFile);
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      toast.info("Recording voice from microphone... speak with natural pauses.");
    } catch {
      toast.error("Could not access microphone.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // Audition playback
  const playAudio = (type: "original" | "trimmed") => {
    const player = audioPlayerRef.current;
    if (!player) return;

    const targetUrl = type === "original" ? originalAudioUrl : trimmedAudioUrl;
    if (!targetUrl) return;

    if (playingTrack === type && !player.paused) {
      player.pause();
      setPlayingTrack(null);
    } else {
      player.src = targetUrl;
      player.play();
      setPlayingTrack(type);
    }
  };

  // Download cleaned audio
  const handleDownload = () => {
    if (!result?.wavBlob) return;
    const base = audioFile ? audioFile.name.replace(/\.[^/.]+$/, "") : "audio";
    downloadBlob(result.wavBlob, `${base}-no-silence.wav`);
    toast.success("Downloaded trimmed audio!");
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/10 px-3 py-1 text-xs font-semibold text-violet-400">
          <Scissors className="h-3.5 w-3.5" />
          Podcast & Voice Note Fast-Cutter
        </div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Automatic Audio Silence & Dead Air Cutter
        </h1>
        <p className="mt-2 text-sm text-muted-foreground sm:text-base">
          Automatically detect awkward pauses, room silence, and dead air in voice recordings. Snip them out seamlessly with micro-crossfades.
        </p>
      </div>

      {/* Hidden audio element for A/B auditioning */}
      <audio
        ref={audioPlayerRef}
        onEnded={() => setPlayingTrack(null)}
        className="hidden"
      />

      {!audioBuffer ? (
        /* Dropzone & Mic Hero */
        <div className="space-y-4">
          <div
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-border/80 bg-card/60 p-12 text-center transition hover:border-violet-500/60 hover:bg-muted/30 cursor-pointer shadow-lg"
          >
            <div className="rounded-2xl bg-violet-500/10 p-5 text-violet-400 mb-4 shadow-inner">
              <Scissors className="h-10 w-10" />
            </div>
            <h2 className="text-xl font-bold text-foreground">
              Drop your podcast, voice note, or interview here
            </h2>
            <p className="mt-2 text-sm text-muted-foreground max-w-md">
              MP3, WAV, M4A, OGG, or WebM. 100% processed locally on your device.
            </p>
            <button
              type="button"
              className="mt-6 flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-md hover:opacity-90 transition"
            >
              <Upload className="h-4 w-4" />
              Select Audio File
            </button>
            <input
              id={fileInputId}
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleAudioUpload(e.target.files[0])}
            />
          </div>

          {/* Record with Mic Option */}
          <div className="flex items-center justify-center">
            {!isRecording ? (
              <button
                type="button"
                onClick={startRecording}
                className="flex items-center gap-2 rounded-2xl border border-border/60 bg-card px-5 py-2.5 text-xs font-semibold text-foreground hover:bg-muted transition shadow-sm"
              >
                <Mic className="h-4 w-4 text-red-500" />
                Or Record Voice Note via Microphone
              </button>
            ) : (
              <button
                type="button"
                onClick={stopRecording}
                className="flex items-center gap-2 rounded-2xl border border-red-500 bg-red-500/20 px-5 py-2.5 text-xs font-semibold text-red-400 animate-pulse transition shadow-sm"
              >
                <Square className="h-4 w-4 fill-red-500" />
                Stop Recording & Analyze
              </button>
            )}
          </div>
        </div>
      ) : (
        /* Loaded Audio Workspace */
        <div className="space-y-6">
          {/* Waveform Visualization Canvas */}
          <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Volume2 className="h-4 w-4 text-violet-400" />
                <span className="text-sm font-bold text-foreground">{audioFile?.name}</span>
              </div>
              <span className="text-xs font-mono text-muted-foreground">
                Original Duration: {Math.round(audioBuffer.duration * 10) / 10}s
              </span>
            </div>

            {/* Simulated Waveform Bar Display */}
            <div className="flex h-28 items-center gap-1 overflow-hidden rounded-2xl bg-neutral-900/80 p-3 shadow-inner">
              {waveformPeaks.map((peak, idx) => {
                const heightPercent = Math.max(12, Math.round(peak * 100));
                return (
                  <div
                    key={idx}
                    className="flex-1 rounded-full transition-all bg-violet-400/80 hover:bg-violet-300"
                    style={{ height: `${heightPercent}%` }}
                  />
                );
              })}
            </div>

            {/* Sensitivity Presets Bar */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 pt-2">
              {[
                {
                  id: "gentle",
                  title: "Gentle (Natural)",
                  sub: "Cuts silence > 0.6s at -45 dB",
                },
                {
                  id: "standard",
                  title: "Podcast Standard",
                  sub: "Cuts silence > 0.4s at -38 dB",
                },
                {
                  id: "aggressive",
                  title: "Punchy & Fast",
                  sub: "Cuts silence > 0.25s at -32 dB",
                },
              ].map((p) => {
                const active = preset === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleSelectPreset(p.id as SensitivityPreset)}
                    className={`rounded-xl border p-3 text-left transition ${
                      active
                        ? "border-violet-500 bg-violet-500/10 text-foreground ring-1 ring-violet-500/40"
                        : "border-border/60 bg-background/50 hover:bg-muted/40 text-muted-foreground"
                    }`}
                  >
                    <div className="text-xs font-bold text-foreground">{p.title}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">{p.sub}</div>
                  </button>
                );
              })}
            </div>

            {/* Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-border/40">
              <button
                type="button"
                onClick={() => {
                  setAudioBuffer(null);
                  setResult(null);
                }}
                className="flex items-center gap-1.5 rounded-xl border border-border/60 bg-muted/40 px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                New File
              </button>

              <button
                type="button"
                onClick={handleCutSilence}
                disabled={isProcessing}
                className="flex items-center gap-1.5 rounded-xl bg-violet-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg hover:bg-violet-500 transition disabled:opacity-50"
              >
                <Scissors className="h-4 w-4" />
                {isProcessing ? "Scanning Waveform..." : "Detect & Snip Dead Air"}
              </button>
            </div>
          </div>

          {/* Results Summary Card */}
          {result && (
            <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-xl space-y-6 animate-in fade-in">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-emerald-400" />
                <h3 className="text-lg font-bold text-foreground">Dead Air Removal Results</h3>
              </div>

              {/* Stats Highlights */}
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
                  <span className="text-xs text-muted-foreground">Original Length</span>
                  <div className="mt-1 text-xl font-bold font-mono text-foreground">
                    {result.originalDuration}s
                  </div>
                </div>

                <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
                  <span className="text-xs text-muted-foreground">New Trimmed Length</span>
                  <div className="mt-1 text-xl font-bold font-mono text-emerald-400">
                    {result.trimmedDuration}s
                  </div>
                </div>

                <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
                  <span className="text-xs text-muted-foreground">Time Saved</span>
                  <div className="mt-1 text-xl font-bold font-mono text-violet-400">
                    -{result.timeSavedSeconds}s ({result.timeSavedPercent}%)
                  </div>
                </div>

                <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
                  <span className="text-xs text-muted-foreground">Pauses Cut</span>
                  <div className="mt-1 text-xl font-bold font-mono text-foreground">
                    {result.silenceCount} gaps
                  </div>
                </div>
              </div>

              {/* A/B Comparison Player */}
              <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 space-y-3">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                  Listen & Compare:
                </span>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => playAudio("original")}
                    className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-xs font-bold transition ${
                      playingTrack === "original"
                        ? "border-primary bg-primary text-primary-foreground shadow"
                        : "border-border/60 bg-background hover:bg-muted text-foreground"
                    }`}
                  >
                    {playingTrack === "original" ? (
                      <Pause className="h-4 w-4" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                    Play Original Audio ({result.originalDuration}s)
                  </button>

                  <button
                    type="button"
                    onClick={() => playAudio("trimmed")}
                    className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-xs font-bold transition ${
                      playingTrack === "trimmed"
                        ? "border-emerald-500 bg-emerald-600 text-white shadow"
                        : "border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400"
                    }`}
                  >
                    {playingTrack === "trimmed" ? (
                      <Pause className="h-4 w-4" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                    Play Cleaned Audio ({result.trimmedDuration}s)
                  </button>
                </div>
              </div>

              {/* Download */}
              <button
                type="button"
                onClick={handleDownload}
                className="w-full flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-3.5 text-sm font-bold text-white shadow-lg hover:bg-emerald-500 transition"
              >
                <Download className="h-4 w-4" />
                Download Cleaned Audio (16-bit WAV)
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

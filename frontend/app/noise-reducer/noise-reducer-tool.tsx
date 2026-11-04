"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  AudioLines,
  Check,
  CheckCircle2,
  Copy,
  Download,
  FileAudio,
  Headphones,
  Loader2,
  Mic,
  MicOff,
  Music,
  Play,
  RotateCcw,
  Sliders,
  Sparkles,
  Square,
  Upload,
  Volume2,
  VolumeX,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

import { AuthGate } from "@/components/auth-gate";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  denoiseAudio,
  DENOISER_PRESETS,
  type DenoiserOptions,
} from "@/lib/audio-denoiser";
import { cn } from "@/lib/utils";

export function NoiseReducerTool() {
  const [file, setFile] = React.useState<File | Blob | null>(null);
  const [fileName, setFileName] = React.useState<string>("voice_sample.wav");
  const [originalUrl, setOriginalUrl] = React.useState<string | null>(null);
  const [cleanUrl, setCleanUrl] = React.useState<string | null>(null);

  // Settings
  const [selectedPreset, setSelectedPreset] = React.useState<string>("podcast");
  const [gateThreshold, setGateThreshold] = React.useState<number>(-42);
  const [highPass, setHighPass] = React.useState<number>(85);
  const [clarityBoost, setClarityBoost] = React.useState<number>(3.5);
  const [mainsFreq, setMainsFreq] = React.useState<50 | 60 | 0>(60);

  // Processing state
  const [isProcessing, setIsProcessing] = React.useState<boolean>(false);
  const [progressStage, setProgressStage] = React.useState<string>("");
  const [progressPercent, setProgressPercent] = React.useState<number>(0);

  // Microphone recording state
  const [isRecording, setIsRecording] = React.useState<boolean>(false);
  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
  const recordedChunks = React.useRef<Blob[]>([]);

  // Drag & drop
  const [isDragging, setIsDragging] = React.useState<boolean>(false);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  // Audio players
  const [activePlayer, setActivePlayer] = React.useState<"original" | "clean">("clean");

  const runDenoise = async (audioSource: File | Blob) => {
    setIsProcessing(true);
    setProgressPercent(10);
    setProgressStage("Initializing DSP filters...");

    try {
      const options: DenoiserOptions = {
        preset: selectedPreset as any,
        gateThresholdDb: gateThreshold,
        highPassCutoff: highPass,
        clarityBoostDb: clarityBoost,
        notchMainsFreq: mainsFreq,
      };

      const result = await denoiseAudio(audioSource, options, (stage, pct) => {
        setProgressStage(stage);
        setProgressPercent(pct);
      });

      setCleanUrl(result.wavUrl);
      setActivePlayer("clean");
      toast.success("Background noise removed! Voice cleaned & enhanced.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to process audio.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileUpload = (f: File) => {
    setFile(f);
    setFileName(f.name);
    const url = URL.createObjectURL(f);
    setOriginalUrl(url);
    runDenoise(f);
  };

  const applyPreset = (key: string) => {
    setSelectedPreset(key);
    const p = DENOISER_PRESETS[key];
    if (p) {
      setGateThreshold(p.gateThresholdDb);
      setHighPass(p.highPassCutoff);
      setClarityBoost(p.clarityBoostDb);
      setMainsFreq(p.notchMainsFreq || 0);
      if (file) {
        runDenoise(file);
      }
    }
  };

  // Microphone recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordedChunks.current = [];
      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr;

      mr.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunks.current.push(e.data);
      };

      mr.onstop = () => {
        const audioBlob = new Blob(recordedChunks.current, { type: "audio/webm" });
        setFile(audioBlob);
        setFileName("mic_recording.webm");
        const url = URL.createObjectURL(audioBlob);
        setOriginalUrl(url);
        stream.getTracks().forEach((t) => t.stop());
        runDenoise(audioBlob);
      };

      mr.start();
      setIsRecording(true);
      toast.info("Recording microphone... Speak to test noise reduction.");
    } catch {
      toast.error("Microphone access was denied or is unavailable.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const downloadCleanAudio = () => {
    if (!cleanUrl) return;
    const a = document.createElement("a");
    a.href = cleanUrl;
    a.download = `${fileName.replace(/\.[^.]+$/, "")}_denoised.wav`;
    a.click();
    toast.success("Downloaded clean audio!");
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Hero Header */}
      <div className="text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-sky-500/30 bg-sky-500/10 px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-sky-400">
          <AudioLines className="h-3.5 w-3.5 text-sky-400 animate-pulse" />
          Web Audio DSP & Acoustic Denoising
        </div>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl">
          AI Audio Noise Reducer &{" "}
          <span className="bg-gradient-to-r from-sky-400 via-teal-400 to-emerald-400 bg-clip-text text-transparent">
            Voice Enhancer
          </span>
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-sm sm:text-base text-muted-foreground">
          Eliminate background AC hum, computer fan noise, traffic rumble, and hiss from podcasts and voiceovers. 100% client-side privacy.
        </p>
      </div>

      {/* Main Studio Grid */}
      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Left: Audio Dropzone & A/B Comparison Player (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-5">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              const f = e.dataTransfer.files?.[0];
              if (f) handleFileUpload(f);
            }}
            className={cn(
              "relative flex flex-col items-center justify-center rounded-2xl border bg-card p-6 min-h-[300px] text-center transition-all",
              isDragging ? "border-sky-500 bg-sky-500/5 ring-2 ring-sky-500/30" : "border-border"
            )}
          >
            {isProcessing ? (
              <div className="flex flex-col items-center justify-center py-12 animate-in fade-in-50">
                <Loader2 className="h-10 w-10 text-sky-400 animate-spin" />
                <p className="mt-4 font-bold text-sm text-foreground">{progressStage}</p>
                <div className="mt-3 w-48 rounded-full bg-muted overflow-hidden h-2">
                  <div
                    className="h-full bg-sky-400 transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <span className="mt-1 text-[11px] text-muted-foreground font-mono">{progressPercent}%</span>
              </div>
            ) : cleanUrl ? (
              <div className="w-full space-y-6">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <div className="flex items-center gap-2">
                    <Headphones className="h-4 w-4 text-sky-400" />
                    <span className="text-sm font-bold text-foreground truncate max-w-xs">{fileName}</span>
                  </div>
                  <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-bold text-emerald-400">
                    Denoised & Enhanced
                  </span>
                </div>

                {/* Instant A/B Toggle Switcher */}
                <div className="flex justify-center">
                  <div className="inline-flex rounded-xl bg-muted p-1">
                    <button
                      type="button"
                      onClick={() => setActivePlayer("original")}
                      className={cn(
                        "rounded-lg px-4 py-1.5 text-xs font-bold transition",
                        activePlayer === "original"
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      Original (Noisy)
                    </button>
                    <button
                      type="button"
                      onClick={() => setActivePlayer("clean")}
                      className={cn(
                        "rounded-lg px-4 py-1.5 text-xs font-bold transition flex items-center gap-1.5",
                        activePlayer === "clean"
                          ? "bg-sky-500 text-white shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <Sparkles className="h-3 w-3" /> Cleaned Audio
                    </button>
                  </div>
                </div>

                {/* Audio Player Element */}
                <div className="rounded-2xl border border-border bg-background/60 p-4">
                  <audio
                    key={activePlayer}
                    controls
                    src={activePlayer === "clean" ? cleanUrl : originalUrl || ""}
                    className="w-full h-11"
                  />
                </div>

                <div className="flex items-center justify-between pt-2">
                  <span className="text-xs text-muted-foreground">
                    Switch between Original and Cleaned to hear the difference.
                  </span>
                  <Button
                    type="button"
                    onClick={downloadCleanAudio}
                    className="gap-2 rounded-xl bg-gradient-to-r from-sky-500 via-teal-500 to-emerald-500 font-bold text-white shadow-md shadow-sky-500/20"
                  >
                    <Download className="h-4 w-4" /> Download Clean WAV
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4 py-8">
                <div className="flex h-14 w-14 mx-auto items-center justify-center rounded-2xl bg-sky-500/10">
                  <Mic className="h-7 w-7 text-sky-400" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground">Upload Audio or Record Voice</h3>
                  <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                    Drag and drop your podcast, voice note, or interview recording (MP3, WAV, M4A, AAC)
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                  <label className="cursor-pointer inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground hover:bg-primary/90 transition shadow-sm">
                    <Upload className="h-3.5 w-3.5" />
                    <span>Upload Audio File</span>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="audio/*"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleFileUpload(f);
                        e.target.value = "";
                      }}
                      className="hidden"
                    />
                  </label>

                  {isRecording ? (
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={stopRecording}
                      className="gap-2 rounded-xl px-4 py-2.5 text-xs font-bold animate-pulse"
                    >
                      <Square className="h-3.5 w-3.5 fill-current" /> Stop & Clean Recording
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={startRecording}
                      className="gap-2 rounded-xl px-4 py-2.5 text-xs font-bold border-sky-500/30 text-sky-400 hover:bg-sky-500/10"
                    >
                      <Mic className="h-3.5 w-3.5" /> Record Microphone
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Presets & DSP Parameter Sliders (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-5">
          <div className="rounded-2xl border border-border bg-card p-5 space-y-6 shadow-sm">
            <div>
              <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                <Sliders className="h-4 w-4 text-sky-400" /> Denoising Presets & Filters
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Tune gating thresholds, frequency cuts, and vocal presence
              </p>
            </div>

            {/* Presets Grid */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                One-Click Profiles
              </label>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {[
                  { id: "podcast", label: "🎙️ Podcast Voice Clean" },
                  { id: "ac-hiss", label: "💨 AC & Fan Hiss" },
                  { id: "hum-killer", label: "⚡ 50/60Hz Hum Killer" },
                  { id: "vocal-boost", label: "✨ Vocal Clarity Boost" },
                  { id: "aggressive", label: "🛡️ Heavy Noise Gate" },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => applyPreset(item.id)}
                    className={cn(
                      "rounded-xl border p-2.5 text-left font-semibold transition cursor-pointer",
                      selectedPreset === item.id
                        ? "border-sky-500 bg-sky-500/10 text-sky-400"
                        : "border-border text-muted-foreground hover:border-border/80 hover:text-foreground"
                    )}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Noise Gate Slider */}
            <div className="space-y-3 pt-2 border-t border-border/50">
              <div className="flex items-center justify-between text-xs">
                <label className="font-bold uppercase tracking-wider text-muted-foreground">
                  Noise Gate Threshold
                </label>
                <span className="font-mono text-sky-400 font-bold">{gateThreshold} dB</span>
              </div>
              <Slider
                value={[gateThreshold]}
                min={-60}
                max={-20}
                step={1}
                onValueChange={([val]) => setGateThreshold(val)}
                onValueCommit={() => file && runDenoise(file)}
              />
              <p className="text-[11px] text-muted-foreground">
                Mutes audio when levels fall below this volume. Higher = more noise blocked.
              </p>
            </div>

            {/* High-Pass Rumble Filter */}
            <div className="space-y-3 pt-2 border-t border-border/50">
              <div className="flex items-center justify-between text-xs">
                <label className="font-bold uppercase tracking-wider text-muted-foreground">
                  Low-Cut Rumble Cutoff
                </label>
                <span className="font-mono text-sky-400 font-bold">{highPass} Hz</span>
              </div>
              <Slider
                value={[highPass]}
                min={40}
                max={160}
                step={5}
                onValueChange={([val]) => setHighPass(val)}
                onValueCommit={() => file && runDenoise(file)}
              />
              <p className="text-[11px] text-muted-foreground">
                Eliminates floor vibrations, desk bumps, and AC sub-bass rumble below this frequency.
              </p>
            </div>

            {/* Vocal Clarity Boost */}
            <div className="space-y-3 pt-2 border-t border-border/50">
              <div className="flex items-center justify-between text-xs">
                <label className="font-bold uppercase tracking-wider text-muted-foreground">
                  Voice Clarity & Presence
                </label>
                <span className="font-mono text-sky-400 font-bold">+{clarityBoost} dB</span>
              </div>
              <Slider
                value={[clarityBoost]}
                min={0}
                max={8}
                step={0.5}
                onValueChange={([val]) => setClarityBoost(val)}
                onValueCommit={() => file && runDenoise(file)}
              />
              <p className="text-[11px] text-muted-foreground">
                Boosts speech intelligibility and crisp articulation around 3.2 kHz.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

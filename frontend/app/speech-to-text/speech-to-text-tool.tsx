"use client";

import * as React from "react";
import { useMutation } from "@tanstack/react-query";
import {
  AlertTriangle,
  AudioLines,
  CircleStop,
  Copy,
  Download,
  FileAudio,
  Loader2,
  Mic,
  ShieldCheck,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { AuthGate } from "@/components/auth-gate";
import { Dropzone } from "@/components/dropzone";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatBytes } from "@/lib/format";
import { downloadBlob } from "@/lib/screenshot";
import { transcribeAudio } from "@/lib/speech";
import { autoFormatTranscript } from "@/lib/speech-formatter";
import { cn } from "@/lib/utils";

const LANGUAGES = [
  { code: "en-US", label: "English (US)" },
  { code: "en-GB", label: "English (UK)" },
  { code: "ur-PK", label: "Urdu (Pakistan)" },
  { code: "hi-IN", label: "Hindi (India)" },
  { code: "ar-SA", label: "Arabic (Saudi Arabia)" },
  { code: "es-ES", label: "Spanish (Spain)" },
  { code: "fr-FR", label: "French (France)" },
  { code: "de-DE", label: "German (Germany)" },
  { code: "zh-CN", label: "Chinese (Mandarin, Simplified)" },
  { code: "ja-JP", label: "Japanese" },
  { code: "ru-RU", label: "Russian" },
  { code: "pt-BR", label: "Portuguese (Brazil)" },
  { code: "it-IT", label: "Italian" },
  { code: "tr-TR", label: "Turkish" },
  { code: "ko-KR", label: "Korean" },
  { code: "bn-BD", label: "Bengali (Bangladesh)" },
  { code: "id-ID", label: "Indonesian" },
  { code: "vi-VN", label: "Vietnamese" },
  { code: "fa-IR", label: "Persian" },
  { code: "pa-IN", label: "Punjabi" },
];

const MAX_RECORDING_SECONDS = 120;
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

const ACCEPT =
  "audio/*,video/*,.m4a,.mp3,.wav,.ogg,.oga,.opus,.flac,.webm,.mp4,.mov,.mkv,.avi";

function clock(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function fileBaseName(name: string): string {
  return name.replace(/\.[^.]+$/, "") || "transcript";
}

export function SpeechToTextTool() {
  const [file, setFile] = React.useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [recording, setRecording] = React.useState(false);
  const [elapsed, setElapsed] = React.useState(0);

  const previewRef = React.useRef<string | null>(null);
  const recorderRef = React.useRef<MediaRecorder | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const chunksRef = React.useRef<Blob[]>([]);
  const timerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedRef = React.useRef(0);

  const [language, setLanguage] = React.useState<string>("en-US");

  const transcribe = useMutation({
    mutationFn: (input: File) => transcribeAudio(input, language),
    onSuccess: (data) => {
      if (data.text.trim()) toast.success("Transcription ready.");
      else toast.info("No recognizable speech was found in this recording.");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Could not transcribe this file.");
    },
  });

  const stopTracks = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  const clearTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  };

  const pickFile = (next: File) => {
    if (next.size > MAX_UPLOAD_BYTES) {
      toast.error("Files must be 50 MB or smaller.");
      return;
    }
    transcribe.reset();
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    const url = URL.createObjectURL(next);
    previewRef.current = url;
    setPreviewUrl(url);
    setFile(next);
  };

  const stopRecording = () => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
  };

  const startRecording = async () => {
    if (recording || recorderRef.current?.state === "recording") return;

    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      toast.error("Microphone recording is not supported in this browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const preferred = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"];
      const mimeType = preferred.find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        clearTimer();
        stopTracks();
        setRecording(false);

        const type = recorder.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type });
        chunksRef.current = [];

        if (blob.size === 0) {
          toast.error("No audio was captured.");
          return;
        }

        const ext = type.includes("ogg") ? "ogg" : type.includes("mp4") ? "m4a" : "webm";
        const recorded = new File([blob], `recording-${Date.now()}.${ext}`, { type });
        pickFile(recorded);
        transcribe.mutate(recorded);
      };

      elapsedRef.current = 0;
      setElapsed(0);
      recorder.start(250);
      setRecording(true);
      timerRef.current = setInterval(() => {
        elapsedRef.current += 1;
        setElapsed(elapsedRef.current);
        if (elapsedRef.current >= MAX_RECORDING_SECONDS && recorder.state !== "inactive") {
          recorder.stop();
        }
      }, 1000);
    } catch {
      stopTracks();
      toast.error("Could not access the microphone. Check your browser permissions.");
    }
  };

  const clearFile = () => {
    transcribe.reset();
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = null;
    setPreviewUrl(null);
    setFile(null);
    setElapsed(0);
  };

  React.useEffect(() => {
    return () => {
      clearTimer();
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        recorder.onstop = null;
        recorder.stop();
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    };
  }, []);

  const result = transcribe.data;
  const hasText = Boolean(result?.text.trim());
  const [autoPunctuate, setAutoPunctuate] = React.useState<boolean>(true);

  const formattedData = React.useMemo(() => {
    if (!result?.text) return null;
    return autoFormatTranscript(result.text, language);
  }, [result?.text, language]);

  const activeText =
    autoPunctuate && formattedData?.formattedText
      ? formattedData.formattedText
      : result?.text ?? "";

  const copyTranscript = async () => {
    if (!activeText) return;
    try {
      await navigator.clipboard.writeText(activeText);
      toast.success("Transcript copied.");
    } catch {
      toast.error("Could not copy the transcript.");
    }
  };

  const downloadTranscript = () => {
    if (!activeText) return;
    const name = file ? `${fileBaseName(file.name)}-transcript.txt` : "transcript.txt";
    downloadBlob(new Blob([activeText], { type: "text/plain;charset=utf-8" }), name);
  };

  return (
    <AuthGate>
      <div className="mx-auto max-w-[1280px] px-4 py-8 sm:px-6 md:py-10">
        <div className="mb-6">
          <h1 className="font-display text-3xl font-semibold leading-tight tracking-[-0.01em] text-balance sm:text-[32px] md:text-4xl">
            Speech to Text
          </h1>
          <p className="mt-2 max-w-2xl text-on-surface-variant">
            Upload a recording or capture your microphone and turn it into editable text with the
            Windows speech recognizer. Copy the transcript or save it as a text file.
          </p>
        </div>

        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-primary/20 bg-primary-container/5 p-4">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary-container" />
          <p className="text-sm text-on-surface-variant">
            <span className="font-display font-semibold text-foreground">Global Multi-Language Speech to Text.</span>{" "}
            Transcribe audio or microphone recordings into text in English, Urdu, Hindi, Arabic,
            Spanish, French, German, Chinese, Japanese, and dozens of other languages.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <section className="flex flex-col gap-4 lg:col-span-8">
            <div className="rounded-2xl border border-outline-variant/10 bg-surface-container-lowest p-5 shadow-sm">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="flex items-center gap-2 font-display text-xl font-medium">
                  <FileAudio className="h-5 w-5 text-on-surface-variant" />
                  Audio source
                </h2>
                <div className="flex items-center gap-2">
                  <label htmlFor="stt-lang" className="text-xs font-semibold text-on-surface-variant">
                    Language:
                  </label>
                  <Select value={language} onValueChange={setLanguage}>
                    <SelectTrigger id="stt-lang" className="h-8 w-48 text-xs">
                      <SelectValue placeholder="Language" />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      {LANGUAGES.map((l) => (
                        <SelectItem key={l.code} value={l.code}>
                          {l.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {!file ? (
                <>
                  <Dropzone
                    kind="audio"
                    accept={ACCEPT}
                    multiple={false}
                    onFiles={(files) => {
                      if (files[0]) pickFile(files[0]);
                    }}
                  />
                  <p className="mt-3 text-center text-sm text-on-surface-variant">
                    WAV, MP3, M4A, OGG, FLAC, WEBM or the audio track of a video · up to 50 MB
                  </p>
                </>
              ) : (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-3 rounded-xl border border-outline-variant/20 bg-muted/40 p-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary-container/10 text-primary">
                      <FileAudio className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-display text-sm font-semibold">{file.name}</p>
                      <p className="font-mono text-xs text-on-surface-variant">
                        {formatBytes(file.size)}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="shrink-0 gap-1.5"
                      onClick={() => {
                        if (recording) stopRecording();
                        clearFile();
                      }}
                      disabled={transcribe.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                      Remove
                    </Button>
                  </div>

                  {previewUrl && (
                    <audio controls src={previewUrl} className="w-full" preload="metadata">
                      Your browser does not support the audio element.
                    </audio>
                  )}

                  <div className="flex flex-wrap gap-2">
                    <Button
                      className="gap-2"
                      disabled={transcribe.isPending || recording}
                      onClick={() => transcribe.mutate(file)}
                    >
                      {transcribe.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <AudioLines className="h-4 w-4" />
                      )}
                      {transcribe.isPending ? "Transcribing…" : "Transcribe"}
                    </Button>
                    <Button
                      variant="outline"
                      className="gap-2"
                      onClick={() => {
                        clearFile();
                      }}
                      disabled={transcribe.isPending || recording}
                    >
                      Choose another file
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {transcribe.isPending && (
              <div className="flex items-center gap-3 rounded-2xl border border-outline-variant/10 bg-surface-container-lowest p-5 text-sm text-on-surface-variant shadow-sm">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                Listening for speech… longer recordings can take a little while.
              </div>
            )}

            {result && !transcribe.isPending && (
              <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
                    <AudioLines className="h-5 w-5 text-emerald-500" />
                    Transcript
                  </h2>
                  <div className="flex flex-wrap items-center gap-1.5 font-mono text-[11px] text-on-surface-variant">
                    {formattedData?.detectedLanguage && (
                      <span className="rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400 font-semibold px-2.5 py-1">
                        Detected: {formattedData.detectedLanguage}
                      </span>
                    )}
                    {result.confidence != null && (
                      <span className="rounded-full bg-muted px-2.5 py-1">
                        {Math.round(result.confidence * 100)}% confidence
                      </span>
                    )}
                    <span className="rounded-full bg-muted px-2.5 py-1">
                      {result.text.trim().split(/\s+/).filter(Boolean).length} words
                    </span>
                    <Button
                      size="sm"
                      variant={autoPunctuate ? "default" : "outline"}
                      className="h-7 text-[11px] gap-1 px-2.5 ml-1"
                      onClick={() => setAutoPunctuate(!autoPunctuate)}
                    >
                      <Sparkles className="h-3 w-3 text-amber-400" />
                      {autoPunctuate ? "Auto-Punctuate: ON" : "Raw ASR"}
                    </Button>
                  </div>
                </div>

                {hasText ? (
                  <>
                    <textarea
                      readOnly
                      value={activeText}
                      rows={10}
                      aria-label="Transcript"
                      className="mt-4 min-h-[220px] w-full resize-y rounded-xl border border-outline-variant/30 bg-background px-4 py-3 text-sm leading-relaxed text-foreground outline-none focus:border-primary/60"
                    />
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button variant="outline" className="gap-2" onClick={() => void copyTranscript()}>
                        <Copy className="h-4 w-4" />
                        Copy transcript
                      </Button>
                      <Button variant="outline" className="gap-2" onClick={downloadTranscript}>
                        <Download className="h-4 w-4" />
                        Download .txt
                      </Button>
                    </div>
                  </>
                ) : (
                  <p className="mt-4 flex items-start gap-2 rounded-xl bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    No recognizable speech was found. Try a clearer recording, reduce background
                    noise, or make sure a speech language is installed in Windows Settings.
                  </p>
                )}

                <p className="mt-3 font-mono text-xs text-on-surface-variant">{result.engine}</p>
              </div>
            )}
          </section>

          <aside className="flex flex-col gap-4 lg:col-span-4">
            <div className="rounded-2xl border border-outline-variant/10 bg-surface-container-lowest p-5 shadow-sm">
              <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
                <Mic className="h-5 w-5 text-on-surface-variant" />
                Record from microphone
              </h2>
              <p className="mt-1.5 text-sm text-on-surface-variant">
                Capture a note or voice memo and transcribe it automatically.
              </p>

              <div
                className={cn(
                  "mt-4 flex items-center justify-between gap-3 rounded-xl border px-4 py-3 transition-colors",
                  recording
                    ? "border-destructive/40 bg-destructive/5"
                    : "border-outline-variant/20 bg-muted/30",
                )}
              >
                <div>
                  <p className="font-mono text-lg tabular-nums text-foreground">{clock(elapsed)}</p>
                  <p className="text-xs text-on-surface-variant">
                    {recording ? "Recording…" : `Maximum ${clock(MAX_RECORDING_SECONDS)}`}
                  </p>
                </div>
                <Button
                  variant={recording ? "destructive" : "default"}
                  className="gap-2"
                  onClick={() => (recording ? stopRecording() : void startRecording())}
                  disabled={transcribe.isPending && !recording}
                >
                  {recording ? (
                    <CircleStop className="h-4 w-4" />
                  ) : (
                    <Mic className="h-4 w-4" />
                  )}
                  {recording ? "Stop" : "Record"}
                </Button>
              </div>

              <p className="mt-3 text-xs text-on-surface-variant">
                Recording stops automatically at two minutes. The browser will ask for microphone
                permission the first time.
              </p>
            </div>

            <div className="rounded-2xl border border-outline-variant/10 bg-surface-container-lowest p-5 shadow-sm">
              <h2 className="font-display text-lg font-semibold">Tips for a clean transcript</h2>
              <ul className="mt-3 space-y-2 text-sm text-on-surface-variant">
                <li>• Record in a quiet room and keep the microphone close.</li>
                <li>• Speak at a steady pace and avoid overlapping voices.</li>
                <li>• Add the speech language in Windows Settings if transcription fails.</li>
                <li>• Audio and video files are processed locally and then deleted.</li>
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </AuthGate>
  );
}

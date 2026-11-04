"use client";

import * as React from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Copy,
  Download,
  Loader2,
  Sparkles,
  Volume2,
} from "lucide-react";
import { toast } from "sonner";

import { AuthGate } from "@/components/auth-gate";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { formatBytes } from "@/lib/format";
import { listSpeechVoices, synthesizeSpeech } from "@/lib/speech";
import type { TtsFormat } from "@/lib/types";

const MAX_CHARS = 5000;

const SAMPLES: { label: string; text: string }[] = [
  {
    label: "Welcome",
    text: "Welcome to PicTools. Resize, convert and polish your photos, documents and video — all in one place, right on your computer.",
  },
  {
    label: "Narration",
    text: "The morning light moved slowly across the studio floor. Outside, the city was waking up, and inside, the work was just beginning.",
  },
  {
    label: "Accessibility",
    text: "This article is also available as audio. Use the player to pause, rewind, or download the narration for listening later.",
  },
];

interface SpeechResult {
  url: string;
  filename: string;
  format: TtsFormat;
  size: number;
}

export function TextToSpeechTool() {
  const { status } = useAuth();
  const voicesQuery = useQuery({
    queryKey: ["speech", "voices"],
    queryFn: listSpeechVoices,
    staleTime: 5 * 60_000,
    enabled: status === "authed",
  });

  const [text, setText] = React.useState("");
  const [voice, setVoice] = React.useState("");
  const [rate, setRate] = React.useState(0);
  const [volume, setVolume] = React.useState(100);
  const [format, setFormat] = React.useState<TtsFormat>("wav");
  const [result, setResult] = React.useState<SpeechResult | null>(null);
  const urlRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    return () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, []);

  const generate = useMutation({
    mutationFn: () =>
      synthesizeSpeech({
        text: text.trim(),
        voice: voice || undefined,
        rate,
        volume,
        format,
      }),
    onSuccess: ({ blob, filename, format: outputFormat }) => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      const url = URL.createObjectURL(blob);
      urlRef.current = url;
      setResult({ url, filename, format: outputFormat, size: blob.size });
      toast.success("Speech generated.");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Could not generate speech.");
    },
  });

  const voices = voicesQuery.data ?? [];
  const [selectedLanguage, setSelectedLanguage] = React.useState<string>("all");
  const [voiceSearch, setVoiceSearch] = React.useState<string>("");

  const languageOptions = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const v of voices) {
      const code = v.culture?.split("-")[0]?.toLowerCase() || v.culture;
      const label = v.localeName || v.culture;
      // Get country/language name before parentheses
      const cleanLabel = label.split("(")[0]?.trim() || label;
      if (!map.has(code)) {
        map.set(code, cleanLabel);
      }
    }
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [voices]);

  const filteredVoices = React.useMemo(() => {
    return voices.filter((v) => {
      if (selectedLanguage !== "all") {
        const code = v.culture?.split("-")[0]?.toLowerCase();
        if (code !== selectedLanguage.toLowerCase()) return false;
      }
      if (voiceSearch.trim()) {
        const query = voiceSearch.toLowerCase();
        const matchesName = v.name.toLowerCase().includes(query);
        const matchesDesc = v.description.toLowerCase().includes(query);
        const matchesLocale = (v.localeName || v.culture).toLowerCase().includes(query);
        if (!matchesName && !matchesDesc && !matchesLocale) return false;
      }
      return true;
    });
  }, [voices, selectedLanguage, voiceSearch]);

  const tooLong = text.length > MAX_CHARS;
  const canGenerate = text.trim().length > 0 && !tooLong && !generate.isPending;

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Text copied.");
    } catch {
      toast.error("Could not copy the text.");
    }
  };

  return (
    <AuthGate>
      <div className="mx-auto max-w-[1280px] px-4 py-8 sm:px-6 md:py-10">
        <div className="mb-6">
          <h1 className="font-display text-3xl font-semibold leading-tight tracking-[-0.01em] text-balance sm:text-[32px] md:text-4xl">
            Text to Speech
          </h1>
          <p className="mt-2 max-w-2xl text-on-surface-variant">
            Turn a script, article or note into spoken audio using the voices installed on this
            PC. Choose a voice, adjust the delivery, then download the result.
          </p>
        </div>

        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-primary/20 bg-primary-container/5 p-4">
          <Volume2 className="mt-0.5 h-5 w-5 shrink-0 text-primary-container" />
          <p className="text-sm text-on-surface-variant">
            <span className="font-display font-semibold text-foreground">Global Multi-Language TTS.</span>{" "}
            320+ natural neural voices across all major world languages (English, Urdu, Hindi, Arabic,
            Spanish, French, German, Chinese, Japanese, and more) plus local offline fallback.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <section className="flex flex-col gap-4 lg:col-span-7">
            <div className="rounded-2xl border border-outline-variant/10 bg-surface-container-lowest p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 font-display text-xl font-medium">
                  <Volume2 className="h-5 w-5 text-on-surface-variant" />
                  Your text
                </h2>
                <div className="flex flex-wrap items-center gap-1.5">
                  {SAMPLES.map((sample) => (
                    <button
                      key={sample.label}
                      type="button"
                      onClick={() => setText(sample.text)}
                      className="rounded-full border border-outline-variant/20 px-2.5 py-1 font-mono text-[11px] text-on-surface-variant transition-colors hover:border-primary-container hover:text-foreground"
                    >
                      {sample.label}
                    </button>
                  ))}
                </div>
              </div>

              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={12}
                placeholder="Type or paste the text you want to hear…"
                aria-label="Text to convert to speech"
                className="mt-4 min-h-[260px] w-full resize-y rounded-xl border border-outline-variant/30 bg-muted px-4 py-3 text-sm leading-relaxed text-foreground outline-none focus:border-primary/60"
              />

              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-on-surface-variant">
                <span>
                  {tooLong
                    ? "Shorten the text to fit the limit."
                    : "Punctuation helps the voice sound natural."}
                </span>
                <span className={tooLong ? "font-mono text-destructive" : "font-mono"}>
                  {text.length.toLocaleString()} / {MAX_CHARS.toLocaleString()}
                </span>
              </div>
            </div>

            {result && (
              <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
                    <Volume2 className="h-5 w-5 text-emerald-500" />
                    Your audio
                  </h2>
                  <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 font-mono text-[11px] font-semibold uppercase text-emerald-600 dark:text-emerald-400">
                    {result.format} · {formatBytes(result.size)}
                  </span>
                </div>

                <audio controls src={result.url} className="mt-4 w-full" preload="metadata">
                  Your browser does not support the audio element.
                </audio>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button asChild className="gap-2">
                    <a href={result.url} download={result.filename}>
                      <Download className="h-4 w-4" />
                      Download {result.format.toUpperCase()}
                    </a>
                  </Button>
                  <Button
                    variant="outline"
                    className="gap-2"
                    onClick={() => void copyText()}
                    disabled={!text.trim()}
                  >
                    <Copy className="h-4 w-4" />
                    Copy text
                  </Button>
                </div>
                <p className="mt-3 truncate font-mono text-xs text-on-surface-variant">
                  {result.filename}
                </p>
              </div>
            )}
          </section>

          <aside className="flex flex-col gap-4 lg:col-span-5">
            <div className="flex flex-col gap-5 rounded-2xl border border-outline-variant/10 bg-surface-container-lowest p-5 shadow-sm">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="tts-language"
                    className="font-display text-[13px] font-semibold text-on-surface-variant"
                  >
                    Language
                  </label>
                  <span className="font-mono text-xs text-on-surface-variant">
                    {languageOptions.length} languages
                  </span>
                </div>
                <Select
                  value={selectedLanguage}
                  onValueChange={(val) => {
                    setSelectedLanguage(val);
                    setVoice("");
                  }}
                >
                  <SelectTrigger id="tts-language">
                    <SelectValue placeholder="All Languages" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    <SelectItem value="all">All Languages (320+ voices)</SelectItem>
                    {languageOptions.map(([code, label]) => (
                      <SelectItem key={code} value={code}>
                        {label} ({code.toUpperCase()})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="tts-voice"
                      className="font-display text-[13px] font-semibold text-on-surface-variant"
                    >
                      Voice &amp; Character
                    </label>
                    <span className="font-mono text-xs text-on-surface-variant">
                      {filteredVoices.length} available
                    </span>
                  </div>

                  <input
                    type="text"
                    value={voiceSearch}
                    onChange={(e) => setVoiceSearch(e.target.value)}
                    placeholder="Search voice name or accent..."
                    className="mb-2 h-9 w-full rounded-lg border border-outline-variant/30 bg-muted px-3 text-xs text-foreground placeholder:text-on-surface-variant/50 focus:border-primary/60 focus:outline-none"
                  />

                  <Select
                    value={voice || "default"}
                    onValueChange={(value) => setVoice(value === "default" ? "" : value)}
                  >
                    <SelectTrigger id="tts-voice">
                      <SelectValue placeholder="Select a voice" />
                    </SelectTrigger>
                    <SelectContent className="max-h-80">
                      <SelectItem value="default">
                        System default{filteredVoices.length === 0 ? " (no voices match)" : ""}
                      </SelectItem>
                      {filteredVoices.map((item) => (
                        <SelectItem key={item.name} value={item.name}>
                          <span className="font-medium">{item.name}</span>
                          <span className="ml-1.5 font-mono text-[11px] text-on-surface-variant">
                            · {item.gender} · {item.localeName || item.culture}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {voicesQuery.isLoading ? (
                  <p className="flex items-center gap-1.5 text-xs text-on-surface-variant">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Loading global voice catalog…
                  </p>
                ) : voicesQuery.isError ? (
                  <p className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    Global voices could not be loaded. Generation will use local fallback.
                  </p>
                ) : (
                  <p className="text-xs text-on-surface-variant">
                    {filteredVoices.length} of {voices.length} neural voices match filter.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-display text-[13px] font-semibold text-on-surface-variant">
                    Speaking rate
                  </label>
                  <span className="font-mono text-xs text-on-surface-variant">
                    {rate === 0 ? "Normal" : `${rate > 0 ? "+" : ""}${rate}`}
                  </span>
                </div>
                <Slider
                  value={[rate]}
                  onValueChange={(values) => setRate(values[0] ?? 0)}
                  min={-10}
                  max={10}
                  step={1}
                  aria-label="Speaking rate"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-display text-[13px] font-semibold text-on-surface-variant">
                    Volume
                  </label>
                  <span className="font-mono text-xs text-on-surface-variant">{volume}%</span>
                </div>
                <Slider
                  value={[volume]}
                  onValueChange={(values) => setVolume(values[0] ?? 100)}
                  min={0}
                  max={100}
                  step={5}
                  aria-label="Volume"
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="tts-format"
                  className="font-display text-[13px] font-semibold text-on-surface-variant"
                >
                  Output format
                </label>
                <Select value={format} onValueChange={(value) => setFormat(value as TtsFormat)}>
                  <SelectTrigger id="tts-format">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mp3">MP3 — smaller file</SelectItem>
                    <SelectItem value="wav">WAV — lossless</SelectItem>
                  </SelectContent>
                </Select>
                {format === "mp3" && (
                  <p className="text-xs text-on-surface-variant">
                    MP3 export uses FFmpeg. If it is not installed, choose WAV.
                  </p>
                )}
              </div>

              <Button
                className="w-full gap-2 rounded-xl py-3"
                disabled={!canGenerate}
                onClick={() => generate.mutate()}
              >
                {generate.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                {generate.isPending ? "Generating…" : "Generate speech"}
              </Button>

              <p className="border-t border-outline-variant/10 pt-4 text-xs text-on-surface-variant">
                Audio is created on demand and kept only long enough for the download. Nothing is
                stored permanently.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </AuthGate>
  );
}

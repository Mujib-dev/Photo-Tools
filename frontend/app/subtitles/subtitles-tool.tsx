"use client";

import React, { useState, useRef, useEffect, useId } from "react";
import {
  FileVideo,
  Play,
  Pause,
  Upload,
  Download,
  Plus,
  Trash2,
  Sparkles,
  Subtitles,
  Palette,
  Clock,
  Copy,
  Check,
  Camera,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import {
  SubtitleCue,
  CaptionPresetStyle,
  CAPTION_PRESETS,
  exportSrt,
  exportVtt,
  parseSrt,
  autoGenerateCuesFromTranscript,
  drawCaptionsOnCanvas,
  formatTimestampSrt,
} from "@/lib/video-subtitles";

export function SubtitlesTool() {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState<number>(0);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  // Subtitle cues
  const [cues, setCues] = useState<SubtitleCue[]>([
    { id: "cue-1", startTime: 0.5, endTime: 2.5, text: "Stop scrolling and check this out" },
    { id: "cue-2", startTime: 2.8, endTime: 5.2, text: "Auto generated viral captions in seconds" },
    { id: "cue-3", startTime: 5.5, endTime: 8.0, text: "Export clean SRT or burned subtitles" },
  ]);

  // Caption Styling
  const [selectedPreset, setSelectedPreset] = useState<CaptionPresetStyle>("viral-yellow");
  const [fontSizePercent, setFontSizePercent] = useState<number>(5.0);
  const [positionYPercent, setPositionYPercent] = useState<number>(78);
  const [transcriptDraft, setTranscriptDraft] = useState<string>("");
  const [copied, setCopied] = useState<boolean>(false);
  const [isRecognizing, setIsRecognizing] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const srtInputRef = useRef<HTMLInputElement | null>(null);

  const fileInputId = useId();
  const srtInputId = useId();

  // Active cue matching current video time
  const activeCue = cues.find((c) => currentTime >= c.startTime && currentTime <= c.endTime);

  // Handle video upload
  const handleVideoSelect = (file: File) => {
    if (!file.type.startsWith("video/")) {
      toast.error("Please upload a valid video file (MP4, WebM, MOV)");
      return;
    }
    if (videoSrc) URL.revokeObjectURL(videoSrc);
    const url = URL.createObjectURL(file);
    setVideoFile(file);
    setVideoSrc(url);
    setIsPlaying(false);
    toast.success(`Loaded video: ${file.name}`);
  };

  // Video metadata loaded
  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setVideoDuration(videoRef.current.duration || 0);
    }
  };

  // Synchronized playback canvas loop
  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const renderFrame = () => {
      const ctx = canvas.getContext("2d");
      if (ctx && video.videoWidth && video.videoHeight) {
        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
        }

        // Draw video frame
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Draw styled captions overlay
        const style = {
          ...CAPTION_PRESETS[selectedPreset],
          fontSizePercent,
          positionYPercent,
        };
        const active = cues.find(
          (c) => video.currentTime >= c.startTime && video.currentTime <= c.endTime
        );
        drawCaptionsOnCanvas(ctx, active, style, canvas.width, canvas.height);
      }
      animationFrameRef.current = requestAnimationFrame(renderFrame);
    };

    renderFrame();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [videoSrc, selectedPreset, fontSizePercent, positionYPercent, cues]);

  // Video time update
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  // Toggle Play / Pause
  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  // Seek video
  const handleSeek = (time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  // Add Cue
  const handleAddCue = () => {
    const start = Math.round(currentTime * 10) / 10;
    const end = Math.round((start + 2.5) * 10) / 10;
    const newCue: SubtitleCue = {
      id: `cue-${Date.now()}`,
      startTime: start,
      endTime: end,
      text: "New animated caption",
    };
    setCues((prev) => [...prev, newCue].sort((a, b) => a.startTime - b.startTime));
    toast.success("Added new caption card");
  };

  // Update Cue
  const handleUpdateCue = (id: string, field: keyof SubtitleCue, val: string | number) => {
    setCues((prev) =>
      prev.map((c) => (c.id === id ? { ...c, [field]: val } : c))
    );
  };

  // Delete Cue
  const handleDeleteCue = (id: string) => {
    setCues((prev) => prev.filter((c) => c.id !== id));
  };

  // Auto Generate Cues from Transcript text
  const handleGenerateFromTranscript = () => {
    if (!transcriptDraft.trim()) {
      toast.error("Please enter or paste your video script/transcript first.");
      return;
    }
    const duration = videoDuration > 0 ? videoDuration : 15;
    const generated = autoGenerateCuesFromTranscript(transcriptDraft, duration);
    if (generated.length > 0) {
      setCues(generated);
      toast.success(`Generated ${generated.length} caption cards distributed across duration!`);
    }
  };

  // Web Speech Recognition for live transcribing
  const handleStartSpeechRecognition = () => {
    const SpeechRecognition =
      (window as unknown as { SpeechRecognition?: any }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: any }).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      toast.error("Browser speech recognition is not supported in this browser. You can type or paste your transcript directly.");
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.lang = "en-US";

      setIsRecognizing(true);
      toast.info("Listening to your microphone... speak clearly.");

      recognition.onresult = (event: any) => {
        let text = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          text += event.results[i][0].transcript + " ";
        }
        setTranscriptDraft((prev) => (prev ? prev + " " + text.trim() : text.trim()));
      };

      recognition.onerror = () => {
        setIsRecognizing(false);
        toast.error("Speech recognition stopped.");
      };

      recognition.onend = () => {
        setIsRecognizing(false);
      };

      recognition.start();
    } catch {
      setIsRecognizing(false);
      toast.error("Could not start speech recognition.");
    }
  };

  // Export SRT
  const handleDownloadSrt = () => {
    if (cues.length === 0) {
      toast.error("No subtitle cues to export.");
      return;
    }
    const srt = exportSrt(cues);
    const blob = new Blob([srt], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = videoFile ? `${videoFile.name.replace(/\.[^/.]+$/, "")}.srt` : "subtitles.srt";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Downloaded .SRT subtitle file!");
  };

  // Export VTT
  const handleDownloadVtt = () => {
    if (cues.length === 0) {
      toast.error("No subtitle cues to export.");
      return;
    }
    const vtt = exportVtt(cues);
    const blob = new Blob([vtt], { type: "text/vtt;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = videoFile ? `${videoFile.name.replace(/\.[^/.]+$/, "")}.vtt` : "subtitles.vtt";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Downloaded .VTT subtitle file!");
  };

  // Import SRT file
  const handleImportSrt = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = parseSrt(text);
      if (parsed.length > 0) {
        setCues(parsed);
        toast.success(`Imported ${parsed.length} cues from ${file.name}`);
      } else {
        toast.error("Could not parse any valid timecode cues from this SRT file.");
      }
    };
    reader.readAsText(file);
  };

  // Snapshot current frame with caption
  const handleSnapshotFrame = () => {
    if (!canvasRef.current) return;
    const url = canvasRef.current.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `captioned-frame-${Math.round(currentTime)}s.png`;
    a.click();
    toast.success("Saved high-res captioned frame snapshot!");
  };

  // Copy full transcript text
  const handleCopyTranscript = () => {
    const fullText = cues.map((c) => c.text).join(" ");
    navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Copied full transcript to clipboard!");
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-sky-500/20 bg-sky-500/10 px-3 py-1 text-xs font-semibold text-sky-400">
          <Subtitles className="h-3.5 w-3.5" />
          Social Reels & Creator Studio
        </div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Auto Video Subtitle & Animated Caption Studio
        </h1>
        <p className="mt-2 text-sm text-muted-foreground sm:text-base">
          Generate, edit, and burn viral TikTok/Reels captions onto videos. Export standard .SRT or .VTT files with zero cloud upload.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Left Column: Video & Live Canvas Preview */}
        <div className="space-y-4 lg:col-span-7">
          <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-border/60 bg-black/90 shadow-2xl flex items-center justify-center">
            {videoSrc ? (
              <>
                <video
                  ref={videoRef}
                  src={videoSrc}
                  className="hidden"
                  onLoadedMetadata={handleLoadedMetadata}
                  onTimeUpdate={handleTimeUpdate}
                  onEnded={() => setIsPlaying(false)}
                  playsInline
                />
                <canvas
                  ref={canvasRef}
                  className="max-h-full max-w-full object-contain cursor-pointer"
                  onClick={togglePlay}
                />
              </>
            ) : (
              <div
                className="flex flex-col items-center justify-center p-8 text-center cursor-pointer hover:bg-neutral-900/60 transition w-full h-full"
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="rounded-full bg-sky-500/10 p-4 text-sky-400 mb-3">
                  <FileVideo className="h-8 w-8" />
                </div>
                <p className="text-base font-semibold text-foreground">Drop a video here, or click to upload</p>
                <p className="mt-1 text-xs text-muted-foreground">MP4, WebM, MOV, MKV up to 500MB</p>
              </div>
            )}

            {/* Hidden Video Input */}
            <input
              id={fileInputId}
              ref={fileInputRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleVideoSelect(e.target.files[0])}
            />
          </div>

          {/* Video Playback Controls Bar */}
          {videoSrc && (
            <div className="rounded-xl border border-border/60 bg-card p-4 space-y-3">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={togglePlay}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow hover:opacity-90 transition"
                  aria-label={isPlaying ? "Pause video" : "Play video"}
                >
                  {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
                </button>

                <div className="flex-1 space-y-1">
                  <input
                    type="range"
                    min={0}
                    max={videoDuration || 100}
                    step={0.1}
                    value={currentTime}
                    onChange={(e) => handleSeek(parseFloat(e.target.value))}
                    className="w-full h-2 rounded-lg bg-neutral-200 dark:bg-neutral-800 accent-primary cursor-pointer"
                  />
                  <div className="flex justify-between text-xs font-mono text-muted-foreground">
                    <span>{formatTimestampSrt(currentTime).split(",")[0]}</span>
                    <span>{formatTimestampSrt(videoDuration).split(",")[0]}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSnapshotFrame}
                  title="Capture Frame with Captions"
                  className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-xs font-medium text-foreground hover:bg-muted transition"
                >
                  <Camera className="h-3.5 w-3.5" />
                  Frame
                </button>
              </div>

              {/* Active Caption Callout */}
              <div className="rounded-lg border border-border/40 bg-muted/20 px-3 py-2 text-center">
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block mb-0.5">
                  Current Subtitle at this second:
                </span>
                <p className="text-sm font-semibold text-foreground">
                  {activeCue ? `"${activeCue.text}"` : <span className="italic text-muted-foreground/60">(No caption active at this second)</span>}
                </p>
              </div>
            </div>
          )}

          {/* Caption Style Customization */}
          <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Palette className="h-4 w-4 text-sky-400" />
              <h3 className="text-sm font-semibold text-foreground">Caption Visual Style</h3>
            </div>

            {/* Presets */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(Object.keys(CAPTION_PRESETS) as CaptionPresetStyle[]).map((presetKey) => {
                const preset = CAPTION_PRESETS[presetKey];
                const active = selectedPreset === presetKey;
                return (
                  <button
                    key={presetKey}
                    type="button"
                    onClick={() => setSelectedPreset(presetKey)}
                    className={`rounded-xl border p-2.5 text-left transition ${
                      active
                        ? "border-sky-500 bg-sky-500/10 text-foreground ring-1 ring-sky-500/40"
                        : "border-border/60 bg-card hover:bg-muted/40 text-muted-foreground"
                    }`}
                  >
                    <div className="text-xs font-bold leading-tight">{preset.name.split("(")[0]}</div>
                    <div className="text-[10px] text-muted-foreground/80 mt-1">{preset.name.split("(")[1]?.replace(")", "") || ""}</div>
                  </button>
                );
              })}
            </div>

            {/* Controls: Size and Position */}
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Font Size ({fontSizePercent}%)
                </label>
                <input
                  type="range"
                  min={2.5}
                  max={8.5}
                  step={0.5}
                  value={fontSizePercent}
                  onChange={(e) => setFontSizePercent(parseFloat(e.target.value))}
                  className="w-full accent-primary cursor-pointer"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Vertical Height ({positionYPercent}%)
                </label>
                <input
                  type="range"
                  min={30}
                  max={90}
                  step={2}
                  value={positionYPercent}
                  onChange={(e) => setPositionYPercent(parseFloat(e.target.value))}
                  className="w-full accent-primary cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Cues Editor & Auto Generator */}
        <div className="space-y-4 lg:col-span-5">
          {/* Transcript / AI Auto Generator Card */}
          <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-400" />
                <h3 className="text-sm font-semibold text-foreground">Auto-Generate Subtitles</h3>
              </div>
              <button
                type="button"
                onClick={handleStartSpeechRecognition}
                className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium border transition ${
                  isRecognizing
                    ? "border-red-500 bg-red-500/20 text-red-400 animate-pulse"
                    : "border-border/60 bg-muted/40 hover:bg-muted text-foreground"
                }`}
              >
                🎙️ {isRecognizing ? "Listening..." : "Mic Dictate"}
              </button>
            </div>

            <textarea
              rows={3}
              placeholder="Paste your voiceover script or video transcript here..."
              value={transcriptDraft}
              onChange={(e) => setTranscriptDraft(e.target.value)}
              className="w-full rounded-xl border border-border/60 bg-background p-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            />

            <button
              type="button"
              onClick={handleGenerateFromTranscript}
              className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground shadow hover:opacity-90 transition"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Slice into Subtitle Cards
            </button>
          </div>

          {/* Subtitle Cue List Table */}
          <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-sky-400" />
                <h3 className="text-sm font-semibold text-foreground">
                  Subtitle Cues ({cues.length})
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleAddCue}
                  className="flex items-center gap-1 rounded-lg border border-border/60 bg-muted/40 px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted transition"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => srtInputRef.current?.click()}
                  className="flex items-center gap-1 rounded-lg border border-border/60 bg-muted/40 px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted transition"
                  title="Import existing .SRT file"
                >
                  <Upload className="h-3.5 w-3.5" />
                  Import
                </button>
                <input
                  id={srtInputId}
                  ref={srtInputRef}
                  type="file"
                  accept=".srt"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleImportSrt(e.target.files[0])}
                />
              </div>
            </div>

            {/* Cue Cards Container */}
            <div className="max-h-[320px] space-y-2.5 overflow-y-auto pr-1">
              {cues.map((cue, idx) => (
                <div
                  key={cue.id}
                  className={`rounded-xl border p-3 transition ${
                    activeCue?.id === cue.id
                      ? "border-sky-500/60 bg-sky-500/5 ring-1 ring-sky-500/30"
                      : "border-border/60 bg-background/50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[11px] font-mono text-muted-foreground font-semibold">
                      #{idx + 1}
                    </span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        step={0.1}
                        min={0}
                        value={cue.startTime}
                        onChange={(e) =>
                          handleUpdateCue(cue.id, "startTime", parseFloat(e.target.value) || 0)
                        }
                        className="w-14 rounded-md border border-border/60 bg-background px-1.5 py-0.5 text-center font-mono text-[11px]"
                      />
                      <span className="text-xs text-muted-foreground">→</span>
                      <input
                        type="number"
                        step={0.1}
                        min={0}
                        value={cue.endTime}
                        onChange={(e) =>
                          handleUpdateCue(cue.id, "endTime", parseFloat(e.target.value) || 0)
                        }
                        className="w-14 rounded-md border border-border/60 bg-background px-1.5 py-0.5 text-center font-mono text-[11px]"
                      />
                      <button
                        type="button"
                        onClick={() => handleSeek(cue.startTime)}
                        className="p-1 text-muted-foreground hover:text-foreground transition ml-1"
                        title="Jump to this time"
                      >
                        <Play className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteCue(cue.id)}
                        className="p-1 text-muted-foreground hover:text-red-400 transition"
                        title="Delete caption"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>

                  <input
                    type="text"
                    value={cue.text}
                    onChange={(e) => handleUpdateCue(cue.id, "text", e.target.value)}
                    className="w-full rounded-lg border border-border/60 bg-background px-2.5 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 font-medium"
                  />
                </div>
              ))}
            </div>

            {/* Export & Actions */}
            <div className="pt-2 border-t border-border/40 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleDownloadSrt}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-sky-500/40 bg-sky-500/10 px-3 py-2 text-xs font-semibold text-sky-400 hover:bg-sky-500/20 transition"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download .SRT
                </button>
                <button
                  type="button"
                  onClick={handleDownloadVtt}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-border/60 bg-muted/40 px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted transition"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download .VTT
                </button>
              </div>

              <button
                type="button"
                onClick={handleCopyTranscript}
                className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-border/60 bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied Full Script!" : "Copy Full Text Transcript"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

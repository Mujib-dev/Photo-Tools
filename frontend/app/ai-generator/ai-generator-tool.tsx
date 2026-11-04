"use client";

import * as React from "react";
import Link from "next/link";
import {
  Sparkles,
  Video,
  Image as ImageIcon,
  Wand2,
  Download,
  Play,
  RotateCcw,
  Sliders,
  Check,
  Eye,
  ArrowRight,
  Maximize2,
  RefreshCw,
  Film,
  Camera,
  Clock,
  Loader2,
  Upload,
  Layers,
  HelpCircle,
  Mic,
  MicOff,
  Volume2,
  Square,
  Music,
} from "lucide-react";
import { toast } from "sonner";

import { AuthGate } from "@/components/auth-gate";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  AspectRatio,
  CameraMotion,
  eraseWatermark,
  generateAiImage,
  generateMotionVideo,
  synthesizeAiVoice,
  ImageStyle,
  MOTION_PRESETS,
  STYLE_PRESETS,
} from "@/lib/ai-generator-engine";

const SAMPLE_PROMPTS = [
  "A majestic snow leopard standing on a Himalayan cliff at golden hour, 8k, photorealistic",
  "Futuristic cyberpunk samurai walking through a neon-lit Tokyo alley in light rain",
  "Cozy coffee shop interior on a rainy autumn evening, warm glowing lights, bokeh",
  "A charming baby dragon asleep on a pile of antique gold coins, Pixar 3D style",
  "Ethereal bioluminescent enchanted forest with glowing mushrooms and fairy dust",
  "Classic 1960s red Ferrari driving along the Amalfi coast cliffside highway, 35mm film",
];

const VOICE_LANGUAGES = [
  { code: "en", label: "English (US / UK Natural)" },
  { code: "es", label: "Spanish (Español)" },
  { code: "fr", label: "French (Français)" },
  { code: "de", label: "German (Deutsch)" },
  { code: "it", label: "Italian (Italiano)" },
  { code: "hi", label: "Hindi (हिन्दी)" },
  { code: "ja", label: "Japanese (日本語)" },
  { code: "ar", label: "Arabic (العربية)" },
  { code: "ur", label: "Urdu (اردو)" },
  { code: "zh", label: "Chinese (中文)" },
];

export function AiGeneratorTool() {
  const [activeTab, setActiveTab] = React.useState<"text-to-image" | "image-to-video" | "text-to-video">("text-to-image");

  // --- Text to Image State ---
  const [prompt, setPrompt] = React.useState<string>(SAMPLE_PROMPTS[0]);
  const [style, setStyle] = React.useState<ImageStyle>("photorealistic");
  const [aspectRatio, setAspectRatio] = React.useState<AspectRatio>("1:1");
  const [isGeneratingImage, setIsGeneratingImage] = React.useState<boolean>(false);
  const [generatedImage, setGeneratedImage] = React.useState<{
    dataUrl: string;
    width: number;
    height: number;
    seed: number;
    prompt: string;
  } | null>(null);

  // --- Image to Video State ---
  const [videoSourceImage, setVideoSourceImage] = React.useState<string | null>(null);
  const [videoMotion, setVideoMotion] = React.useState<CameraMotion>("dolly-in");
  const [videoDuration, setVideoDuration] = React.useState<number>(4);
  const [videoFps, setVideoFps] = React.useState<number>(30);
  const [isGeneratingVideo, setIsGeneratingVideo] = React.useState<boolean>(false);
  const [videoProgress, setVideoProgress] = React.useState<number>(0);
  const [generatedVideoUrl, setGeneratedVideoUrl] = React.useState<string | null>(null);
  const [videoFormat, setVideoFormat] = React.useState<"video/mp4" | "video/webm">("video/webm");

  // --- Text to Video State ---
  const [t2vPrompt, setT2vPrompt] = React.useState<string>(SAMPLE_PROMPTS[1]);
  const [t2vMotion, setT2vMotion] = React.useState<CameraMotion>("orbit-3d");
  const [isGeneratingT2V, setIsGeneratingT2V] = React.useState<boolean>(false);
  const [t2vStage, setT2vStage] = React.useState<string>("");
  const [cooldownSeconds, setCooldownSeconds] = React.useState<number>(0);
  const [autoCleanWatermark, setAutoCleanWatermark] = React.useState<boolean>(true);
  const [isErasingWatermark, setIsErasingWatermark] = React.useState<boolean>(false);

  // --- Voiceover & Audio Narration State ---
  const [enableVoiceover, setEnableVoiceover] = React.useState<boolean>(false);
  const [voiceText, setVoiceText] = React.useState<string>("");
  const [voiceLang, setVoiceLang] = React.useState<string>("en");
  const [voiceAudioBlob, setVoiceAudioBlob] = React.useState<Blob | null>(null);
  const [voiceAudioUrl, setVoiceAudioUrl] = React.useState<string | null>(null);
  const [isPlayingVoice, setIsPlayingVoice] = React.useState<boolean>(false);
  const [isSynthesizingVoice, setIsSynthesizingVoice] = React.useState<boolean>(false);
  const [isRecordingMic, setIsRecordingMic] = React.useState<boolean>(false);
  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
  const audioPreviewRef = React.useRef<HTMLAudioElement | null>(null);

  // Play / Preview Synthesized Voice
  const handlePreviewVoice = async () => {
    if (isPlayingVoice && audioPreviewRef.current) {
      audioPreviewRef.current.pause();
      setIsPlayingVoice(false);
      return;
    }

    const textToSpeak = voiceText.trim() || t2vPrompt.trim() || prompt.trim();
    if (!textToSpeak) {
      toast.error("Please enter a voice script or description to preview.");
      return;
    }

    setIsSynthesizingVoice(true);
    try {
      let url = voiceAudioUrl;
      let blob = voiceAudioBlob;
      if (!blob || !url) {
        const res = await synthesizeAiVoice(textToSpeak, voiceLang);
        blob = res.audioBlob;
        url = res.audioUrl;
        setVoiceAudioBlob(blob);
        setVoiceAudioUrl(url);
      }

      if (audioPreviewRef.current) {
        audioPreviewRef.current.pause();
      }
      const audio = new Audio(url);
      audioPreviewRef.current = audio;
      setIsPlayingVoice(true);
      audio.onended = () => setIsPlayingVoice(false);
      audio.onerror = () => setIsPlayingVoice(false);
      await audio.play();
      toast.success("Playing AI Voice preview!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to preview voice.");
    } finally {
      setIsSynthesizingVoice(false);
    }
  };

  // Microphone Voiceover Recording
  const startMicRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: "audio/webm" });
        setVoiceAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setVoiceAudioUrl(url);
        setEnableVoiceover(true);
        stream.getTracks().forEach((t) => t.stop());
        toast.success("Voice recorded! It will be embedded into your video.");
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecordingMic(true);
      toast.info("Recording microphone... Click Stop when finished.");
    } catch {
      toast.error("Microphone access was denied or is not available.");
    }
  };

  const stopMicRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
      setIsRecordingMic(false);
    }
  };

  // Active cooldown countdown ticker
  React.useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const interval = setInterval(() => {
      setCooldownSeconds((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldownSeconds]);

  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  // Quick random prompt picker
  const pickRandomPrompt = () => {
    const next = SAMPLE_PROMPTS[Math.floor(Math.random() * SAMPLE_PROMPTS.length)];
    if (activeTab === "text-to-video") {
      setT2vPrompt(next);
    } else {
      setPrompt(next);
    }
  };

  // 1. Run Text to Image
  const handleGenerateImage = async () => {
    if (cooldownSeconds > 0) {
      toast.info(`AI Gateway cooling down. Ready in ${cooldownSeconds}s.`);
      return;
    }
    if (!prompt.trim()) {
      toast.error("Please enter a description or prompt.");
      return;
    }

    setIsGeneratingImage(true);
    try {
      const res = await generateAiImage(prompt, {
        style,
        aspectRatio,
        model: "flux",
        autoCleanWatermark,
      });
      setGeneratedImage(res);
      // Auto-set as candidate for Image to Video
      setVideoSourceImage(res.dataUrl);
      setCooldownSeconds(15);
      toast.success("AI Image generated successfully!");
    } catch (err: unknown) {
      const retry = (err as { retryAfter?: number })?.retryAfter;
      if (typeof retry === "number" && retry > 0) {
        setCooldownSeconds(retry);
      }
      toast.error(err instanceof Error ? err.message : "Failed to generate image.");
    } finally {
      setIsGeneratingImage(false);
    }
  };

  // Instant 1-click watermark eraser for already displayed image
  const handleManualEraseWatermark = async () => {
    if (!generatedImage) return;
    setIsErasingWatermark(true);
    try {
      const cleaned = await eraseWatermark(generatedImage.dataUrl);
      setGeneratedImage({
        ...generatedImage,
        dataUrl: cleaned.dataUrl,
      });
      setVideoSourceImage(cleaned.dataUrl);
      toast.success("Watermark removed cleanly with neural inpainting!");
    } catch {
      toast.error("Could not erase watermark.");
    } finally {
      setIsErasingWatermark(false);
    }
  };

  // 2. Run Image to Video
  const handleGenerateVideo = async () => {
    if (!videoSourceImage) {
      toast.error("Please upload or generate an image first.");
      return;
    }

    setIsGeneratingVideo(true);
    setVideoProgress(5);
    try {
      // Prepare audio if voiceover is enabled
      let audioBlobToMix: Blob | null = voiceAudioBlob;
      if (enableVoiceover && !audioBlobToMix) {
        const textToSpeak = voiceText.trim() || prompt.trim();
        if (textToSpeak) {
          try {
            const { audioBlob, audioUrl } = await synthesizeAiVoice(textToSpeak, voiceLang);
            audioBlobToMix = audioBlob;
            setVoiceAudioBlob(audioBlob);
            setVoiceAudioUrl(audioUrl);
          } catch (audioErr) {
            console.warn("Could not synthesize voiceover:", audioErr);
          }
        }
      }

      const res = await generateMotionVideo(
        videoSourceImage,
        {
          motion: videoMotion,
          durationSeconds: videoDuration,
          fps: videoFps,
          cleanWatermark: true,
          audioSource: enableVoiceover ? audioBlobToMix : null,
        },
        (pct) => setVideoProgress(pct)
      );
      setGeneratedVideoUrl(res.videoUrl);
      setVideoFormat(res.format);
      toast.success(
        enableVoiceover && audioBlobToMix
          ? "AI Motion Video generated with synchronized voice narration!"
          : "AI Motion Video generated successfully!"
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate motion video.");
    } finally {
      setIsGeneratingVideo(false);
    }
  };

  // 3. Run Text to Video (2-Stage Pipeline)
  const handleGenerateT2V = async () => {
    if (!t2vPrompt.trim()) {
      toast.error("Please enter a description for your video.");
      return;
    }

    setIsGeneratingT2V(true);
    setT2vStage("Synthesizing 8K Photorealistic Keyframe with FLUX.1...");
    try {
      let keyframeUrl = "";
      // If user already generated an image and hasn't changed prompt, re-use it instantly!
      if (
        generatedImage &&
        (t2vPrompt.trim().toLowerCase() === prompt.trim().toLowerCase() ||
          videoSourceImage === generatedImage.dataUrl)
      ) {
        keyframeUrl = generatedImage.dataUrl;
      } else {
        const imgRes = await generateAiImage(t2vPrompt, {
          style: "cinema",
          aspectRatio: "16:9",
          model: "flux",
          autoCleanWatermark: true,
        });
        keyframeUrl = imgRes.dataUrl;
        setVideoSourceImage(imgRes.dataUrl);
        setCooldownSeconds(15);
      }

      // Ensure keyframe watermark is completely erased before animating
      try {
        const cleaned = await eraseWatermark(keyframeUrl);
        keyframeUrl = cleaned.dataUrl;
        setVideoSourceImage(cleaned.dataUrl);
      } catch {
        // Fallback to original if canvas inpainting is unsupported
      }

      setT2vStage("Compiling 3D Temporal Camera Kinetics & Rendering Video...");

      // Prepare audio if voiceover is enabled
      let audioBlobToMix: Blob | null = voiceAudioBlob;
      if (enableVoiceover && !audioBlobToMix) {
        const textToSpeak = voiceText.trim() || t2vPrompt.trim();
        if (textToSpeak) {
          setT2vStage("Synthesizing AI Voiceover & Audio Narration...");
          try {
            const { audioBlob, audioUrl } = await synthesizeAiVoice(textToSpeak, voiceLang);
            audioBlobToMix = audioBlob;
            setVoiceAudioBlob(audioBlob);
            setVoiceAudioUrl(audioUrl);
          } catch (audioErr) {
            console.warn("Could not synthesize voiceover:", audioErr);
          }
        }
      }

      const vidRes = await generateMotionVideo(
        keyframeUrl,
        {
          motion: t2vMotion,
          durationSeconds: 4.5,
          fps: 30,
          cleanWatermark: true,
          audioSource: enableVoiceover ? audioBlobToMix : null,
        },
        (pct) => {
          setT2vStage(`Rendering Motion Video frames: ${pct}%`);
        }
      );

      setGeneratedVideoUrl(vidRes.videoUrl);
      setVideoFormat(vidRes.format);
      toast.success(
        enableVoiceover && audioBlobToMix
          ? "Text-to-Video generation complete with synchronized voice narration!"
          : "Text-to-Video generation complete!"
      );
    } catch (err: unknown) {
      const retry = (err as { retryAfter?: number })?.retryAfter;
      if (typeof retry === "number" && retry > 0) {
        setCooldownSeconds(retry);
      }
      toast.error(err instanceof Error ? err.message : "Failed to generate text-to-video.");
    } finally {
      setIsGeneratingT2V(false);
      setT2vStage("");
    }
  };

  // Handle uploaded image for Image to Video
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file (PNG, JPG, WebP).");
      return;
    }

    const url = URL.createObjectURL(file);
    setVideoSourceImage(url);
    toast.success("Image loaded! Choose camera motion and click Generate Video.");
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Studio Banner */}
      <div className="text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-sky-500/30 bg-sky-500/10 px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-sky-400">
          <Sparkles className="h-3.5 w-3.5 text-sky-400 animate-pulse" />
          Free Lifetime AI Creation Studio
        </div>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl">
          AI{" "}
          <span className="bg-gradient-to-r from-sky-400 via-teal-400 to-emerald-400 bg-clip-text text-transparent">
            Text to Image & Video
          </span>{" "}
          Studio
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-sm sm:text-base text-muted-foreground">
          Generate photorealistic images with FLUX.1, bring still photos to life with 3D camera kinetics, and turn text prompts into high-definition motion videos.
        </p>

        {/* Master Navigation Mode Tabs */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          {[
            {
              id: "text-to-image",
              label: "🎨 Text to Image",
              desc: "FLUX.1 Neural Generation",
            },
            {
              id: "image-to-video",
              label: "🎬 Image to Video",
              desc: "Animate Photo into 3D Motion",
            },
            {
              id: "text-to-video",
              label: "🎥 Text to Video",
              desc: "Full AI Video Synthesis",
            },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={cn(
                "flex flex-col items-center rounded-xl border px-5 py-2.5 text-xs font-bold transition cursor-pointer shadow-xs",
                activeTab === tab.id
                  ? "border-sky-500 bg-sky-500/15 text-sky-400 ring-2 ring-sky-500/30 font-extrabold"
                  : "border-border bg-card text-muted-foreground hover:border-border/80 hover:text-foreground"
              )}
            >
              <span className="text-sm">{tab.label}</span>
              <span className="text-[10px] opacity-75 font-normal">{tab.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Mode 1: TEXT TO IMAGE */}
      {activeTab === "text-to-image" && (
        <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-12 animate-in fade-in-50 duration-200">
          {/* Left Column: Controls (5 cols) */}
          <div className="lg:col-span-5 space-y-5">
            <div className="rounded-2xl border border-border bg-card p-5 space-y-5 shadow-sm">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Wand2 className="h-3.5 w-3.5 text-sky-400" /> Prompt Description
                </label>
                <button
                  type="button"
                  onClick={pickRandomPrompt}
                  className="text-xs text-sky-400 hover:text-sky-300 font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className="h-3 w-3" /> Surprise Me
                </button>
              </div>

              <textarea
                rows={4}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe whatever you imagine in detail (e.g. A futuristic glass skyscraper covered in vertical rainforest gardens at sunset)..."
                className="w-full rounded-xl border border-border bg-muted/30 p-3 text-xs sm:text-sm text-foreground focus:border-sky-500 focus:outline-hidden focus:ring-1 focus:ring-sky-500"
              />

              {/* Style Selector */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                  <span>Visual Art Style</span>
                  <span className="text-[11px] text-sky-400 font-mono">
                    {STYLE_PRESETS.find((s) => s.id === style)?.label}
                  </span>
                </label>
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                  {STYLE_PRESETS.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setStyle(s.id)}
                      className={cn(
                        "flex items-center gap-2 rounded-xl border p-2 text-left transition cursor-pointer",
                        style === s.id
                          ? "border-sky-500 bg-sky-500/10 text-sky-400 font-bold shadow-xs"
                          : "border-border text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <span className="text-base">{s.icon}</span>
                      <div className="overflow-hidden">
                        <div className="truncate text-xs font-bold">{s.label}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Aspect Ratio */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Aspect Ratio
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {(
                    [
                      { id: "1:1", label: "1:1", sub: "Square" },
                      { id: "16:9", label: "16:9", sub: "Cinema" },
                      { id: "9:16", label: "9:16", sub: "TikTok" },
                      { id: "4:5", label: "4:5", sub: "Insta" },
                    ] as const
                  ).map((ar) => (
                    <button
                      key={ar.id}
                      type="button"
                      onClick={() => setAspectRatio(ar.id)}
                      className={cn(
                        "flex flex-col items-center justify-center rounded-xl border py-2 text-center transition cursor-pointer",
                        aspectRatio === ar.id
                          ? "border-sky-500 bg-sky-500/10 text-sky-400 font-bold shadow-xs"
                          : "border-border text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <span className="text-xs font-mono font-bold">{ar.label}</span>
                      <span className="text-[9px] opacity-75">{ar.sub}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Clean Output Toggle */}
              <div className="flex items-center justify-between rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2">
                <div className="flex items-center gap-2">
                  <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                  <div>
                    <span className="text-xs font-semibold block text-foreground leading-tight">
                      Auto-Remove Watermark
                    </span>
                    <span className="text-[10px] text-muted-foreground block leading-tight">
                      Neural inpainting erases pollinations logo for clean export
                    </span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={autoCleanWatermark}
                  onChange={(e) => setAutoCleanWatermark(e.target.checked)}
                  className="h-4 w-4 rounded accent-emerald-500 cursor-pointer"
                />
              </div>

              {/* Generate Button */}
              <Button
                type="button"
                onClick={handleGenerateImage}
                disabled={isGeneratingImage || !prompt.trim() || cooldownSeconds > 0}
                className="w-full gap-2 rounded-xl py-4 bg-gradient-to-r from-sky-500 via-teal-500 to-emerald-500 font-extrabold text-white shadow-lg shadow-sky-500/20 hover:opacity-95 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isGeneratingImage ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generating with FLUX.1 Neural Engine...
                  </>
                ) : cooldownSeconds > 0 ? (
                  <>
                    <Clock className="h-4 w-4 animate-pulse" />
                    AI Gateway Cooldown ({cooldownSeconds}s)
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Generate Image (FLUX.1 8K)
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Right Column: Output Showcase (7 cols) */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-4 min-h-[440px] flex items-center justify-center shadow-sm">
              {isGeneratingImage ? (
                <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in-50">
                  <div className="relative flex items-center justify-center">
                    <Loader2 className="h-12 w-12 text-sky-400 animate-spin" />
                    <Sparkles className="absolute h-5 w-5 text-amber-400 animate-pulse" />
                  </div>
                  <p className="mt-4 font-bold text-sm text-foreground">
                    FLUX.1 Neural Engine is rendering your image...
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Synthesizing lighting, photorealistic textures and depth (~3 to 5s)
                  </p>
                </div>
              ) : generatedImage ? (
                <div className="w-full space-y-4 animate-in fade-in-50">
                  <div className="relative overflow-hidden rounded-xl border border-border bg-muted/40 flex items-center justify-center max-h-[520px]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={generatedImage.dataUrl}
                      alt={generatedImage.prompt}
                      className="max-h-[520px] w-full object-contain rounded-xl shadow-md"
                    />
                  </div>

                  {/* Actions & Next-Step Pipelines */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/40 pt-3">
                    <div className="text-xs text-muted-foreground font-mono">
                      {generatedImage.width}×{generatedImage.height} • Seed {generatedImage.seed}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {/* Animate to Video Quick Bridge */}
                      <button
                        type="button"
                        onClick={() => {
                          setVideoSourceImage(generatedImage.dataUrl);
                          setActiveTab("image-to-video");
                          toast.info("Image loaded into Motion Video Studio! Choose motion & render.");
                        }}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-sky-500/40 bg-sky-500/10 px-3.5 py-1.5 text-xs font-bold text-sky-400 hover:bg-sky-500/20 transition cursor-pointer"
                      >
                        <Film className="h-3.5 w-3.5" /> Animate to Video
                      </button>

                      {/* Instant Erase Watermark Button */}
                      <button
                        type="button"
                        onClick={handleManualEraseWatermark}
                        disabled={isErasingWatermark}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3.5 py-1.5 text-xs font-bold text-emerald-400 hover:bg-emerald-500/20 transition cursor-pointer disabled:opacity-50"
                        title="Remove watermark using neural inpainting"
                      >
                        {isErasingWatermark ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Wand2 className="h-3.5 w-3.5 text-emerald-400" />
                        )}
                        Erase Watermark
                      </button>

                      {/* Remini Upscale Bridge */}
                      <Link
                        href="/upscale"
                        className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition shadow-xs"
                      >
                        <Maximize2 className="h-3.5 w-3.5 text-emerald-400" /> Remini 4x Upscale
                      </Link>

                      {/* Download */}
                      <a
                        href={generatedImage.dataUrl}
                        download={`ai_flux_${generatedImage.seed}.jpg`}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-1.5 text-xs font-bold text-primary-foreground hover:bg-primary/90 transition shadow-sm"
                      >
                        <Download className="h-3.5 w-3.5" /> Download
                      </a>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-20 text-center">
                  <ImageIcon className="mx-auto h-14 w-14 text-muted-foreground/30" />
                  <h3 className="mt-3 text-sm font-bold text-foreground">Your AI Creation Awaits</h3>
                  <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
                    Type a prompt on the left, pick your favorite art style, and click Generate to see FLUX.1 in action!
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Mode 2: IMAGE TO VIDEO */}
      {activeTab === "image-to-video" && (
        <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-12 animate-in fade-in-50 duration-200">
          {/* Left Column: Video Controls (5 cols) */}
          <div className="lg:col-span-5 space-y-5">
            <div className="rounded-2xl border border-border bg-card p-5 space-y-5 shadow-sm">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Film className="h-3.5 w-3.5 text-sky-400" /> Source Photo
                </label>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <label className="cursor-pointer inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-bold text-muted-foreground hover:text-foreground transition shadow-xs">
                    <Upload className="h-3.5 w-3.5" /> Upload Photo
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>

                  {generatedImage && (
                    <button
                      type="button"
                      onClick={() => {
                        setVideoSourceImage(generatedImage.dataUrl);
                        toast.info("Using your newly generated AI image!");
                      }}
                      className="text-xs text-sky-400 hover:text-sky-300 font-semibold cursor-pointer underline underline-offset-2"
                    >
                      Use Last Generated Image
                    </button>
                  )}
                </div>
              </div>

              {/* Camera Choreography Motion Presets */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                  <span>Camera Motion Preset</span>
                  <span className="text-[11px] text-sky-400 font-mono">
                    {MOTION_PRESETS.find((m) => m.id === videoMotion)?.label}
                  </span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {MOTION_PRESETS.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setVideoMotion(m.id)}
                      className={cn(
                        "flex flex-col items-start rounded-xl border p-2.5 text-left transition cursor-pointer",
                        videoMotion === m.id
                          ? "border-sky-500 bg-sky-500/10 text-sky-400 font-bold shadow-xs"
                          : "border-border text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <div className="flex items-center gap-1.5 text-xs font-bold">
                        <span>{m.icon}</span>
                        <span>{m.label}</span>
                      </div>
                      <span className="mt-0.5 text-[10px] text-muted-foreground line-clamp-1">
                        {m.description}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Duration & FPS Controls */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-muted-foreground uppercase">
                    Duration
                  </label>
                  <div className="grid grid-cols-3 gap-1">
                    {[3, 4, 6].map((sec) => (
                      <button
                        key={sec}
                        type="button"
                        onClick={() => setVideoDuration(sec)}
                        className={cn(
                          "rounded-lg border py-1.5 text-xs font-mono font-bold transition cursor-pointer text-center",
                          videoDuration === sec
                            ? "border-sky-500 bg-sky-500/15 text-sky-400"
                            : "border-border text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {sec}s
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-muted-foreground uppercase">
                    Frame Rate
                  </label>
                  <div className="grid grid-cols-2 gap-1">
                    {[30, 60].map((fps) => (
                      <button
                        key={fps}
                        type="button"
                        onClick={() => setVideoFps(fps)}
                        className={cn(
                          "rounded-lg border py-1.5 text-xs font-mono font-bold transition cursor-pointer text-center",
                          videoFps === fps
                            ? "border-sky-500 bg-sky-500/15 text-sky-400"
                            : "border-border text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {fps} FPS
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* AI Voiceover & Sound Narration Option */}
              <div className="rounded-2xl border border-sky-500/30 bg-sky-500/5 p-4 space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Volume2 className="h-4 w-4 text-sky-400" />
                    <span className="text-xs font-bold uppercase tracking-wider text-sky-400">
                      AI Voiceover & Sound Narration
                    </span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={enableVoiceover}
                      onChange={(e) => setEnableVoiceover(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-500"></div>
                  </label>
                </div>

                {enableVoiceover ? (
                  <div className="space-y-3 pt-1 animate-in fade-in-50 duration-200">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <label className="text-muted-foreground font-semibold">Narration Script / Dialogue:</label>
                        <button
                          type="button"
                          onClick={() => setVoiceText(prompt)}
                          className="text-[11px] text-sky-400 hover:underline cursor-pointer flex items-center gap-1"
                        >
                          <Sparkles className="h-3 w-3" /> Use Prompt
                        </button>
                      </div>
                      <textarea
                        rows={2}
                        value={voiceText}
                        onChange={(e) => {
                          setVoiceText(e.target.value);
                          setVoiceAudioBlob(null);
                          setVoiceAudioUrl(null);
                        }}
                        placeholder="Type voice narration (e.g. 'A breathtaking journey into the ancient mountains...')"
                        className="w-full rounded-xl border border-border bg-card p-2.5 text-xs text-foreground focus:border-sky-500 focus:outline-hidden"
                      />
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={voiceLang}
                        onChange={(e) => {
                          setVoiceLang(e.target.value);
                          setVoiceAudioBlob(null);
                          setVoiceAudioUrl(null);
                        }}
                        className="rounded-xl border border-border bg-card px-2.5 py-1.5 text-xs text-foreground focus:outline-hidden"
                      >
                        {VOICE_LANGUAGES.map((l) => (
                          <option key={l.code} value={l.code}>
                            {l.label}
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        onClick={handlePreviewVoice}
                        disabled={isSynthesizingVoice}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-sky-500/40 bg-sky-500/10 px-3 py-1.5 text-xs font-bold text-sky-400 hover:bg-sky-500/20 transition cursor-pointer disabled:opacity-50"
                      >
                        {isSynthesizingVoice ? (
                          <>
                            <Loader2 className="h-3 w-3 animate-spin" /> Synthesizing...
                          </>
                        ) : isPlayingVoice ? (
                          <>
                            <Square className="h-3 w-3 text-emerald-400" /> Stop Preview
                          </>
                        ) : (
                          <>
                            <Play className="h-3 w-3" /> Listen Voice
                          </>
                        )}
                      </button>

                      {isRecordingMic ? (
                        <button
                          type="button"
                          onClick={stopMicRecording}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-red-500 px-3 py-1.5 text-xs font-bold text-white animate-pulse transition cursor-pointer"
                        >
                          <Square className="h-3 w-3" /> Stop Mic
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={startMicRecording}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card hover:bg-muted px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition cursor-pointer"
                          title="Record your voice with microphone"
                        >
                          <Mic className="h-3 w-3 text-red-400" /> Record Mic
                        </button>
                      )}

                      {voiceAudioBlob && (
                        <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1 font-bold">
                          <Check className="h-3 w-3" /> Sound Ready ({(voiceAudioBlob.size / 1024).toFixed(0)} KB)
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] text-muted-foreground">
                    Enable to automatically synthesize natural AI narration or record your voice into the MP4 video!
                  </p>
                )}
              </div>

              {/* Generate Motion Video Button */}
              <Button
                type="button"
                onClick={handleGenerateVideo}
                disabled={isGeneratingVideo || !videoSourceImage}
                className="w-full gap-2 rounded-xl py-4 bg-gradient-to-r from-sky-500 via-teal-500 to-emerald-500 font-extrabold text-white shadow-lg shadow-sky-500/20 hover:opacity-95 cursor-pointer"
              >
                {isGeneratingVideo ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Rendering Motion Video ({videoProgress}%)...
                  </>
                ) : (
                  <>
                    <Video className="h-4 w-4" />
                    Generate Motion Video (MP4)
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Right Column: Video Player & Preview (7 cols) */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-4 min-h-[440px] flex items-center justify-center shadow-sm">
              {isGeneratingVideo ? (
                <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in-50">
                  <Loader2 className="h-12 w-12 text-sky-400 animate-spin" />
                  <p className="mt-4 font-bold text-sm text-foreground">
                    Synthesizing 3D Camera Kinetics & Depth Frames...
                  </p>
                  <div className="mt-3 w-56 rounded-full bg-muted overflow-hidden h-2">
                    <div
                      className="h-full bg-sky-400 transition-all duration-200"
                      style={{ width: `${videoProgress}%` }}
                    />
                  </div>
                  <span className="mt-1 text-xs text-muted-foreground font-mono">{videoProgress}%</span>
                </div>
              ) : generatedVideoUrl ? (
                <div className="w-full space-y-4 animate-in fade-in-50">
                  <div className="relative overflow-hidden rounded-xl border border-border bg-black flex items-center justify-center max-h-[500px]">
                    <video
                      src={generatedVideoUrl}
                      controls
                      autoPlay
                      loop
                      playsInline
                      className="max-h-[500px] w-full object-contain rounded-xl"
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/40 pt-3">
                    <span className="text-xs text-emerald-400 font-bold flex items-center gap-1.5">
                      <Check className="h-3.5 w-3.5" /> High-Definition Motion Video Ready ({videoDuration}s • {videoFps} FPS)
                      {enableVoiceover && voiceAudioBlob && (
                        <span className="text-[10px] font-mono text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded-full border border-sky-500/20 flex items-center gap-1">
                          <Volume2 className="h-3 w-3" /> Audio Attached
                        </span>
                      )}
                    </span>

                    <a
                      href={generatedVideoUrl}
                      download={`ai_motion_video_${Date.now()}.${videoFormat === "video/mp4" ? "mp4" : "webm"}`}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90 transition shadow-sm"
                    >
                      <Download className="h-3.5 w-3.5" /> Download Motion Video
                    </a>
                  </div>

                  {/* PicTools Voice & Audio Suite Quick Access */}
                  <div className="rounded-xl border border-border/70 bg-muted/20 p-3 space-y-2">
                    <span className="text-[11px] font-bold text-muted-foreground flex items-center gap-1.5 uppercase tracking-wider">
                      <Music className="h-3.5 w-3.5 text-sky-400" /> PicTools Audio & Voice Suite
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href="/text-to-speech"
                        className="inline-flex items-center gap-1 rounded-lg border border-border bg-card hover:bg-muted px-2.5 py-1 text-xs font-medium text-foreground transition"
                      >
                        🗣️ Text to Speech
                      </Link>
                      <Link
                        href="/voice-changer"
                        className="inline-flex items-center gap-1 rounded-lg border border-border bg-card hover:bg-muted px-2.5 py-1 text-xs font-medium text-foreground transition"
                      >
                        🎛️ Voice Changer
                      </Link>
                      <Link
                        href="/speech-to-text"
                        className="inline-flex items-center gap-1 rounded-lg border border-border bg-card hover:bg-muted px-2.5 py-1 text-xs font-medium text-foreground transition"
                      >
                        🎙️ Speech to Text
                      </Link>
                      <Link
                        href="/audiogram-maker"
                        className="inline-flex items-center gap-1 rounded-lg border border-border bg-card hover:bg-muted px-2.5 py-1 text-xs font-medium text-foreground transition"
                      >
                        🎵 Audiogram Maker
                      </Link>
                    </div>
                  </div>
                </div>
              ) : videoSourceImage ? (
                <div className="w-full space-y-3 text-center">
                  <div className="relative overflow-hidden rounded-xl border border-border bg-muted/40 max-h-[380px] flex items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={videoSourceImage}
                      alt="Source for animation"
                      className="max-h-[380px] w-full object-contain rounded-xl"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Photo loaded! Select your preferred camera choreography on the left and click <strong>Generate Motion Video</strong>.
                  </p>
                </div>
              ) : (
                <div className="py-20 text-center">
                  <Video className="mx-auto h-14 w-14 text-muted-foreground/30" />
                  <h3 className="mt-3 text-sm font-bold text-foreground">No Source Photo Loaded</h3>
                  <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
                    Upload an image or generate one in the Text to Image tab to animate it with 3D camera kinetics!
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Mode 3: TEXT TO VIDEO */}
      {activeTab === "text-to-video" && (
        <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-12 animate-in fade-in-50 duration-200">
          {/* Left Column: Text to Video Settings (5 cols) */}
          <div className="lg:col-span-5 space-y-5">
            <div className="rounded-2xl border border-border bg-card p-5 space-y-5 shadow-sm">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Camera className="h-3.5 w-3.5 text-sky-400" /> Video Scene Description
                </label>
                <button
                  type="button"
                  onClick={pickRandomPrompt}
                  className="text-xs text-sky-400 hover:text-sky-300 font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className="h-3 w-3" /> Random Scene
                </button>
              </div>

              <textarea
                rows={4}
                value={t2vPrompt}
                onChange={(e) => setT2vPrompt(e.target.value)}
                placeholder="Describe your video clip in vivid cinematic detail (e.g. Sweeping drone shot over turquoise tropical islands with crashing waves)..."
                className="w-full rounded-xl border border-border bg-muted/30 p-3 text-xs sm:text-sm text-foreground focus:border-sky-500 focus:outline-hidden focus:ring-1 focus:ring-sky-500"
              />

              {/* Camera Movement */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Camera Motion Style
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {MOTION_PRESETS.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setT2vMotion(m.id)}
                      className={cn(
                        "flex items-center gap-2 rounded-xl border p-2 text-left transition cursor-pointer",
                        t2vMotion === m.id
                          ? "border-sky-500 bg-sky-500/10 text-sky-400 font-bold shadow-xs"
                          : "border-border text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <span>{m.icon}</span>
                      <span className="text-xs font-bold truncate">{m.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Pipeline Info Callout */}
              <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-3 text-xs text-muted-foreground space-y-1">
                <p className="font-bold text-sky-400 flex items-center gap-1">
                  <Sparkles className="h-3.5 w-3.5" /> Two-Stage Neural Synthesis Pipeline:
                </p>
                <p className="text-[11px] leading-relaxed">
                  1. FLUX.1 synthesizes a photorealistic 16:9 cinematic keyframe.<br />
                  2. Kinetic camera choreography generates motion frames into a downloadable MP4 clip.
                </p>
              </div>

              {/* AI Voiceover & Sound Narration Option */}
              <div className="rounded-2xl border border-sky-500/30 bg-sky-500/5 p-4 space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Volume2 className="h-4 w-4 text-sky-400" />
                    <span className="text-xs font-bold uppercase tracking-wider text-sky-400">
                      AI Voiceover & Sound Narration
                    </span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={enableVoiceover}
                      onChange={(e) => setEnableVoiceover(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-500"></div>
                  </label>
                </div>

                {enableVoiceover ? (
                  <div className="space-y-3 pt-1 animate-in fade-in-50 duration-200">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <label className="text-muted-foreground font-semibold">Narration Script / Dialogue:</label>
                        <button
                          type="button"
                          onClick={() => setVoiceText(t2vPrompt)}
                          className="text-[11px] text-sky-400 hover:underline cursor-pointer flex items-center gap-1"
                        >
                          <Sparkles className="h-3 w-3" /> Auto-fill from Prompt
                        </button>
                      </div>
                      <textarea
                        rows={2}
                        value={voiceText}
                        onChange={(e) => {
                          setVoiceText(e.target.value);
                          setVoiceAudioBlob(null);
                          setVoiceAudioUrl(null);
                        }}
                        placeholder="Type narration script (e.g. 'A breathtaking journey into the misty mountains...')"
                        className="w-full rounded-xl border border-border bg-card p-2.5 text-xs text-foreground focus:border-sky-500 focus:outline-hidden"
                      />
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={voiceLang}
                        onChange={(e) => {
                          setVoiceLang(e.target.value);
                          setVoiceAudioBlob(null);
                          setVoiceAudioUrl(null);
                        }}
                        className="rounded-xl border border-border bg-card px-2.5 py-1.5 text-xs text-foreground focus:outline-hidden"
                      >
                        {VOICE_LANGUAGES.map((l) => (
                          <option key={l.code} value={l.code}>
                            {l.label}
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        onClick={handlePreviewVoice}
                        disabled={isSynthesizingVoice}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-sky-500/40 bg-sky-500/10 px-3 py-1.5 text-xs font-bold text-sky-400 hover:bg-sky-500/20 transition cursor-pointer disabled:opacity-50"
                      >
                        {isSynthesizingVoice ? (
                          <>
                            <Loader2 className="h-3 w-3 animate-spin" /> Synthesizing...
                          </>
                        ) : isPlayingVoice ? (
                          <>
                            <Square className="h-3 w-3 text-emerald-400" /> Stop Preview
                          </>
                        ) : (
                          <>
                            <Play className="h-3 w-3" /> Listen Voice
                          </>
                        )}
                      </button>

                      {isRecordingMic ? (
                        <button
                          type="button"
                          onClick={stopMicRecording}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-red-500 px-3 py-1.5 text-xs font-bold text-white animate-pulse transition cursor-pointer"
                        >
                          <Square className="h-3 w-3" /> Stop Mic
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={startMicRecording}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card hover:bg-muted px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition cursor-pointer"
                          title="Record your voice with microphone"
                        >
                          <Mic className="h-3 w-3 text-red-400" /> Record Mic
                        </button>
                      )}

                      {voiceAudioBlob && (
                        <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1 font-bold">
                          <Check className="h-3 w-3" /> Sound Ready ({(voiceAudioBlob.size / 1024).toFixed(0)} KB)
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] text-muted-foreground">
                    Enable to automatically synthesize natural AI narration or record your voice into the MP4 video!
                  </p>
                )}
              </div>

              {/* Generate T2V Button */}
              <Button
                type="button"
                onClick={handleGenerateT2V}
                disabled={isGeneratingT2V || !t2vPrompt.trim()}
                className="w-full gap-2 rounded-xl py-4 bg-gradient-to-r from-sky-500 via-teal-500 to-emerald-500 font-extrabold text-white shadow-lg shadow-sky-500/20 hover:opacity-95 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isGeneratingT2V ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generating Video Clip...
                  </>
                ) : (
                  <>
                    <Film className="h-4 w-4" />
                    Generate Full AI Video Clip
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Right Column: Video Output (7 cols) */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-4 min-h-[440px] flex items-center justify-center shadow-sm">
              {isGeneratingT2V ? (
                <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in-50">
                  <div className="relative flex items-center justify-center">
                    <Loader2 className="h-12 w-12 text-sky-400 animate-spin" />
                    <Film className="absolute h-5 w-5 text-sky-400" />
                  </div>
                  <p className="mt-4 font-bold text-sm text-foreground">{t2vStage}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    100% cloud & in-browser processing with zero GPU strain on your PC.
                  </p>
                </div>
              ) : generatedVideoUrl ? (
                <div className="w-full space-y-4 animate-in fade-in-50">
                  <div className="relative overflow-hidden rounded-xl border border-border bg-black flex items-center justify-center max-h-[500px]">
                    <video
                      src={generatedVideoUrl}
                      controls
                      autoPlay
                      loop
                      playsInline
                      className="max-h-[500px] w-full object-contain rounded-xl"
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/40 pt-3">
                    <span className="text-xs text-emerald-400 font-bold flex items-center gap-1.5">
                      <Check className="h-3.5 w-3.5" /> Text-to-Video Generated Successfully
                      {enableVoiceover && voiceAudioBlob && (
                        <span className="text-[10px] font-mono text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded-full border border-sky-500/20 flex items-center gap-1">
                          <Volume2 className="h-3 w-3" /> Audio Attached
                        </span>
                      )}
                    </span>

                    <a
                      href={generatedVideoUrl}
                      download={`ai_text_to_video_${Date.now()}.${videoFormat === "video/mp4" ? "mp4" : "webm"}`}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90 transition shadow-sm"
                    >
                      <Download className="h-3.5 w-3.5" /> Download Video Clip
                    </a>
                  </div>

                  {/* PicTools Voice & Audio Suite Quick Access */}
                  <div className="rounded-xl border border-border/70 bg-muted/20 p-3 space-y-2">
                    <span className="text-[11px] font-bold text-muted-foreground flex items-center gap-1.5 uppercase tracking-wider">
                      <Music className="h-3.5 w-3.5 text-sky-400" /> PicTools Audio & Voice Suite
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href="/text-to-speech"
                        className="inline-flex items-center gap-1 rounded-lg border border-border bg-card hover:bg-muted px-2.5 py-1 text-xs font-medium text-foreground transition"
                      >
                        🗣️ Text to Speech
                      </Link>
                      <Link
                        href="/voice-changer"
                        className="inline-flex items-center gap-1 rounded-lg border border-border bg-card hover:bg-muted px-2.5 py-1 text-xs font-medium text-foreground transition"
                      >
                        🎛️ Voice Changer
                      </Link>
                      <Link
                        href="/speech-to-text"
                        className="inline-flex items-center gap-1 rounded-lg border border-border bg-card hover:bg-muted px-2.5 py-1 text-xs font-medium text-foreground transition"
                      >
                        🎙️ Speech to Text
                      </Link>
                      <Link
                        href="/audiogram-maker"
                        className="inline-flex items-center gap-1 rounded-lg border border-border bg-card hover:bg-muted px-2.5 py-1 text-xs font-medium text-foreground transition"
                      >
                        🎵 Audiogram Maker
                      </Link>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-20 text-center">
                  <Film className="mx-auto h-14 w-14 text-muted-foreground/30" />
                  <h3 className="mt-3 text-sm font-bold text-foreground">AI Text-to-Video Ready</h3>
                  <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
                    Type a prompt on the left, pick camera motion, and click <strong>Generate Full AI Video Clip</strong>!
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

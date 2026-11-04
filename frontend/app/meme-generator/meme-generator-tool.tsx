"use client";

import React, { useState, useRef, useEffect, useId } from "react";
import {
  Sparkles,
  Upload,
  Download,
  RotateCcw,
  Sliders,
  Type,
  Smile,
  Zap,
  Check,
  Share2,
} from "lucide-react";
import { toast } from "sonner";
import { useToolDraft } from "@/lib/use-draft";
import { DraftBanner } from "@/components/draft-banner";
import { isShareSupported, shareBlob } from "@/lib/share";
import {
  AI_MEME_SUGGESTIONS,
  POPULAR_TEMPLATES,
  MemeStyle,
  MemeTemplate,
  drawMemeCanvas,
} from "@/lib/meme-engine";

export function MemeGeneratorTool() {
  const [topText, setTopText] = useState<string>("IT WORKED ON MY MACHINE");
  const [bottomText, setBottomText] = useState<string>("PRODUCTION SERVER IS DOWN");
  const [memeStyle, setMemeStyle] = useState<MemeStyle>("classic-impact");
  const [fontSizePercent, setFontSizePercent] = useState<number>(8);

  const { hasDraft, draftDate, restoreDraft, discardDraft } = useToolDraft(
    "meme-generator",
    { topText, bottomText, memeStyle, fontSizePercent },
    (saved) => {
      setTopText(saved.topText);
      setBottomText(saved.bottomText);
      setMemeStyle(saved.memeStyle);
      setFontSizePercent(saved.fontSizePercent);
    },
  );

  const [shareSupported, setShareSupported] = useState(false);
  useEffect(() => {
    setShareSupported(isShareSupported());
  }, []);

  const [activeImg, setActiveImg] = useState<HTMLImageElement | null>(null);
  const [customImgUrl, setCustomImgUrl] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputId = useId();

  // Load initial template image
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => setActiveImg(img);
    img.src = POPULAR_TEMPLATES[0].imageUrl;
  }, []);

  // Re-render canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = 800;
    canvas.height = 800;
    drawMemeCanvas(ctx, canvas.width, canvas.height, activeImg, topText, bottomText, memeStyle, fontSizePercent);
  }, [activeImg, topText, bottomText, memeStyle, fontSizePercent]);

  // Handle Custom Upload
  const handleCustomUpload = (file: File) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setActiveImg(img);
      setCustomImgUrl(url);
      toast.success("Loaded custom image for meme!");
    };
    img.src = url;
  };

  // Select preloaded template
  const handleSelectTemplate = (template: MemeTemplate) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      setActiveImg(img);
      setTopText(template.topDefault);
      setBottomText(template.bottomDefault);
      toast.success(`Selected template: ${template.name}`);
    };
    img.src = template.imageUrl;
  };

  // AI Punchline Suggester
  const handleAiSuggest = (category: "tech" | "work" | "crypto" | "life") => {
    const pool = AI_MEME_SUGGESTIONS.filter((s) => s.category === category);
    const pick = pool[Math.floor(Math.random() * pool.length)];
    if (pick) {
      setTopText(pick.topText);
      setBottomText(pick.bottomText);
      toast.success(`Generated viral ${category} caption!`);
    }
  };

  // Download Meme
  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `meme-${Date.now()}.png`;
    a.click();
    toast.success("Downloaded high-res meme!");
  };

  const handleShare = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const filename = `meme-${Date.now()}.png`;
      const shared = await shareBlob(blob, filename, {
        title: filename,
        text: "Meme created with PicTools",
      });
      if (shared) toast.success("Shared successfully!");
    }, "image/png");
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <DraftBanner
        hasDraft={hasDraft}
        draftDate={draftDate}
        onRestore={restoreDraft}
        onDiscard={discardDraft}
      />

      {/* Header */}
      <div className="mb-6">
        <div className="inline-flex items-center gap-2 rounded-full border border-pink-500/20 bg-pink-500/10 px-3 py-1 text-xs font-semibold text-pink-400">
          <Smile className="h-3.5 w-3.5" />
          Viral Social & Discord Creator
        </div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          AI Animated GIF & Viral Meme Studio
        </h1>
        <p className="mt-2 text-sm text-muted-foreground sm:text-base">
          Create hilarious memes with AI-suggested punchlines, classic Impact font with black borders, or modern Twitter social card styling.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Meme Canvas */}
        <div className="space-y-4 lg:col-span-7">
          <div className="overflow-hidden rounded-3xl border border-border/80 bg-black shadow-2xl p-4 flex items-center justify-center">
            <canvas ref={canvasRef} className="max-h-[500px] w-auto max-w-full rounded-2xl object-contain" />
          </div>

          {/* Download & Share Actions */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownload}
              className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-pink-600 py-3 text-sm font-bold text-white shadow-lg hover:bg-pink-500 transition"
            >
              <Download className="h-4 w-4" />
              Download (PNG)
            </button>
            {shareSupported && (
              <button
                type="button"
                onClick={() => handleShare()}
                className="flex items-center justify-center gap-2 rounded-2xl border border-border/60 bg-muted/40 px-4 py-3 text-sm font-bold text-foreground hover:bg-muted transition"
                title="Share"
              >
                <Share2 className="h-4 w-4" />
                Share
              </button>
            )}
          </div>
        </div>

        {/* Right Column: AI Captions & Text Settings */}
        <div className="space-y-4 lg:col-span-5">
          <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-xl space-y-4">
            {/* AI Punchline Suggester */}
            <div className="space-y-2 rounded-2xl border border-pink-500/30 bg-pink-500/5 p-3.5">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-pink-400" />
                <span className="text-xs font-bold text-foreground">
                  AI Viral Punchline Suggester
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Click any topic to generate instant captions:
              </p>
              <div className="grid grid-cols-2 gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => handleAiSuggest("tech")}
                  className="rounded-lg border border-border/60 bg-card px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-muted"
                >
                  💻 Coding & Bugs
                </button>
                <button
                  type="button"
                  onClick={() => handleAiSuggest("work")}
                  className="rounded-lg border border-border/60 bg-card px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-muted"
                >
                  🏢 Office & Meetings
                </button>
                <button
                  type="button"
                  onClick={() => handleAiSuggest("crypto")}
                  className="rounded-lg border border-border/60 bg-card px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-muted"
                >
                  📈 Crypto & Stocks
                </button>
                <button
                  type="button"
                  onClick={() => handleAiSuggest("life")}
                  className="rounded-lg border border-border/60 bg-card px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-muted"
                >
                  ☕ Everyday Life
                </button>
              </div>
            </div>

            {/* Style Selector */}
            <div>
              <label className="text-xs font-bold text-foreground block mb-1.5">
                Meme Format &amp; Style
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 rounded-xl bg-muted/40 p-1 border border-border/60">
                {[
                  { id: "classic-impact", label: "Classic Impact" },
                  { id: "modern-card", label: "Social Card" },
                  { id: "breaking-news", label: "Breaking News" },
                  { id: "retro-vhs", label: "90s VHS" },
                ].map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setMemeStyle(s.id as MemeStyle)}
                    className={`rounded-lg py-1.5 text-[11px] font-semibold transition text-center ${
                      memeStyle === s.id
                        ? "bg-background text-foreground shadow"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Text Inputs */}
            <div className="space-y-2.5">
              <div>
                <label className="text-xs font-bold text-foreground block mb-1">
                  Top Headline Text
                </label>
                <input
                  type="text"
                  value={topText}
                  onChange={(e) => setTopText(e.target.value)}
                  className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-xs font-bold text-foreground uppercase focus:outline-none focus:ring-1 focus:ring-primary/40"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-foreground block mb-1">
                  Bottom Punchline Text
                </label>
                <input
                  type="text"
                  value={bottomText}
                  onChange={(e) => setBottomText(e.target.value)}
                  className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-xs font-bold text-foreground uppercase focus:outline-none focus:ring-1 focus:ring-primary/40"
                />
              </div>
            </div>

            {/* Popular Templates Grid */}
            <div>
              <label className="text-xs font-bold text-foreground block mb-1.5">
                Popular Meme Templates
              </label>
              <div className="grid grid-cols-3 gap-2">
                {POPULAR_TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => handleSelectTemplate(tpl)}
                    className="group relative flex flex-col items-center overflow-hidden rounded-xl border border-border/60 bg-muted/30 p-1.5 text-center transition hover:border-pink-500/50 hover:bg-muted"
                  >
                    <div className="aspect-square w-full overflow-hidden rounded-lg bg-black/40">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={tpl.imageUrl}
                        alt={tpl.name}
                        className="h-full w-full object-cover transition group-hover:scale-105"
                      />
                    </div>
                    <span className="mt-1 block truncate w-full font-display text-[10px] font-semibold text-foreground">
                      {tpl.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Image Upload */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-border/80 bg-background/50 p-3 text-xs font-semibold text-muted-foreground hover:bg-muted/40 cursor-pointer transition"
            >
              <Upload className="h-4 w-4" />
              Upload Custom Image or Photo
              <input
                id={fileInputId}
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleCustomUpload(e.target.files[0])}
              />
            </div>

            {/* Font Size */}
            <div className="pt-2 border-t border-border/40 space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Text Size</span>
                <span className="font-mono">{fontSizePercent}%</span>
              </div>
              <input
                type="range"
                min={5}
                max={14}
                value={fontSizePercent}
                onChange={(e) => setFontSizePercent(parseInt(e.target.value, 10))}
                className="w-full accent-pink-500"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

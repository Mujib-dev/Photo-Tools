"use client";

import React, { useState, useRef, useId } from "react";
import {
  Zap,
  Upload,
  Download,
  Copy,
  Check,
  RotateCcw,
  Sparkles,
  Archive,
  Code,
  Globe,
  Smartphone,
} from "lucide-react";
import { toast } from "sonner";
import {
  FAVICON_SIZES,
  FaviconItem,
  HTML_HEAD_SNIPPET,
  generateFaviconPackage,
} from "@/lib/favicon-engine";
import { downloadBlob } from "@/lib/screenshot";

export function FaviconGeneratorTool() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [icons, setIcons] = useState<FaviconItem[]>([]);
  const [zipBlob, setZipBlob] = useState<Blob | null>(null);
  const [appName, setAppName] = useState<string>("My App");
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputId = useId();

  // Load image and generate favicons
  const handleLogoSelect = (uploadedFile: File) => {
    if (!uploadedFile.type.startsWith("image/")) {
      toast.error("Please upload an image file (PNG, SVG, JPG).");
      return;
    }

    const url = URL.createObjectURL(uploadedFile);
    setFile(uploadedFile);
    setPreviewUrl(url);

    setIsProcessing(true);
    toast.info("Generating all favicon formats & PWA manifest...");

    const img = new Image();
    img.onload = async () => {
      try {
        const result = await generateFaviconPackage(img, appName);
        setIcons(result.icons);
        setZipBlob(result.zipBlob);
        toast.success("Generated complete favicon package!");
      } catch (err: any) {
        toast.error(err?.message || "Failed to generate favicons.");
      } finally {
        setIsProcessing(false);
      }
    };
    img.src = url;
  };

  // Download ZIP
  const handleDownloadZip = () => {
    if (!zipBlob) return;
    downloadBlob(zipBlob, `favicon-package-${Date.now()}.zip`);
    toast.success("Downloaded favicon package ZIP!");
  };

  // Copy HTML Snippet
  const copyHtml = () => {
    navigator.clipboard.writeText(HTML_HEAD_SNIPPET);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Copied HTML <head> tags to clipboard!");
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-500">
          <Zap className="h-3.5 w-3.5" />
          Web & App Developer Studio
        </div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Favicon & Complete App Icon Generator
        </h1>
        <p className="mt-2 text-sm text-muted-foreground sm:text-base">
          Upload 1 logo or icon and automatically generate the complete favicon package: favicon.ico, Apple Touch Icon (180x180), Android 192/512px, and site.webmanifest.
        </p>
      </div>

      {!previewUrl ? (
        /* Upload Hero Dropzone */
        <div
          onClick={() => fileInputRef.current?.click()}
          className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-border/80 bg-card/60 p-12 text-center transition hover:border-amber-500/60 hover:bg-muted/30 cursor-pointer shadow-lg"
        >
          <div className="rounded-2xl bg-amber-500/10 p-5 text-amber-500 mb-4 shadow-inner">
            <Zap className="h-10 w-10" />
          </div>
          <h2 className="text-xl font-bold text-foreground">
            Drop your brand logo or app icon here
          </h2>
          <p className="mt-2 text-sm text-muted-foreground max-w-md">
            Ideally a square image (512×512 or higher). PNG with transparent background recommended.
          </p>
          <button
            type="button"
            className="mt-6 flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-bold text-black shadow-md hover:bg-amber-400 transition"
          >
            <Upload className="h-4 w-4" />
            Select Logo / Image
          </button>
          <input
            id={fileInputId}
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleLogoSelect(e.target.files[0])}
          />
        </div>
      ) : (
        /* Generated Favicons & Previews */
        <div className="space-y-6">
          {/* Action Header */}
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-border/60 bg-card p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <img
                src={previewUrl}
                alt="Original"
                className="h-12 w-12 rounded-xl border border-border/60 object-contain bg-white/5 p-1"
              />
              <div>
                <span className="text-sm font-bold text-foreground">{file?.name}</span>
                <span className="text-xs text-muted-foreground block">
                  Generated {icons.length + 2} files (ICO, PNGs, WebManifest)
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setFile(null);
                  setPreviewUrl(null);
                  setIcons([]);
                  setZipBlob(null);
                }}
                className="flex items-center gap-1.5 rounded-xl border border-border/60 bg-muted/40 px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Change Logo
              </button>

              <button
                type="button"
                onClick={handleDownloadZip}
                className="flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2 text-xs font-bold text-black shadow-md hover:bg-amber-400 transition"
              >
                <Archive className="h-4 w-4" />
                Download Package (.ZIP)
              </button>
            </div>
          </div>

          {/* Generated Icons Grid */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
            {icons.map((item) => (
              <div
                key={item.name}
                className="flex flex-col items-center justify-between rounded-2xl border border-border/60 bg-card p-4 shadow-sm text-center"
              >
                <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-neutral-900 border border-border/40 p-2">
                  <img
                    src={item.dataUrl}
                    alt={item.name}
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
                <div className="mt-3">
                  <span className="text-xs font-bold text-foreground block truncate max-w-[120px]">
                    {item.name}
                  </span>
                  <span className="text-[10px] font-mono text-muted-foreground">
                    {item.size} × {item.size} px
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* HTML <head> Snippet */}
          <div className="rounded-3xl border border-border/80 bg-neutral-950 p-6 shadow-xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-400">
                <Code className="h-4 w-4" />
                <span className="text-xs font-bold uppercase tracking-wider">
                  HTML &lt;head&gt; Integration Tags
                </span>
              </div>
              <button
                type="button"
                onClick={copyHtml}
                className="flex items-center gap-1.5 rounded-xl border border-border/60 bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-neutral-800 transition"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied" : "Copy Tags"}
              </button>
            </div>

            <pre className="rounded-2xl border border-border/40 bg-neutral-900/80 p-4 font-mono text-xs text-amber-300 overflow-x-auto leading-relaxed">
              {HTML_HEAD_SNIPPET}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import React, { useState, useRef, useId } from "react";
import {
  Lock,
  Unlock,
  Upload,
  Download,
  Copy,
  Check,
  ShieldCheck,
  RotateCcw,
  Sparkles,
  EyeOff,
} from "lucide-react";
import { toast } from "sonner";
import {
  decodeSecretFromImage,
  encodeSecretInImage,
} from "@/lib/steganography-engine";
import { downloadBlob } from "@/lib/screenshot";

export function SteganographyTool() {
  const [mode, setMode] = useState<"encode" | "decode">("encode");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [secretText, setSecretText] = useState<string>(
    "© 2026 Mujib Ur Rahman. All rights reserved. Registered intellectual property."
  );
  const [decodedMessage, setDecodedMessage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputId = useId();

  // Load Image
  const handleImageSelect = (uploadedFile: File) => {
    if (!uploadedFile.type.startsWith("image/")) {
      toast.error("Please upload an image file (PNG, JPG, WebP).");
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);

    const url = URL.createObjectURL(uploadedFile);
    setFile(uploadedFile);
    setPreviewUrl(url);
    setDecodedMessage(null);
    toast.success(`Loaded image: ${uploadedFile.name}`);
  };

  // Run Encode & Download PNG
  const handleEncodeAndDownload = async () => {
    if (!file || !previewUrl) {
      toast.error("Please upload an image first.");
      return;
    }
    if (!secretText.trim()) {
      toast.error("Please enter a secret message to embed.");
      return;
    }

    try {
      setIsProcessing(true);
      toast.info("Encoding secret message into pixel bits...");

      const img = new Image();
      img.onerror = () => {
        setIsProcessing(false);
        toast.error("Failed to load source image.");
      };
      img.onload = async () => {
        try {
          const encodedBlob = await encodeSecretInImage(img, secretText);
          const baseName = file.name.replace(/\.[^/.]+$/, "");
          downloadBlob(encodedBlob, `${baseName}-steganography.png`);
          toast.success("Downloaded image with invisibly embedded secret!");
        } catch (err: any) {
          toast.error(err?.message || "Failed to encode message.");
        } finally {
          setIsProcessing(false);
        }
      };
      img.src = previewUrl;
    } catch (err: any) {
      setIsProcessing(false);
      toast.error(err?.message || "Error processing image.");
    }
  };

  // Run Decode
  const handleDecode = async () => {
    if (!file || !previewUrl) {
      toast.error("Please upload an image to scan for hidden data.");
      return;
    }

    try {
      setIsProcessing(true);
      toast.info("Scanning pixel bits for hidden messages...");

      const img = new Image();
      img.onerror = () => {
        setIsProcessing(false);
        toast.error("Failed to load source image.");
      };
      img.onload = async () => {
        try {
          const recovered = await decodeSecretFromImage(img);
          setDecodedMessage(recovered);
          toast.success("Successfully extracted hidden secret message!");
        } catch (err: any) {
          toast.error(err?.message || "No hidden message found.");
          setDecodedMessage(null);
        } finally {
          setIsProcessing(false);
        }
      };
      img.src = previewUrl;
    } catch {
      setIsProcessing(false);
      toast.error("Error decoding image.");
    }
  };

  const copyDecoded = () => {
    if (!decodedMessage) return;
    navigator.clipboard.writeText(decodedMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Copied message to clipboard!");
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/10 px-3 py-1 text-xs font-semibold text-violet-400">
          <EyeOff className="h-3.5 w-3.5" />
          Digital Rights & Steganography Hub
        </div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Invisible Image Steganography & Anti-Theft Studio
        </h1>
        <p className="mt-2 text-sm text-muted-foreground sm:text-base">
          Hide secret messages, ownership proofs, or copyright signatures invisibly inside image pixels (LSB). The photo looks 100% untouched to the naked eye.
        </p>
      </div>

      {/* Mode Switcher Tabs */}
      <div className="flex justify-center mb-6">
        <div className="grid grid-cols-2 gap-1 rounded-2xl bg-card border border-border/60 p-1 w-full max-w-md shadow-sm">
          <button
            type="button"
            onClick={() => {
              setMode("encode");
              setDecodedMessage(null);
            }}
            className={`flex items-center justify-center gap-2 rounded-xl py-2 text-xs font-bold transition ${
              mode === "encode"
                ? "bg-primary text-primary-foreground shadow"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Lock className="h-3.5 w-3.5" />
            Embed Secret Message
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("decode");
              setDecodedMessage(null);
            }}
            className={`flex items-center justify-center gap-2 rounded-xl py-2 text-xs font-bold transition ${
              mode === "decode"
                ? "bg-violet-600 text-white shadow"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Unlock className="h-3.5 w-3.5" />
            Extract Secret Message
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Image Canvas / Upload */}
        <div className="space-y-4 lg:col-span-7">
          {!previewUrl ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-border/80 bg-card/60 p-12 text-center transition hover:border-violet-500/60 hover:bg-muted/30 cursor-pointer shadow-lg"
            >
              <div className="rounded-2xl bg-violet-500/10 p-5 text-violet-400 mb-4 shadow-inner">
                <Upload className="h-10 w-10" />
              </div>
              <h2 className="text-xl font-bold text-foreground">
                Drop your image here (PNG or JPG)
              </h2>
              <p className="mt-2 text-sm text-muted-foreground max-w-md">
                For best results, use PNG to prevent lossy compression from altering pixel bits.
              </p>
              <input
                id={fileInputId}
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleImageSelect(e.target.files[0])}
              />
            </div>
          ) : (
            <div className="rounded-3xl border border-border/80 bg-card p-4 shadow-xl space-y-4">
              <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-neutral-950 flex items-center justify-center">
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="max-h-full max-w-full object-contain"
                />
              </div>

              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="truncate max-w-[280px] font-semibold text-foreground">
                  {file?.name}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setFile(null);
                    setPreviewUrl(null);
                    setDecodedMessage(null);
                  }}
                  className="flex items-center gap-1 hover:text-foreground transition"
                >
                  <RotateCcw className="h-3 w-3" /> Change Photo
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Controls */}
        <div className="space-y-4 lg:col-span-5">
          <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-xl space-y-4">
            {mode === "encode" ? (
              /* Embed Controls */
              <>
                <div>
                  <label className="text-xs font-bold text-foreground block mb-1">
                    Secret Message or Copyright Proof to Embed
                  </label>
                  <textarea
                    rows={5}
                    value={secretText}
                    onChange={(e) => setSecretText(e.target.value)}
                    placeholder="Type secret text, copyright claim, or cryptographic key..."
                    className="w-full rounded-xl border border-border/60 bg-background p-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 font-mono"
                  />
                  <span className="text-[10px] text-muted-foreground block mt-1">
                    Characters: {secretText.length} • Embedded into RGB LSBs
                  </span>
                </div>

                <button
                  type="button"
                  disabled={!previewUrl || isProcessing}
                  onClick={handleEncodeAndDownload}
                  className="w-full flex items-center justify-center gap-2 rounded-2xl bg-primary py-3 text-xs font-bold text-primary-foreground shadow-lg hover:opacity-90 transition disabled:opacity-40"
                >
                  <Download className="h-4 w-4" />
                  {isProcessing ? "Embedding Bits..." : "Embed Secret & Download Clean PNG"}
                </button>
              </>
            ) : (
              /* Extract Controls */
              <>
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Upload an image that contains hidden steganography data to recover the message.
                  </p>

                  <button
                    type="button"
                    disabled={!previewUrl || isProcessing}
                    onClick={handleDecode}
                    className="w-full flex items-center justify-center gap-2 rounded-2xl bg-violet-600 py-3 text-xs font-bold text-white shadow-lg hover:bg-violet-500 transition disabled:opacity-40"
                  >
                    <Unlock className="h-4 w-4" />
                    {isProcessing ? "Scanning Image Bits..." : "Extract Hidden Secret Message"}
                  </button>

                  {/* Decoded Message Card */}
                  {decodedMessage && (
                    <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/5 p-4 space-y-3 animate-in fade-in">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                          <ShieldCheck className="h-4 w-4" /> Secret Message Found:
                        </span>
                        <button
                          type="button"
                          onClick={copyDecoded}
                          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition"
                        >
                          {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                          {copied ? "Copied" : "Copy"}
                        </button>
                      </div>

                      <div className="rounded-xl border border-border/60 bg-card p-3 font-mono text-xs text-foreground whitespace-pre-wrap break-all">
                        {decodedMessage}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Layers,
  Sparkles,
  Copy,
  Download,
  Share2,
  Check,
  RotateCcw,
  Sliders,
  Code2,
  Sun,
  Eye,
  Palette,
} from "lucide-react";
import { toast } from "sonner";
import {
  StudioState,
  INITIAL_STUDIO_STATE,
  calculateHarmonicShadows,
  getHarmonicShadowCss,
  generateTailwindClasses,
  generateRawCss,
  generateReactStyles,
  renderMeshCanvas,
} from "@/lib/glass-engine";
import { useToolDraft } from "@/lib/use-draft";
import { DraftBanner } from "@/components/draft-banner";
import { shareBlob } from "@/lib/share";

export function GlassGeneratorTool() {
  const [state, setState] = useState<StudioState>(INITIAL_STUDIO_STATE);
  const [copiedFormat, setCopiedFormat] = useState<string | null>(null);

  // 3D Tilt coordinates
  const [tilt, setTilt] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isHovering, setIsHovering] = useState<boolean>(false);

  const previewCardRef = useRef<HTMLDivElement | null>(null);
  const meshCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Draft persistence
  const { hasDraft, draftDate, restoreDraft, discardDraft } = useToolDraft(
    "glass-generator",
    state,
    (saved) => {
      setState(saved);
      toast.success("Glass & Shadow studio settings restored!");
    }
  );

  // Render background mesh
  useEffect(() => {
    if (meshCanvasRef.current) {
      renderMeshCanvas(meshCanvasRef.current, state.mesh, 800, 500);
    }
  }, [state.mesh]);

  // Mouse move handler for interactive 3D card tilt & specular reflection
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const card = previewCardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotateX = ((y - centerY) / centerY) * -12;
    const rotateY = ((x - centerX) / centerX) * 12;

    setTilt({ x: rotateX, y: rotateY });
  };

  const handleMouseLeave = () => {
    setIsHovering(false);
    setTilt({ x: 0, y: 0 });
  };

  // Copy code helpers
  const handleCopy = (text: string, format: string) => {
    navigator.clipboard.writeText(text);
    setCopiedFormat(format);
    toast.success(`Copied ${format} to clipboard!`);
    setTimeout(() => setCopiedFormat(null), 2000);
  };

  // Download high-res PNG
  const handleDownload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 800;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Draw background mesh
    renderMeshCanvas(canvas, state.mesh, 1200, 800);

    // Draw card
    const cardW = 600;
    const cardH = 360;
    const cardX = (1200 - cardW) / 2;
    const cardY = (800 - cardH) / 2;

    ctx.save();
    ctx.shadowColor = "rgba(0, 0, 0, 0.4)";
    ctx.shadowBlur = 40;
    ctx.shadowOffsetY = 20;

    ctx.fillStyle = state.glass.bgRgba;
    ctx.strokeStyle = state.glass.borderColor;
    ctx.lineWidth = state.glass.borderWidth * 2;

    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, cardH, state.glass.borderRadius * 1.5);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    canvas.toBlob((blob) => {
      if (blob) {
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "glassmorphic_card_studio.png";
        link.click();
        toast.success("Downloaded high-res PNG!");
      }
    });
  };

  const shadowLayers = calculateHarmonicShadows(state.shadow);
  const shadowCss = getHarmonicShadowCss(shadowLayers);
  const tailwindClasses = generateTailwindClasses(state);
  const rawCss = generateRawCss(state);
  const reactStyle = generateReactStyles(state);

  return (
    <div className="space-y-6">
      <DraftBanner
        hasDraft={hasDraft}
        draftDate={draftDate}
        onRestore={restoreDraft}
        onDiscard={discardDraft}
      />

      {/* Header controls & stats */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/80 p-5 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-2.5">
            <Layers className="h-6 w-6 text-indigo-500" />
            CSS Box Shadow, Mesh Gradient &amp; 3D Glass Studio
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Design Apple VisionOS frosted glassmorphism, Josh Comeau harmonic diffuse shadows, and vibrant mesh gradients.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleDownload}
            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 transition shadow-md hover:shadow-indigo-500/20"
          >
            <Download className="h-4 w-4" />
            Download PNG
          </button>
        </div>
      </div>

      {/* Interactive 3D Canvas Preview */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-950 p-8 shadow-inner flex flex-col items-center relative overflow-hidden select-none">
        {/* Swappable Background Canvas */}
        <canvas
          ref={meshCanvasRef}
          className="absolute inset-0 w-full h-full object-cover opacity-80 pointer-events-none"
        />

        <div className="w-full flex items-center justify-between z-10 mb-8 text-xs text-zinc-300">
          <span className="font-semibold flex items-center gap-1.5">
            <Sparkles className="h-4 w-4 text-indigo-400" />
            Interactive 3D Refraction Card (Move cursor over card)
          </span>
          <span className="font-mono text-zinc-400">
            Blur: {state.glass.blurPx}px • Elevation: {state.shadow.elevation}
          </span>
        </div>

        {/* 3D Tilting Glass Card */}
        <div
          ref={previewCardRef}
          onMouseMove={handleMouseMove}
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={handleMouseLeave}
          style={{
            transform: `perspective(1000px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
            transition: isHovering ? "transform 0.08s ease-out" : "transform 0.5s ease-out",
            background: state.glass.bgRgba,
            backdropFilter: `blur(${state.glass.blurPx}px) saturate(${state.glass.saturationPercent}%)`,
            WebkitBackdropFilter: `blur(${state.glass.blurPx}px) saturate(${state.glass.saturationPercent}%)`,
            border: `${state.glass.borderWidth}px solid ${state.glass.borderColor}`,
            borderRadius: `${state.glass.borderRadius}px`,
            boxShadow: shadowCss,
          }}
          className="relative z-10 w-full max-w-md p-8 cursor-pointer transition-shadow duration-200 text-white"
        >
          {/* Specular Inner Highlight Glint */}
          <div
            className="absolute inset-0 pointer-events-none rounded-[inherit]"
            style={{
              background: `radial-gradient(circle at ${50 + tilt.y * 3}% ${50 - tilt.x * 3}%, rgba(255, 255, 255, 0.25) 0%, transparent 60%)`,
            }}
          />

          <div className="relative z-10 space-y-4">
            <div className="flex items-center justify-between">
              <span className="px-3 py-1 rounded-full text-[11px] font-bold tracking-wider uppercase bg-white/20 border border-white/30 backdrop-blur-md">
                VisionOS Glass
              </span>
              <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center border border-white/20">
                <Sun className="h-4 w-4 text-white" />
              </div>
            </div>

            <div>
              <h3 className="text-xl font-bold tracking-tight text-white drop-shadow-sm">
                Harmonic Specular Card
              </h3>
              <p className="text-xs text-white/80 mt-1 leading-relaxed">
                Notice how the multi-layer shadow diffuses naturally into the ambient mesh while the backdrop blur refracts colors smoothly.
              </p>
            </div>

            <div className="pt-3 border-t border-white/15 flex items-center justify-between text-xs text-white/70">
              <span>Dynamic Lighting</span>
              <span className="font-mono text-white/90">Active</span>
            </div>
          </div>
        </div>
      </div>

      {/* 1-Click Code Generators */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/80 p-6 shadow-sm space-y-4">
        <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
          <Code2 className="h-4 w-4 text-indigo-500" />
          1-Click Export Code Snippets
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Tailwind */}
          <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 flex flex-col justify-between space-y-3">
            <div>
              <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Tailwind CSS</span>
              <p className="text-[11px] font-mono text-zinc-500 mt-1 line-clamp-2">{tailwindClasses}</p>
            </div>
            <button
              type="button"
              onClick={() => handleCopy(tailwindClasses, "Tailwind")}
              className="flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition"
            >
              {copiedFormat === "Tailwind" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copiedFormat === "Tailwind" ? "Copied!" : "Copy Tailwind"}
            </button>
          </div>

          {/* Raw CSS */}
          <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 flex flex-col justify-between space-y-3">
            <div>
              <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Pure CSS / SCSS</span>
              <p className="text-[11px] font-mono text-zinc-500 mt-1 line-clamp-2">{rawCss}</p>
            </div>
            <button
              type="button"
              onClick={() => handleCopy(rawCss, "CSS")}
              className="flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-semibold shadow-sm transition"
            >
              {copiedFormat === "CSS" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copiedFormat === "CSS" ? "Copied!" : "Copy Pure CSS"}
            </button>
          </div>

          {/* React Styles */}
          <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 flex flex-col justify-between space-y-3">
            <div>
              <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">React Style Object</span>
              <p className="text-[11px] font-mono text-zinc-500 mt-1 line-clamp-2">{reactStyle}</p>
            </div>
            <button
              type="button"
              onClick={() => handleCopy(reactStyle, "React")}
              className="flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-semibold shadow-sm transition"
            >
              {copiedFormat === "React" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copiedFormat === "React" ? "Copied!" : "Copy React Style"}
            </button>
          </div>
        </div>
      </div>

      {/* Configuration Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Frosted Glassmorphism Controls */}
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/80 p-6 shadow-sm space-y-4">
          <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Sliders className="h-4 w-4 text-indigo-500" />
            Frosted Glassmorphism Controls
          </h2>

          {/* Blur */}
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
              <span>Backdrop Blur Radius</span>
              <span className="font-mono text-indigo-600 dark:text-indigo-400">
                {state.glass.blurPx}px
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={40}
              value={state.glass.blurPx}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                setState((s) => ({ ...s, glass: { ...s.glass, blurPx: val } }));
              }}
              className="w-full accent-indigo-600"
            />
          </div>

          {/* Saturation */}
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
              <span>Saturation Boost</span>
              <span className="font-mono text-indigo-600 dark:text-indigo-400">
                {state.glass.saturationPercent}%
              </span>
            </div>
            <input
              type="range"
              min={100}
              max={250}
              value={state.glass.saturationPercent}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                setState((s) => ({ ...s, glass: { ...s.glass, saturationPercent: val } }));
              }}
              className="w-full accent-indigo-600"
            />
          </div>

          {/* Corner Radius */}
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
              <span>Border Radius</span>
              <span className="font-mono text-indigo-600 dark:text-indigo-400">
                {state.glass.borderRadius}px
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={48}
              value={state.glass.borderRadius}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                setState((s) => ({ ...s, glass: { ...s.glass, borderRadius: val } }));
              }}
              className="w-full accent-indigo-600"
            />
          </div>
        </div>

        {/* Harmonic Multi-Layer Shadow Controls */}
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/80 p-6 shadow-sm space-y-4">
          <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Layers className="h-4 w-4 text-indigo-500" />
            Harmonic Diffuse Shadow Controls
          </h2>

          {/* Elevation */}
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
              <span>Shadow Elevation</span>
              <span className="font-mono text-indigo-600 dark:text-indigo-400">
                Level {state.shadow.elevation}
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={10}
              value={state.shadow.elevation}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                setState((s) => ({ ...s, shadow: { ...s.shadow, elevation: val } }));
              }}
              className="w-full accent-indigo-600"
            />
          </div>

          {/* Layers Count */}
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
              <span>Harmonic Layers</span>
              <span className="font-mono text-indigo-600 dark:text-indigo-400">
                {state.shadow.layersCount} Layers
              </span>
            </div>
            <input
              type="range"
              min={3}
              max={6}
              value={state.shadow.layersCount}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                setState((s) => ({ ...s, shadow: { ...s.shadow, layersCount: val } }));
              }}
              className="w-full accent-indigo-600"
            />
          </div>

          {/* Angle */}
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
              <span>Light Angle</span>
              <span className="font-mono text-indigo-600 dark:text-indigo-400">
                {state.shadow.angleDeg}°
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={360}
              value={state.shadow.angleDeg}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                setState((s) => ({ ...s, shadow: { ...s.shadow, angleDeg: val } }));
              }}
              className="w-full accent-indigo-600"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

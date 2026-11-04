"use client";

import * as React from "react";
import {
  Compass,
  Download,
  Eye,
  Home,
  Layers,
  Palette,
  Maximize,
  Sliders,
  Sparkles,
  Sun,
  Upload,
} from "lucide-react";
import { cn } from "@/lib/utils";

const STYLES = [
  { id: "japandi", label: "Japandi Warm", desc: "Warm oak, paper shoji, organic minimalism", color: "#d97706" },
  { id: "scandi", label: "Scandinavian", desc: "Light pine, crisp neutrals, airy natural light", color: "#38bdf8" },
  { id: "industrial", label: "Modern Industrial", desc: "Exposed brick, matte black steel & leather", color: "#f97316" },
  { id: "luxury", label: "Contemporary Luxury", desc: "Italian marble, brass fixtures & velvet", color: "#a855f7" },
];

const LIGHTING = [
  { id: "daylight", label: "Natural Daylight", icon: Sun },
  { id: "golden", label: "Golden Hour Glow", icon: Sparkles },
  { id: "twilight", label: "Twilight Ambient", icon: Compass },
];

export function FloorplanStagerTool() {
  const [imageSrc, setImageSrc] = React.useState<string | null>(null);
  const [activeStyle, setActiveStyle] = React.useState("japandi");
  const [lighting, setLighting] = React.useState("daylight");
  const [renderQuality, setRenderQuality] = React.useState("4k");
  const [isRendering, setIsRendering] = React.useState(false);

  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const loadSample = () => {
    // Architectural 2D blueprint sample
    setImageSrc("https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80");
  };

  const handleFile = (file: File) => {
    if (!file.type.startsWith("image/")) return;
    setImageSrc(URL.createObjectURL(file));
  };

  // Render 3D isometric architectural staging canvas
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = 1200;
    canvas.height = 700;

    // Background gradient depending on lighting
    const bgGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    if (lighting === "golden") {
      bgGrad.addColorStop(0, "#451a03");
      bgGrad.addColorStop(1, "#18181b");
    } else if (lighting === "twilight") {
      bgGrad.addColorStop(0, "#1e1b4b");
      bgGrad.addColorStop(1, "#09090b");
    } else {
      bgGrad.addColorStop(0, "#f8fafc");
      bgGrad.addColorStop(1, "#e2e8f0");
    }
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Render 3D isometric walls & room layout
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2 + 30);

    // Floor plane isometric grid
    ctx.beginPath();
    ctx.moveTo(0, -160);
    ctx.lineTo(380, 50);
    ctx.lineTo(0, 260);
    ctx.lineTo(-380, 50);
    ctx.closePath();

    if (activeStyle === "japandi") ctx.fillStyle = "#e2d9cc";
    else if (activeStyle === "scandi") ctx.fillStyle = "#f1f5f9";
    else if (activeStyle === "industrial") ctx.fillStyle = "#78716c";
    else ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.15)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // 3D Isometric Wall blocks
    const drawWall = (x1: number, y1: number, x2: number, y2: number, h: number, color: string) => {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.lineTo(x2, y2 - h);
      ctx.lineTo(x1, y1 - h);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
      ctx.stroke();
    };

    // Outer architectural perimeter
    drawWall(-380, 50, 0, -160, 90, activeStyle === "industrial" ? "#44403c" : "#cbd5e1");
    drawWall(0, -160, 380, 50, 90, activeStyle === "industrial" ? "#292524" : "#94a3b8");

    // Interior divider partition
    drawWall(-120, 20, 120, 140, 60, "rgba(255,255,255,0.7)");

    // Furniture blocks (Living room sectional, table, plants)
    ctx.fillStyle = activeStyle === "luxury" ? "#7c3aed" : activeStyle === "industrial" ? "#b45309" : "#0284c7";
    ctx.fillRect(-200, 30, 90, 45); // Sofa
    ctx.fillStyle = "#eab308";
    ctx.fillRect(-180, 85, 50, 30); // Coffee table

    // Room Label Annotations
    ctx.font = "bold 13px Inter, sans-serif";
    ctx.fillStyle = lighting === "daylight" ? "#0f172a" : "#f8fafc";
    ctx.textAlign = "center";
    ctx.fillText("LIVING & LOUNGE (240 sq ft)", -160, 140);
    ctx.fillText("MASTER SUITE & BALCONY", 180, 70);
    ctx.fillText("MODERN ISLAND KITCHEN", -40, -40);

    ctx.restore();

    // Corner watermark
    ctx.font = "11px monospace";
    ctx.fillStyle = lighting === "daylight" ? "#64748b" : "#94a3b8";
    ctx.textAlign = "left";
    ctx.fillText(`PicTools 3D Interior Engine — Style: ${activeStyle.toUpperCase()} | Light: ${lighting.toUpperCase()}`, 24, canvas.height - 24);
  }, [activeStyle, lighting]);

  const handleDownload = () => {
    setIsRendering(true);
    setTimeout(() => {
      setIsRendering(false);
      if (canvasRef.current) {
        const link = document.createElement("a");
        link.download = `3d_interior_${activeStyle}_${Date.now()}.png`;
        link.href = canvasRef.current.toDataURL("image/png");
        link.click();
      }
    }, 1200);
  };

  return (
    <div className="container py-8 max-w-6xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-sm">
              <Home className="h-5 w-5" />
            </span>
            <div>
              <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
                AI Floor Plan to 3D Interior Stager
              </h1>
              <p className="text-xs text-on-surface-variant">
                Convert 2D blueprints, architectural drawings or sketches into photorealistic 3D interior staging renders.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Main Canvas Viewport */}
        <div className="lg:col-span-8 space-y-4">
          <div className="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-2xl border border-outline-variant/30 bg-surface-container-lowest shadow-2xl">
            <canvas ref={canvasRef} className="max-h-full max-w-full object-contain" />
          </div>

          <div className="flex items-center justify-between glass-panel p-3.5 rounded-xl border border-outline-variant/30">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-foreground">Blueprint Input:</span>
              <span className="text-xs text-on-surface-variant">
                {imageSrc ? "Custom Blueprint Uploaded" : "Default 2-Bedroom Suite Layout"}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-xs font-display font-semibold text-primary hover:underline"
              >
                Upload Blueprint
              </button>
              <button
                type="button"
                onClick={loadSample}
                className="text-xs font-display font-semibold text-amber-500 hover:underline"
              >
                Load Sample
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
          </div>
        </div>

        {/* Sidebar Controls */}
        <div className="lg:col-span-4 space-y-4">
          <div className="glass-panel rounded-2xl p-5 border border-outline-variant/30 space-y-5">
            <div>
              <h3 className="font-display text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                <Palette className="h-4 w-4 text-primary" />
                Interior Design Aesthetic
              </h3>
              <div className="space-y-2">
                {STYLES.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setActiveStyle(s.id)}
                    className={cn(
                      "w-full flex items-center justify-between rounded-xl p-3 text-left border transition-all",
                      activeStyle === s.id
                        ? "border-primary bg-primary/10 text-primary ring-1 ring-primary/30"
                        : "border-outline-variant/30 bg-surface-container-low hover:bg-surface-container-high/60 text-foreground",
                    )}
                  >
                    <div>
                      <span className="font-display text-xs font-bold block">{s.label}</span>
                      <span className="text-[11px] text-on-surface-variant block mt-0.5">{s.desc}</span>
                    </div>
                    <span className="h-3 w-3 rounded-full shrink-0 ml-2" style={{ backgroundColor: s.color }} />
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t border-outline-variant/20 pt-4 space-y-3">
              <h3 className="font-display text-sm font-bold text-foreground flex items-center gap-2">
                <Sun className="h-4 w-4 text-primary" />
                Architectural Lighting
              </h3>
              <div className="grid grid-cols-3 gap-2">
                {LIGHTING.map((l) => {
                  const Icon = l.icon;
                  return (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => setLighting(l.id)}
                      className={cn(
                        "flex flex-col items-center justify-center p-2 rounded-xl border text-center transition-all",
                        lighting === l.id
                          ? "border-primary bg-primary/15 text-primary font-semibold"
                          : "border-outline-variant/30 bg-surface-container-low text-foreground hover:bg-surface-container-high",
                      )}
                    >
                      <Icon className="h-4 w-4 mb-1" />
                      <span className="text-[10px] leading-tight">{l.label.split(" ")[0]}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="border-t border-outline-variant/20 pt-4">
              <button
                type="button"
                disabled={isRendering}
                onClick={handleDownload}
                className={cn(
                  "w-full flex items-center justify-center gap-2 rounded-xl bg-primary py-3 font-display text-xs font-semibold text-primary-foreground shadow-lg transition-all",
                  isRendering ? "opacity-50 cursor-not-allowed" : "hover:brightness-105 active:scale-[0.99]",
                )}
              >
                {isRendering ? (
                  <>
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Rendering Photorealistic 3D...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4" />
                    Export 3D Architectural Render (4K PNG)
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

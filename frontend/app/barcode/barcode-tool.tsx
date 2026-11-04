"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Barcode as BarcodeIcon,
  Download,
  CheckCircle2,
  AlertCircle,
  Copy,
  Printer,
  Sparkles,
  RotateCcw,
  Layers,
  ShoppingBag,
} from "lucide-react";
import { toast } from "sonner";
import {
  BarcodeConfig,
  BarcodeSymbology,
  DEFAULT_BARCODE_CONFIG,
  drawBarcodeLabel,
  validateAndFormatBarcode,
} from "@/lib/barcode-engine";
import { downloadBlob, imagesToPdf, shotFromCanvas } from "@/lib/screenshot";

export function BarcodeTool() {
  const [config, setConfig] = useState<BarcodeConfig>(DEFAULT_BARCODE_CONFIG);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const validation = validateAndFormatBarcode(config.symbology, config.data);

  // Render barcode to canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = 440;
    canvas.height = 180;
    drawBarcodeLabel(ctx, canvas.width, canvas.height, config);
  }, [config]);

  // Download Single Label PNG
  const handleDownloadPng = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `barcode-${config.data}.png`;
    a.click();
    toast.success("Downloaded high-res barcode label!");
  };

  // Generate Avery 30-Up Printable Sheet (PDF)
  const handleDownloadAverySheet = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      toast.info("Generating Avery 30-up label print sheet...");
      // Standard US Letter 30-up (3 columns x 10 rows)
      const sheetCanvas = document.createElement("canvas");
      sheetCanvas.width = 2550; // 300 DPI 8.5" x 11"
      sheetCanvas.height = 3300;
      const ctx = sheetCanvas.getContext("2d");
      if (!ctx) return;

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, sheetCanvas.width, sheetCanvas.height);

      const cols = 3;
      const rows = 10;
      const labelW = 750;
      const labelH = 300;
      const startX = 75;
      const startY = 150;
      const gapX = 37;
      const gapY = 0;

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = startX + c * (labelW + gapX);
          const y = startY + r * (labelH + gapY);
          ctx.drawImage(canvas, x, y, labelW, labelH);
          // Subtle border
          ctx.strokeStyle = "#e5e7eb";
          ctx.strokeRect(x, y, labelW, labelH);
        }
      }

      const shot = await shotFromCanvas(sheetCanvas, "Avery 30-Up Sheet");
      const pdfBlob = await imagesToPdf([shot], {
        pageSize: "letter",
        orientation: "portrait",
        margin: 0,
        quality: 0.95,
      });

      downloadBlob(pdfBlob, `barcode-avery-30up-${config.data}.pdf`);
      toast.success("Downloaded ready-to-print Avery 30-up PDF sheet!");
    } catch {
      toast.error("Failed to generate Avery PDF sheet.");
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <div className="inline-flex items-center gap-2 rounded-full border border-sky-500/20 bg-sky-500/10 px-3 py-1 text-xs font-semibold text-sky-400">
          <BarcodeIcon className="h-3.5 w-3.5" />
          Amazon FBA & Retail Packaging Studio
        </div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          AI E-Commerce Barcode & Smart Label Studio
        </h1>
        <p className="mt-2 text-sm text-muted-foreground sm:text-base">
          Generate Amazon FNSKU, EAN-13, and UPC-A product barcodes with AI checksum validation. Print on standard Avery 30-up label sheets in 1 click.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Label Live Preview & Actions */}
        <div className="space-y-4 lg:col-span-7">
          {/* Label Card */}
          <div className="overflow-hidden rounded-3xl border border-border/80 bg-neutral-100 dark:bg-neutral-900/60 p-8 shadow-xl flex flex-col items-center justify-center">
            <div className="rounded-2xl bg-white p-4 shadow-2xl border border-neutral-200">
              <canvas ref={canvasRef} className="block rounded" />
            </div>

            {/* AI Compliance Status Badge */}
            <div className="mt-6 flex items-center gap-2 rounded-xl bg-card border border-border/60 px-4 py-2 text-xs">
              {validation.isValid ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span className="font-semibold text-foreground">
                    {validation.isAmazonFnsku
                      ? "✓ Amazon FBA FNSKU Compliant (Code 128)"
                      : "✓ Valid Barcode & Checksum"}
                  </span>
                </>
              ) : (
                <>
                  <AlertCircle className="h-4 w-4 text-amber-400" />
                  <span className="font-semibold text-amber-400">
                    {validation.error || "Invalid barcode format"}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Action Export Buttons */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={handleDownloadPng}
              className="flex items-center justify-center gap-2 rounded-2xl bg-primary py-3 text-xs font-bold text-primary-foreground shadow hover:opacity-90 transition"
            >
              <Download className="h-4 w-4" />
              Download Single Label (PNG)
            </button>

            <button
              type="button"
              onClick={handleDownloadAverySheet}
              className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-3 text-xs font-bold text-white shadow hover:bg-emerald-500 transition"
            >
              <Printer className="h-4 w-4" />
              Download Avery 30-Up Print PDF
            </button>
          </div>
        </div>

        {/* Right Column: Settings & Configuration */}
        <div className="space-y-4 lg:col-span-5">
          <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-xl space-y-4">
            {/* Symbology Selector */}
            <div>
              <label className="text-xs font-bold text-foreground block mb-1.5">
                Barcode Standard
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: "code128", label: "Amazon FNSKU (128)", sub: "FBA standard" },
                  { id: "ean13", label: "EAN-13 Retail", sub: "Global retail" },
                  { id: "upca", label: "UPC-A Retail", sub: "USA / Canada" },
                  { id: "code39", label: "Code 39", sub: "Warehouse SKU" },
                ].map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() =>
                      setConfig({
                        ...config,
                        symbology: s.id as BarcodeSymbology,
                        data:
                          s.id === "code128"
                            ? "X003A8K9ZP"
                            : s.id === "ean13"
                            ? "501234567890"
                            : s.id === "upca"
                            ? "01234567890"
                            : "SKU-9921",
                      })
                    }
                    className={`rounded-xl border p-2.5 text-left transition ${
                      config.symbology === s.id
                        ? "border-sky-500 bg-sky-500/10 text-foreground ring-1 ring-sky-500/40"
                        : "border-border/60 bg-background hover:bg-muted text-muted-foreground"
                    }`}
                  >
                    <div className="text-xs font-bold text-foreground">{s.label}</div>
                    <div className="text-[10px] text-muted-foreground">{s.sub}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Barcode Payload */}
            <div>
              <label className="text-xs font-bold text-foreground block mb-1">
                Barcode Value / FNSKU
              </label>
              <input
                type="text"
                value={config.data}
                onChange={(e) => setConfig({ ...config, data: e.target.value })}
                className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-xs font-mono font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 uppercase"
              />
            </div>

            {/* Product Title */}
            <div>
              <label className="text-xs font-bold text-foreground block mb-1">
                Product Title (Header)
              </label>
              <input
                type="text"
                value={config.productTitle || ""}
                onChange={(e) => setConfig({ ...config, productTitle: e.target.value })}
                placeholder="Product name on packaging..."
                className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
              />
            </div>

            {/* SKU and Condition */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-foreground block mb-1">SKU</label>
                <input
                  type="text"
                  value={config.sku || ""}
                  onChange={(e) => setConfig({ ...config, sku: e.target.value })}
                  placeholder="SKU-001"
                  className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-xs text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary/40"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-foreground block mb-1">
                  Condition
                </label>
                <select
                  value={config.condition || "New"}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      condition: e.target.value as "New" | "Used" | "Refurbished",
                    })
                  }
                  className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 cursor-pointer"
                >
                  <option value="New">New</option>
                  <option value="Used">Used</option>
                  <option value="Refurbished">Refurbished</option>
                </select>
              </div>
            </div>

            {/* Bar Height */}
            <div className="pt-2 border-t border-border/40 space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Bar Height</span>
                <span className="font-mono">{config.barHeight}px</span>
              </div>
              <input
                type="range"
                min={40}
                max={90}
                value={config.barHeight}
                onChange={(e) =>
                  setConfig({ ...config, barHeight: parseInt(e.target.value, 10) })
                }
                className="w-full accent-primary"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

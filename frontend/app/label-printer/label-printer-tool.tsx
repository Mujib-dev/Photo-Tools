"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Barcode,
  Printer,
  Download,
  Share2,
  Sparkles,
  Sliders,
  AlertTriangle,
  PackageCheck,
  CheckCircle2,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import {
  DEFAULT_LABEL_CONFIG,
  LabelConfig,
  LabelFormat,
  WarningBadge,
  drawAvery5160Sheet,
  drawSingleFbaLabel,
  drawThermalShippingLabel,
} from "@/lib/label-engine";
import { shareBlob } from "@/lib/share";
import { useToolDraft } from "@/lib/use-draft";
import { DraftBanner } from "@/components/draft-banner";

export function LabelPrinterTool() {
  const [config, setConfig] = useState<LabelConfig>(DEFAULT_LABEL_CONFIG);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Draft persistence
  const { hasDraft, draftDate, restoreDraft, discardDraft } = useToolDraft<LabelConfig>(
    "label-printer",
    config,
    setConfig,
  );

  // Render Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (config.format === "product-barcode-single") {
      canvas.width = 600;
      canvas.height = 240;
      drawSingleFbaLabel(ctx, 10, 10, canvas.width - 20, canvas.height - 20, config);
    } else if (config.format === "thermal-4x6") {
      canvas.width = 800;
      canvas.height = 1200;
      drawThermalShippingLabel(ctx, canvas.width, canvas.height, config);
    } else {
      // avery-5160-30up (Letter proportion)
      canvas.width = 1200;
      canvas.height = 1550;
      drawAvery5160Sheet(ctx, canvas.width, canvas.height, config);
    }
  }, [config]);

  // Print directly to printer
  const handlePrint = () => {
    window.print();
  };

  // Download high-resolution PNG
  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `label-${config.fnsku}-${config.format}.png`;
    a.click();
    toast.success("Downloaded 300 DPI thermal label!");
  };

  // Web Share
  const handleShare = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const ok = await shareBlob(blob, `label-${config.fnsku}.png`, {
        title: `Amazon FBA Label ${config.fnsku}`,
        text: config.productTitle,
      });
      if (ok) toast.success("Shared label!");
    }, "image/png");
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* Print stylesheet */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-label-canvas,
          #printable-label-canvas * {
            visibility: visible;
          }
          #printable-label-canvas {
            position: absolute;
            left: 0;
            top: 0;
            width: 100% !important;
            margin: 0 !important;
            box-shadow: none !important;
          }
          header,
          footer,
          nav,
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* Header */}
      <div className="mb-6 no-print">
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400">
          <Barcode className="h-3.5 w-3.5" />
          Amazon FBA & Thermal Logistics Labeling
        </div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Amazon FBA & Thermal Shipping Label Generator
        </h1>
        <p className="mt-2 text-sm text-muted-foreground sm:text-base">
          Generate scannable Amazon FNSKU barcodes, Avery 5160 30-up sticker sheets, and 4x6&quot; thermal labels for Rollo, Zebra, and Munbyn printers. 300 DPI vector crisp output.
        </p>
      </div>

      <DraftBanner
        hasDraft={hasDraft}
        draftDate={draftDate}
        onRestore={restoreDraft}
        onDiscard={discardDraft}
        className="no-print"
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Canvas Preview */}
        <div className="space-y-4 lg:col-span-7 xl:col-span-8 flex flex-col items-center">
          <div className="w-full overflow-hidden rounded-3xl border border-border/80 bg-neutral-900 p-4 sm:p-8 shadow-2xl flex items-center justify-center">
            <canvas
              id="printable-label-canvas"
              ref={canvasRef}
              className="max-h-[600px] max-w-full object-contain rounded-xl shadow-lg bg-white"
            />
          </div>

          {/* Action Bar */}
          <div className="no-print flex w-full flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground">Format:</span>
              <span className="rounded-lg bg-muted px-2.5 py-1 font-mono text-xs font-bold text-foreground capitalize">
                {config.format.replace(/-/g, " ")}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleShare}
                className="flex items-center gap-1.5 rounded-xl border border-border/60 bg-background px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted"
              >
                <Share2 className="h-3.5 w-3.5 text-emerald-400" />
                Share
              </button>

              <button
                type="button"
                onClick={handleDownload}
                className="flex items-center gap-1.5 rounded-xl border border-border/60 bg-background px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-muted"
              >
                <Download className="h-3.5 w-3.5" />
                Download PNG (300 DPI)
              </button>

              <button
                type="button"
                onClick={handlePrint}
                className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-emerald-500"
              >
                <Printer className="h-4 w-4" />
                Print Labels
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Customizer */}
        <div className="space-y-4 lg:col-span-5 xl:col-span-4 no-print">
          <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-xl space-y-5">
            {/* Format Selector */}
            <div>
              <label className="text-xs font-bold text-foreground block mb-2">
                Label Layout & Sheet Type
              </label>
              <div className="space-y-2">
                {[
                  { id: "product-barcode-single", label: "Single FNSKU Item Sticker", desc: "Standard 2.625\" x 1\" unit sticker" },
                  { id: "thermal-4x6", label: "4x6\" Master Carton Thermal Roll", desc: "Carton shipping box label for Rollo / Zebra" },
                  { id: "avery-5160-30up", label: "Avery 5160 Sheet (30 Labels)", desc: "Standard 8.5 x 11\" laser/inkjet sheet" },
                ].map((f) => {
                  const isSelected = config.format === f.id;
                  return (
                    <div
                      key={f.id}
                      onClick={() => setConfig({ ...config, format: f.id as LabelFormat })}
                      className={`cursor-pointer rounded-2xl border p-3 transition ${
                        isSelected
                          ? "border-emerald-500 bg-emerald-500/10 ring-1 ring-emerald-500/30"
                          : "border-border/60 bg-background hover:bg-muted/40"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-foreground">{f.label}</span>
                        {isSelected && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{f.desc}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* FNSKU / Barcode Input */}
            <div className="space-y-2.5 pt-2 border-t border-border/60">
              <label className="text-xs font-bold text-foreground block">
                FNSKU / UPC / Barcode ID
              </label>
              <input
                type="text"
                value={config.fnsku}
                onChange={(e) => setConfig({ ...config, fnsku: e.target.value.toUpperCase() })}
                placeholder="e.g. X004BC91KL"
                className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-xs font-mono font-bold uppercase text-foreground"
              />
              <p className="text-[11px] text-muted-foreground">
                Encoded into scannable Code 128 high-contrast vector bars.
              </p>
            </div>

            {/* Product Title */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-foreground block">
                Product Title / SKU Description
              </label>
              <input
                type="text"
                value={config.productTitle}
                onChange={(e) => setConfig({ ...config, productTitle: e.target.value })}
                placeholder="Product name as listed on Amazon"
                className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-xs font-medium text-foreground"
              />
            </div>

            {/* Condition */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                  Item Condition
                </label>
                <select
                  value={config.condition}
                  onChange={(e) => setConfig({ ...config, condition: e.target.value })}
                  className="w-full h-9 rounded-xl border border-border/60 bg-background px-3 text-xs font-semibold"
                >
                  <option value="New">New</option>
                  <option value="Used - Like New">Used - Like New</option>
                  <option value="Refurbished">Refurbished</option>
                  <option value="Collectible">Collectible</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                  Safety Warning
                </label>
                <select
                  value={config.warning}
                  onChange={(e) => setConfig({ ...config, warning: e.target.value as WarningBadge })}
                  className="w-full h-9 rounded-xl border border-border/60 bg-background px-2 text-xs font-semibold"
                >
                  <option value="none">None</option>
                  <option value="suffocation">Suffocation Warning</option>
                  <option value="sold-as-set">Sold as Set</option>
                  <option value="fragile">Fragile</option>
                </select>
              </div>
            </div>

            {/* Sheet Count for Avery 30-up */}
            {config.format === "avery-5160-30up" && (
              <div className="pt-2 border-t border-border/60">
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-semibold text-foreground">Labels per Sheet</span>
                  <span className="font-mono text-muted-foreground">{config.sheetCopies} / 30</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={30}
                  value={config.sheetCopies}
                  onChange={(e) => setConfig({ ...config, sheetCopies: Number(e.target.value) })}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

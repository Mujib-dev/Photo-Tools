"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  BarChart2,
  PieChart,
  TrendingUp,
  Download,
  Plus,
  Trash2,
  Sparkles,
  RotateCcw,
  Sliders,
  Palette,
  Share2,
} from "lucide-react";
import { toast } from "sonner";
import {
  CHART_TEMPLATES,
  CHART_THEMES,
  ChartDataPoint,
  ChartType,
  SAMPLE_CHART_DATA,
  parseChartCsv,
} from "@/lib/chart-engine";
import { parseNaturalLanguageToChart } from "@/lib/infographic-engine";
import { shareBlob } from "@/lib/share";
import { useToolDraft } from "@/lib/use-draft";
import { DraftBanner } from "@/components/draft-banner";

interface ChartDraft {
  chartType: ChartType;
  title: string;
  subtitle: string;
  themeId: string;
  dataPoints: ChartDataPoint[];
}

export function ChartMakerTool() {
  const [chartType, setChartType] = useState<ChartType>("bar");
  const [title, setTitle] = useState<string>("Quarterly Revenue Growth");
  const [subtitle, setSubtitle] = useState<string>("All figures in USD ($)");
  const [themeId, setThemeId] = useState<string>("emerald");
  const [dataPoints, setDataPoints] = useState<ChartDataPoint[]>(SAMPLE_CHART_DATA.revenue);
  const [csvInput, setCsvInput] = useState<string>("");
  const [aiPrompt, setAiPrompt] = useState<string>("");

  const handleGenerateFromAiPrompt = () => {
    if (!aiPrompt.trim()) return;
    const res = parseNaturalLanguageToChart(aiPrompt);
    setTitle(res.title);
    setSubtitle(`${res.metric} • ${res.delta}`);
    setDataPoints(res.points.map((p) => ({ label: p.label, value: p.value })));
    toast.success(`Generated chart from AI prompt: "${res.title}"`);
  };

  const currentDraft: ChartDraft = { chartType, title, subtitle, themeId, dataPoints };
  const { hasDraft, draftDate, restoreDraft, discardDraft } = useToolDraft<ChartDraft>(
    "chart-maker",
    currentDraft,
    (saved) => {
      setChartType(saved.chartType);
      setTitle(saved.title);
      setSubtitle(saved.subtitle);
      setThemeId(saved.themeId);
      setDataPoints(saved.dataPoints);
    },
  );

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Draw Chart on Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = 1200;
    canvas.height = 700;

    // 1. Dark Modern Background
    ctx.fillStyle = "#090d16";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Subtle Grid Background
    ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
    ctx.lineWidth = 1;
    for (let x = 0; x < canvas.width; x += 60) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += 60) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // 2. Title & Subtitle Header
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 28px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(title, 80, 70);

    if (subtitle) {
      ctx.fillStyle = "#94a3b8";
      ctx.font = "14px system-ui, sans-serif";
      ctx.fillText(subtitle, 80, 100);
    }

    // 3. Chart Drawing Dimensions
    const plotX = 80;
    const plotY = 140;
    const plotW = canvas.width - 160;
    const plotH = canvas.height - 220;

    const theme = CHART_THEMES[themeId] || CHART_THEMES.emerald;
    const maxVal = Math.max(...dataPoints.map((d) => d.value), 1);

    if (chartType === "bar") {
      // Bar Chart
      const barCount = dataPoints.length;
      const barWidth = Math.min(100, (plotW / barCount) * 0.6);
      const gap = (plotW - barCount * barWidth) / (barCount + 1);

      dataPoints.forEach((point, i) => {
        const h = (point.value / maxVal) * plotH;
        const bx = plotX + gap + i * (barWidth + gap);
        const by = plotY + plotH - h;

        // Gradient Bar
        const grad = ctx.createLinearGradient(0, by, 0, by + h);
        grad.addColorStop(0, theme.colors[i % theme.colors.length]);
        grad.addColorStop(1, `${theme.colors[i % theme.colors.length]}33`);

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect(bx, by, barWidth, h, [8, 8, 0, 0]);
        ctx.fill();

        // Value on Top
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 13px font-mono, monospace";
        ctx.textAlign = "center";
        ctx.fillText(point.value.toLocaleString(), bx + barWidth / 2, by - 10);

        // Label on Bottom
        ctx.fillStyle = "#94a3b8";
        ctx.font = "13px system-ui, sans-serif";
        ctx.fillText(point.label, bx + barWidth / 2, plotY + plotH + 28);
      });
    } else if (chartType === "donut") {
      // Donut Chart
      const total = dataPoints.reduce((sum, d) => sum + d.value, 0) || 1;
      const centerX = plotX + plotW / 2 - 120;
      const centerY = plotY + plotH / 2;
      const radius = Math.min(plotW, plotH) * 0.42;
      const innerRadius = radius * 0.6;

      let startAngle = -Math.PI / 2;

      dataPoints.forEach((point, i) => {
        const sliceAngle = (point.value / total) * Math.PI * 2;
        const endAngle = startAngle + sliceAngle;

        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, startAngle, endAngle);
        ctx.arc(centerX, centerY, innerRadius, endAngle, startAngle, true);
        ctx.closePath();

        ctx.fillStyle = theme.colors[i % theme.colors.length];
        ctx.fill();

        startAngle = endAngle;
      });

      // Legend on Right
      const legendX = centerX + radius + 60;
      let legendY = centerY - (dataPoints.length * 30) / 2;

      dataPoints.forEach((point, i) => {
        ctx.fillStyle = theme.colors[i % theme.colors.length];
        ctx.beginPath();
        ctx.roundRect(legendX, legendY, 14, 14, 3);
        ctx.fill();

        ctx.fillStyle = "#ffffff";
        ctx.font = "14px system-ui, sans-serif";
        ctx.textAlign = "left";
        const percent = Math.round((point.value / total) * 100);
        ctx.fillText(`${point.label} (${percent}%)`, legendX + 24, legendY + 12);

        legendY += 30;
      });
    } else {
      // Line / Area Chart
      const count = dataPoints.length;
      if (count > 1) {
        const stepX = plotW / (count - 1);

        ctx.beginPath();
        dataPoints.forEach((point, i) => {
          const px = plotX + i * stepX;
          const py = plotY + plotH - (point.value / maxVal) * plotH;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        });

        if (chartType === "area") {
          // Fill gradient area below line
          const lastX = plotX + (count - 1) * stepX;
          ctx.lineTo(lastX, plotY + plotH);
          ctx.lineTo(plotX, plotY + plotH);
          ctx.closePath();

          const areaGrad = ctx.createLinearGradient(0, plotY, 0, plotY + plotH);
          areaGrad.addColorStop(0, `${theme.colors[0]}88`);
          areaGrad.addColorStop(1, `${theme.colors[0]}05`);
          ctx.fillStyle = areaGrad;
          ctx.fill();
        }

        // Stroke line
        ctx.beginPath();
        dataPoints.forEach((point, i) => {
          const px = plotX + i * stepX;
          const py = plotY + plotH - (point.value / maxVal) * plotH;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        });
        ctx.strokeStyle = theme.colors[0];
        ctx.lineWidth = 4;
        ctx.stroke();

        // Draw Point Dots
        dataPoints.forEach((point, i) => {
          const px = plotX + i * stepX;
          const py = plotY + plotH - (point.value / maxVal) * plotH;

          ctx.fillStyle = "#ffffff";
          ctx.beginPath();
          ctx.arc(px, py, 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = theme.colors[0];
          ctx.lineWidth = 3;
          ctx.stroke();

          // Value and label
          ctx.fillStyle = "#ffffff";
          ctx.font = "bold 12px font-mono";
          ctx.textAlign = "center";
          ctx.fillText(point.value.toLocaleString(), px, py - 12);

          ctx.fillStyle = "#94a3b8";
          ctx.font = "13px system-ui";
          ctx.fillText(point.label, px, plotY + plotH + 28);
        });
      }
    }
  }, [chartType, title, subtitle, themeId, dataPoints]);

  // Update Data Row
  const handleUpdateRow = (index: number, field: keyof ChartDataPoint, val: string) => {
    setDataPoints((prev) => {
      const copy = [...prev];
      if (field === "value") {
        copy[index].value = parseFloat(val) || 0;
      } else {
        copy[index].label = val;
      }
      return copy;
    });
  };

  // Add Data Row
  const handleAddRow = () => {
    setDataPoints((prev) => [...prev, { label: `Item ${prev.length + 1}`, value: 50000 }]);
  };

  // Delete Data Row
  const handleDeleteRow = (index: number) => {
    setDataPoints((prev) => prev.filter((_, i) => i !== index));
  };

  // Import CSV text
  const handleImportCsv = () => {
    const parsed = parseChartCsv(csvInput);
    if (parsed.length > 0) {
      setDataPoints(parsed);
      toast.success(`Imported ${parsed.length} data points from CSV!`);
      setCsvInput("");
    } else {
      toast.error("Could not parse CSV. Format: Label, Value (e.g. 'Jan, 1500')");
    }
  };

  // Download Chart PNG
  const handleDownloadPng = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `chart-${chartType}-${Date.now()}.png`;
    a.click();
    toast.success("Downloaded 1200x700 chart PNG!");
  };

  // Web Share
  const handleSharePng = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const ok = await shareBlob(blob, `chart-${chartType}-${Date.now()}.png`, {
        title,
        text: subtitle || "Chart created with PicTools",
      });
      if (ok) toast.success("Shared chart!");
      else toast.info("Sharing not completed.");
    }, "image/png");
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400">
          <BarChart2 className="h-3.5 w-3.5" />
          Data Presentation & Infographics
        </div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Quick Chart & Infographic Studio
        </h1>
        <p className="mt-2 text-sm text-muted-foreground sm:text-base">
          Turn numbers and spreadsheets into publication-ready Bar, Donut, Line, and Area vector charts. 100% in-browser.
        </p>
      </div>

      <DraftBanner
        hasDraft={hasDraft}
        draftDate={draftDate}
        onRestore={restoreDraft}
        onDiscard={discardDraft}
      />

      {/* AI Natural Language Prompt to Chart */}
      <div className="mb-4 rounded-2xl border border-indigo-500/30 bg-indigo-500/5 p-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shadow-sm">
        <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-400 shrink-0">
          <Sparkles className="h-4 w-4 text-indigo-400 animate-pulse" />
          <span>AI Prompt to Chart:</span>
        </div>
        <input
          type="text"
          value={aiPrompt}
          onChange={(e) => setAiPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleGenerateFromAiPrompt();
          }}
          placeholder="e.g. 'SaaS ARR quadrupling across 6 quarters' or 'Q1 to Q4 customer retention 80% to 95%'"
          className="flex-1 rounded-xl border border-border bg-background px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-indigo-500"
        />
        <button
          type="button"
          onClick={handleGenerateFromAiPrompt}
          className="rounded-xl bg-indigo-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-indigo-500 transition shadow-sm shrink-0"
        >
          Generate Chart
        </button>
      </div>

      {/* 1-Click Chart Templates */}
      <div className="mb-6 rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-1">
          <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-emerald-500" />
            1-Click Dataset & Infographic Templates
          </span>
          <span className="text-[11px] text-muted-foreground">Instant metrics, charts, titles & color palettes</span>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {CHART_TEMPLATES.map((tmpl) => (
            <button
              key={tmpl.id}
              type="button"
              onClick={() => {
                setChartType(tmpl.chartType);
                setTitle(tmpl.title);
                setSubtitle(tmpl.subtitle);
                setThemeId(tmpl.themeId);
                setDataPoints(tmpl.dataPoints);
                toast.success(`Loaded "${tmpl.name}" chart template!`);
              }}
              className="group flex flex-col items-start rounded-xl border border-border/70 bg-background/80 p-2.5 text-left transition hover:border-emerald-500/80 hover:bg-emerald-500/5 hover:shadow-sm"
            >
              <span className="mb-1 rounded bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase text-emerald-500 group-hover:bg-emerald-500 group-hover:text-white transition">
                {tmpl.badge}
              </span>
              <span className="line-clamp-1 text-xs font-semibold text-foreground">
                {tmpl.name}
              </span>
              <span className="mt-1 line-clamp-1 text-[10px] text-muted-foreground">
                {tmpl.chartType.toUpperCase()} • {tmpl.dataPoints.length} points
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Canvas Preview */}
        <div className="space-y-4 lg:col-span-8">
          <div className="relative aspect-video w-full overflow-hidden rounded-3xl border border-border/80 bg-black/80 shadow-2xl p-2 flex items-center justify-center">
            <canvas ref={canvasRef} className="h-full w-full object-contain rounded-2xl" />
          </div>

          {/* Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground">Preset:</span>
              <button
                type="button"
                onClick={() => {
                  setDataPoints(SAMPLE_CHART_DATA.revenue);
                  setTitle("Quarterly Revenue Growth");
                  setSubtitle("All figures in USD ($)");
                }}
                className="rounded-lg border border-border/60 bg-background px-2.5 py-1 text-xs text-foreground hover:bg-muted"
              >
                Revenue
              </button>
              <button
                type="button"
                onClick={() => {
                  setDataPoints(SAMPLE_CHART_DATA.traffic);
                  setTitle("Website Visitor Traffic");
                  setSubtitle("Monthly unique users");
                }}
                className="rounded-lg border border-border/60 bg-background px-2.5 py-1 text-xs text-foreground hover:bg-muted"
              >
                Traffic
              </button>
              <button
                type="button"
                onClick={() => {
                  setDataPoints(SAMPLE_CHART_DATA.channels);
                  setTitle("Marketing Acquisition Channels");
                  setSubtitle("Percentage breakdown (%)");
                  setChartType("donut");
                }}
                className="rounded-lg border border-border/60 bg-background px-2.5 py-1 text-xs text-foreground hover:bg-muted"
              >
                Channels
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSharePng}
                className="flex items-center gap-1.5 rounded-xl border border-border/60 bg-background px-3.5 py-2.5 text-xs font-semibold text-foreground hover:bg-muted transition"
                title="Share directly via mobile or desktop"
              >
                <Share2 className="h-4 w-4 text-emerald-400" />
                Share
              </button>
              <button
                type="button"
                onClick={handleDownloadPng}
                className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg hover:bg-emerald-500 transition"
              >
                <Download className="h-4 w-4" />
                Download Chart (PNG)
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Customizer & Data Table */}
        <div className="space-y-4 lg:col-span-4">
          <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-xl space-y-4">
            {/* Chart Type Selector */}
            <div>
              <label className="text-xs font-bold text-foreground block mb-1.5">
                Chart Type
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { id: "bar", label: "Bar" },
                  { id: "donut", label: "Donut" },
                  { id: "line", label: "Line" },
                  { id: "area", label: "Area" },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setChartType(t.id as ChartType)}
                    className={`rounded-xl border py-2 text-xs font-semibold text-center transition ${
                      chartType === t.id
                        ? "border-emerald-500 bg-emerald-500/10 text-foreground ring-1 ring-emerald-500/40"
                        : "border-border/60 bg-background hover:bg-muted text-muted-foreground"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Title & Subtitle */}
            <div className="space-y-2">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Chart Title..."
                className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-xs font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
              />
              <input
                type="text"
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                placeholder="Chart Subtitle / Units..."
                className="w-full rounded-xl border border-border/60 bg-background px-3 py-1.5 text-xs text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
              />
            </div>

            {/* Color Theme */}
            <div>
              <label className="text-xs font-bold text-foreground block mb-1.5">
                Color Palette
              </label>
              <div className="grid grid-cols-2 gap-2">
                {Object.keys(CHART_THEMES).map((k) => {
                  const t = CHART_THEMES[k];
                  const active = themeId === k;
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setThemeId(k)}
                      className={`flex items-center gap-2 rounded-xl border p-2 text-xs transition ${
                        active
                          ? "border-emerald-500 bg-emerald-500/10 text-foreground"
                          : "border-border/60 bg-background hover:bg-muted text-muted-foreground"
                      }`}
                    >
                      <div
                        className="h-3.5 w-3.5 rounded-full shrink-0"
                        style={{ backgroundColor: t.colors[0] }}
                      />
                      <span className="truncate font-semibold">{t.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Data Points Table */}
            <div className="space-y-2 pt-2 border-t border-border/40">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground">Data Points</span>
                <button
                  type="button"
                  onClick={handleAddRow}
                  className="flex items-center gap-1 rounded-lg border border-border/60 bg-muted/40 px-2 py-0.5 text-xs text-foreground hover:bg-muted"
                >
                  <Plus className="h-3 w-3" /> Add
                </button>
              </div>

              <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                {dataPoints.map((row, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={row.label}
                      onChange={(e) => handleUpdateRow(idx, "label", e.target.value)}
                      className="w-24 rounded-lg border border-border/60 bg-background px-2 py-1 text-xs text-foreground"
                    />
                    <input
                      type="number"
                      value={row.value}
                      onChange={(e) => handleUpdateRow(idx, "value", e.target.value)}
                      className="flex-1 rounded-lg border border-border/60 bg-background px-2 py-1 text-xs text-foreground font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => handleDeleteRow(idx)}
                      className="p-1 text-muted-foreground hover:text-red-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* CSV Paste Import */}
            <div className="space-y-1.5 pt-2 border-t border-border/40">
              <label className="text-[11px] text-muted-foreground block">
                Paste CSV (e.g. "Q1, 15000")
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={csvInput}
                  onChange={(e) => setCsvInput(e.target.value)}
                  placeholder="Paste CSV rows..."
                  className="flex-1 rounded-xl border border-border/60 bg-background px-2.5 py-1.5 text-xs text-foreground"
                />
                <button
                  type="button"
                  onClick={handleImportCsv}
                  className="rounded-xl bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground hover:opacity-90"
                >
                  Load
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

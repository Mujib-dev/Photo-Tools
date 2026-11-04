"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  BarChart2,
  TrendingUp,
  Download,
  Share2,
  Sparkles,
  Plus,
  Trash2,
  RotateCcw,
  Sliders,
  Check,
  Palette,
} from "lucide-react";
import { toast } from "sonner";
import {
  InfographicState,
  INITIAL_INFOGRAPHIC_STATE,
  InfographicType,
  parseNaturalLanguageToChart,
  renderInfographicCanvas,
} from "@/lib/infographic-engine";
import { useToolDraft } from "@/lib/use-draft";
import { DraftBanner } from "@/components/draft-banner";
import { shareBlob } from "@/lib/share";

export function InfographicMakerTool() {
  const [state, setState] = useState<InfographicState>(INITIAL_INFOGRAPHIC_STATE);
  const [aiPrompt, setAiPrompt] = useState<string>("SaaS ARR quadrupling across 6 quarters");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Draft persistence
  const { hasDraft, draftDate, restoreDraft, discardDraft } = useToolDraft(
    "infographic-maker",
    state,
    (saved) => {
      setState(saved);
      toast.success("Draft infographic restored!");
    }
  );

  // Render canvas
  const updateCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    renderInfographicCanvas(canvas, state, 0.45);
  }, [state]);

  useEffect(() => {
    updateCanvas();
  }, [updateCanvas]);

  // AI Prompt Handler
  const handleAiGenerate = () => {
    if (!aiPrompt.trim()) return;
    const parsed = parseNaturalLanguageToChart(aiPrompt);
    setState((prev) => ({
      ...prev,
      title: parsed.title,
      dataPoints: parsed.points,
      metricValue: parsed.metric,
      metricDelta: parsed.delta,
    }));
    toast.success("AI synthesized chart metrics from your prompt!");
  };

  // Add Data Point
  const handleAddPoint = () => {
    const nextIdx = state.dataPoints.length + 1;
    setState((prev) => ({
      ...prev,
      dataPoints: [...prev.dataPoints, { label: `Period ${nextIdx}`, value: 500 }],
    }));
  };

  // Remove Data Point
  const handleRemovePoint = (idx: number) => {
    if (state.dataPoints.length <= 2) {
      toast.error("Chart requires at least 2 data points.");
      return;
    }
    setState((prev) => ({
      ...prev,
      dataPoints: prev.dataPoints.filter((_, i) => i !== idx),
    }));
  };

  // Download high-res PNG (2400x1600)
  const handleDownload = () => {
    const offscreen = document.createElement("canvas");
    renderInfographicCanvas(offscreen, state, 2.0);
    offscreen.toBlob((blob) => {
      if (blob) {
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "data_infographic_highres.png";
        link.click();
        toast.success("Downloaded 2400×1600 high-resolution infographic!");
      }
    }, "image/png");
  };

  // Share
  const handleShare = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob(async (blob) => {
      if (blob) {
        await shareBlob(blob, "data_infographic.png", {
          title: state.title,
          text: `${state.metricValue} (${state.metricDelta})`,
        });
      }
    });
  };

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
            <BarChart2 className="h-6 w-6 text-indigo-500" />
            Data Infographic &amp; Animated Chart Studio
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Build high-converting Linear/Vercel-style glowing line charts, racing bars, and KPI metric cards with AI prompt generation.
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
          <button
            type="button"
            onClick={handleShare}
            className="flex items-center gap-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 px-3 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition"
            title="Share"
          >
            <Share2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Canvas Preview (7 Cols) */}
        <div className="lg:col-span-7 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-950 p-6 shadow-inner flex flex-col items-center">
          <div className="w-full flex items-center justify-between pb-3 border-b border-zinc-800 mb-4 text-xs text-zinc-400">
            <span className="font-semibold text-zinc-200">
              {state.type === "linear-gradient-chart" ? "Glowing Line Chart" : "Ranked Comparison Bars"}
            </span>
            <span className="font-mono text-emerald-400">{state.metricDelta}</span>
          </div>

          <div className="relative rounded-2xl overflow-hidden border border-zinc-800 shadow-2xl bg-zinc-900/50">
            <canvas ref={canvasRef} className="block max-h-[480px] w-auto mx-auto" />
          </div>
        </div>

        {/* Right Column: AI Assistant & Data Controls (5 Cols) */}
        <div className="lg:col-span-5 space-y-5">
          {/* AI Prompt Box */}
          <div className="rounded-2xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/50 dark:bg-indigo-950/20 p-5 shadow-sm space-y-3">
            <span className="text-xs font-bold text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              AI Natural Language Chart Generator
            </span>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Describe your metric or business growth, and AI will automatically structure the chart.
            </p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="e.g. Monthly active users up 300% in 5 weeks"
                className="flex-1 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100"
              />
              <button
                type="button"
                onClick={handleAiGenerate}
                className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition"
              >
                Generate
              </button>
            </div>
          </div>

          {/* Chart Style & Theme */}
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/80 p-5 shadow-sm space-y-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-2">
                Chart Visualization Type
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: "linear-gradient-chart", label: "Glowing Line Chart" },
                  { id: "comparison-bars", label: "Comparison Bars" },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setState((s) => ({ ...s, type: t.id as InfographicType }))}
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold transition ${
                      state.type === t.id
                        ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300"
                        : "border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Card Theme
                </label>
                <select
                  value={state.theme}
                  onChange={(e) => setState((s) => ({ ...s, theme: e.target.value as "dark-obsidian" | "minimalist-light" }))}
                  className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-xs"
                >
                  <option value="dark-obsidian">Dark Obsidian</option>
                  <option value="minimalist-light">Minimalist Light</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Glow Accent Color
                </label>
                <div className="flex items-center gap-2 pt-1">
                  {["#6366f1", "#06b6d4", "#10b981", "#f59e0b", "#ec4899"].map((col) => (
                    <button
                      key={col}
                      type="button"
                      onClick={() => setState((s) => ({ ...s, accentColor: col }))}
                      className={`w-6 h-6 rounded-full border transition ${
                        state.accentColor === col ? "ring-2 ring-indigo-500 scale-110" : "border-transparent"
                      }`}
                      style={{ backgroundColor: col }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Data Points List */}
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/80 p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                Data Points
              </label>
              <button
                type="button"
                onClick={handleAddPoint}
                className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold flex items-center gap-1 hover:underline"
              >
                <Plus className="h-3 w-3" />
                Add Point
              </button>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {state.dataPoints.map((pt, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={pt.label}
                    onChange={(e) => {
                      const val = e.target.value;
                      setState((s) => {
                        const pts = [...s.dataPoints];
                        pts[idx] = { ...pts[idx], label: val };
                        return { ...s, dataPoints: pts };
                      });
                    }}
                    className="flex-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-2.5 py-1.5 text-xs"
                  />
                  <input
                    type="number"
                    value={pt.value}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      setState((s) => {
                        const pts = [...s.dataPoints];
                        pts[idx] = { ...pts[idx], value: val };
                        return { ...s, dataPoints: pts };
                      });
                    }}
                    className="w-24 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-2.5 py-1.5 text-xs font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemovePoint(idx)}
                    className="text-zinc-400 hover:text-rose-500 p-1"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

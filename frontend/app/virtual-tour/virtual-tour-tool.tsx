"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Compass,
  RotateCw,
  Download,
  Share2,
  Sparkles,
  Upload,
  Plus,
  Trash2,
  Check,
  Eye,
  FileCode,
  MapPin,
  Home,
} from "lucide-react";
import { toast } from "sonner";
import {
  VirtualTourState,
  INITIAL_VIRTUAL_TOUR_STATE,
  TourRoom,
  TourHotspot,
  renderSphereProjection,
  generateAiRoomInsights,
  generateStandaloneVirtualTourHtml,
} from "@/lib/virtual-tour-engine";
import { useToolDraft } from "@/lib/use-draft";
import { DraftBanner } from "@/components/draft-banner";
import { shareBlob } from "@/lib/share";

export function VirtualTourTool() {
  const [state, setState] = useState<VirtualTourState>(INITIAL_VIRTUAL_TOUR_STATE);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [aiInsights, setAiInsights] = useState<ReturnType<typeof generateAiRoomInsights> | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const panoImgRef = useRef<HTMLImageElement | null>(null);

  // Draft persistence
  const { hasDraft, draftDate, restoreDraft, discardDraft } = useToolDraft(
    "virtual-tour",
    state,
    (saved) => {
      setState(saved);
      toast.success("Draft virtual tour restored!");
    }
  );

  const activeRoom = state.rooms.find((r) => r.id === state.activeRoomId) || state.rooms[0];

  // Render loop
  const updateCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = 800;
    canvas.height = 480;

    renderSphereProjection(
      ctx,
      canvas.width,
      canvas.height,
      panoImgRef.current,
      state.yaw,
      state.pitch,
      state.fov
    );
  }, [state.yaw, state.pitch, state.fov]);

  useEffect(() => {
    updateCanvas();
  }, [updateCanvas]);

  // Mouse pan handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging) return;
    const deltaX = e.clientX - dragStart.x;
    const deltaY = e.clientY - dragStart.y;

    setState((s) => ({
      ...s,
      yaw: s.yaw + deltaX * 0.4,
      pitch: Math.max(-60, Math.min(60, s.pitch - deltaY * 0.4)),
    }));

    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => setIsDragging(false);

  // Panorama Upload
  const handlePanoUpload = (file: File) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      panoImgRef.current = img;
      setState((prev) => ({
        ...prev,
        rooms: prev.rooms.map((r) =>
          r.id === prev.activeRoomId ? { ...r, panoramaUrl: url } : r
        ),
      }));
      updateCanvas();
      toast.success("360° Equirectangular Panorama Loaded!");
    };
    img.src = url;
  };

  // Add room
  const handleAddRoom = () => {
    const nextIdx = state.rooms.length + 1;
    const newRoom: TourRoom = {
      id: `room-${Date.now()}`,
      name: `Room #${nextIdx}`,
      panoramaUrl: "",
      hotspots: [],
    };
    setState((s) => ({
      ...s,
      rooms: [...s.rooms, newRoom],
      activeRoomId: newRoom.id,
    }));
    panoImgRef.current = null;
    toast.success("Added new virtual tour room!");
  };

  // AI Room Insights
  const handleGenerateAiInsights = () => {
    const insights = generateAiRoomInsights(activeRoom.name);
    setAiInsights(insights);
    toast.success("AI analyzed room and generated luxury listing features!");
  };

  // Export HTML
  const handleDownloadHtml = () => {
    const html = generateStandaloneVirtualTourHtml(state);
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "standalone_360_virtual_tour.html";
    link.click();
    toast.success("Downloaded standalone 360° Virtual Tour HTML bundle!");
  };

  // Share
  const handleShare = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob(async (blob) => {
      if (blob) {
        await shareBlob(blob, "virtual_tour_snapshot.png", {
          title: state.title,
          text: `360° Tour: ${activeRoom.name}`,
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
            <Compass className="h-6 w-6 text-indigo-500" />
            360° Virtual Tour &amp; Panoramas Viewer Studio
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Build interactive multi-room 360° tours with clickable hotspots, AI room feature analysis, and standalone HTML export.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleDownloadHtml}
            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 transition shadow-md hover:shadow-indigo-500/20"
          >
            <FileCode className="h-4 w-4" />
            Export Standalone HTML Tour
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

      {/* Main Studio Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: 360 Viewport (7 Cols) */}
        <div className="lg:col-span-7 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-950 p-6 shadow-inner flex flex-col items-center">
          <div className="w-full flex items-center justify-between pb-3 border-b border-zinc-800 mb-4 text-xs text-zinc-400">
            <span className="font-semibold text-zinc-200">{activeRoom.name}</span>
            <span className="font-mono text-zinc-400">
              Yaw: {Math.round(state.yaw)}° • Pitch: {Math.round(state.pitch)}°
            </span>
          </div>

          <div className="relative rounded-2xl overflow-hidden border border-zinc-800 shadow-2xl bg-zinc-900 cursor-grab active:cursor-grabbing">
            <canvas
              ref={canvasRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              className="block max-h-[480px] w-auto mx-auto"
            />
          </div>

          {/* Room Tabs */}
          <div className="w-full flex items-center gap-2 mt-5 pt-3 border-t border-zinc-800 overflow-x-auto">
            {state.rooms.map((room) => (
              <button
                key={room.id}
                type="button"
                onClick={() => {
                  setState((s) => ({ ...s, activeRoomId: room.id }));
                  panoImgRef.current = null;
                }}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition flex items-center gap-1.5 ${
                  state.activeRoomId === room.id
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                    : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                }`}
              >
                <span>{room.name}</span>
                {state.activeRoomId === room.id && <Check className="h-3 w-3" />}
              </button>
            ))}
            <button
              type="button"
              onClick={handleAddRoom}
              className="p-2 rounded-xl border border-dashed border-zinc-700 hover:border-indigo-500 text-zinc-400 hover:text-indigo-400 transition"
              title="Add Room"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Right Column: Room Controls & AI Insights (5 Cols) */}
        <div className="lg:col-span-5 space-y-5">
          {/* Active Room Panorama Upload */}
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/80 p-5 shadow-sm space-y-3">
            <h2 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">
              {activeRoom.name} Configuration
            </h2>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handlePanoUpload(f);
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 hover:border-indigo-500 p-3 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
            >
              <Upload className="h-3.5 w-3.5 text-indigo-500" />
              Upload 360° Equirectangular Panorama Photo
            </button>
          </div>

          {/* AI Room Insights */}
          <div className="rounded-2xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/50 dark:bg-indigo-950/20 p-5 shadow-sm space-y-3">
            <span className="text-xs font-bold text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              AI Property Feature Callouts
            </span>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Analyze room geometry and generate luxury architectural selling points for real estate listings.
            </p>
            <button
              type="button"
              onClick={handleGenerateAiInsights}
              className="w-full py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition"
            >
              Generate AI Room Highlights
            </button>

            {aiInsights && (
              <div className="space-y-2 pt-2 border-t border-indigo-200 dark:border-indigo-900/50 text-xs">
                <p className="italic text-zinc-600 dark:text-zinc-400">"{aiInsights.listingBlurb}"</p>
                <ul className="space-y-1 text-zinc-700 dark:text-zinc-300 list-disc list-inside">
                  {aiInsights.suggestedFeatures.map((feat, idx) => (
                    <li key={idx}>{feat}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

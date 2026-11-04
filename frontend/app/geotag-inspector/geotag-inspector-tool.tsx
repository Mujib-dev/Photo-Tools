"use client";

import React, { useState, useRef } from "react";
import {
  MapPin,
  Navigation,
  Download,
  Share2,
  Sparkles,
  Upload,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Check,
  FileCode,
  Compass,
} from "lucide-react";
import { toast } from "sonner";
import {
  PhotoGeotag,
  parsePhotoGeotag,
  generateAiTripStory,
  generateStandaloneHtmlMap,
  generateGpxRoute,
} from "@/lib/geotag-inspector-engine";
import { useToolDraft } from "@/lib/use-draft";
import { DraftBanner } from "@/components/draft-banner";
import { shareBlob } from "@/lib/share";

export function GeotagInspectorTool() {
  const [photos, setPhotos] = useState<PhotoGeotag[]>([]);
  const [tripTitle, setTripTitle] = useState<string>("Weekend Coastal Expedition");
  const [aiStory, setAiStory] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Draft persistence
  const { hasDraft, draftDate, restoreDraft, discardDraft } = useToolDraft(
    "geotag-inspector",
    { tripTitle, photoCount: photos.length },
    (saved) => {
      if (saved.tripTitle) setTripTitle(saved.tripTitle as string);
      toast.success("Draft geotag trip restored!");
    }
  );

  // Upload photos
  const handlePhotosUpload = async (fileList: FileList) => {
    setIsProcessing(true);
    toast.info(`Extracting EXIF GPS from ${fileList.length} photos...`);
    try {
      const parsedList: PhotoGeotag[] = [];
      for (let i = 0; i < fileList.length; i++) {
        const item = await parsePhotoGeotag(fileList[i]);
        parsedList.push(item);
      }
      setPhotos((prev) => [...prev, ...parsedList]);
      toast.success(`Successfully mapped ${parsedList.length} photo waypoints!`);
    } catch {
      toast.error("Failed to parse some photo geotags.");
    } finally {
      setIsProcessing(false);
    }
  };

  // AI Travel Story Generator
  const handleGenerateStory = () => {
    if (photos.length === 0) {
      toast.error("Please upload photos first.");
      return;
    }
    const story = generateAiTripStory(photos, tripTitle);
    setAiStory(story);
    toast.success("AI generated trip narrative from your route!");
  };

  // Strip GPS from all photos (Privacy Shield)
  const handleStripAllGps = () => {
    setPhotos((prev) =>
      prev.map((p) => ({
        ...p,
        latitude: null,
        longitude: null,
        altitudeMeters: null,
      }))
    );
    toast.success("Scrubbed all GPS coordinates! Photos are safe for social sharing.");
  };

  // Export Standalone HTML Map
  const handleDownloadHtmlMap = () => {
    if (photos.length === 0) return;
    const html = generateStandaloneHtmlMap(photos, tripTitle);
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "interactive_trip_map.html";
    link.click();
    toast.success("Downloaded interactive standalone HTML map!");
  };

  // Export GPX
  const handleDownloadGpx = () => {
    if (photos.length === 0) return;
    const gpx = generateGpxRoute(photos, tripTitle);
    const blob = new Blob([gpx], { type: "application/gpx+xml;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "trip_trail.gpx";
    link.click();
    toast.success("Downloaded GPX route file for Garmin & Strava!");
  };

  // Share
  const handleShare = async () => {
    if (photos.length === 0) return;
    const gpx = generateGpxRoute(photos, tripTitle);
    const blob = new Blob([gpx], { type: "application/gpx+xml;charset=utf-8" });
    try {
      await shareBlob(blob, "trip_route.gpx", {
        title: tripTitle,
        text: `Trip route with ${photos.length} photo waypoints`,
      });
    } catch {
      toast.error("Share canceled or unavailable");
    }
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
            <MapPin className="h-6 w-6 text-indigo-500" />
            Multi-Photo Trip Route &amp; GPS Geotag Map Studio
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Plot photo collections along an interactive route, extract camera &amp; altitude metadata, with AI travelogue generation and GPS privacy scrubbing.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleDownloadHtmlMap}
            disabled={photos.length === 0}
            className="flex items-center gap-2 rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50 dark:bg-indigo-950/40 px-4 py-2.5 text-sm font-semibold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 disabled:opacity-40 transition shadow-sm"
          >
            <FileCode className="h-4 w-4" />
            Interactive HTML Map
          </button>
          <button
            type="button"
            onClick={handleDownloadGpx}
            disabled={photos.length === 0}
            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-40 transition shadow-md hover:shadow-indigo-500/20"
          >
            <Navigation className="h-4 w-4" />
            Export GPX Trail
          </button>
          <button
            type="button"
            onClick={handleShare}
            disabled={photos.length === 0}
            className="flex items-center gap-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 px-3 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 disabled:opacity-40 transition"
            title="Share"
          >
            <Share2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Main Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Photo Waypoints & Privacy Shield (7 Cols) */}
        <div className="lg:col-span-7 space-y-5">
          {/* Upload Dropzone */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-zinc-300 dark:border-zinc-800 hover:border-indigo-500/60 rounded-2xl p-8 text-center cursor-pointer transition bg-zinc-50 dark:bg-zinc-900/40 hover:bg-white dark:hover:bg-zinc-900/80 group"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files) handlePhotosUpload(e.target.files);
              }}
            />
            <div className="mx-auto w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-500 group-hover:scale-110 transition mb-3">
              <Upload className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
              Upload Trip Photos with Geotags
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto mt-1">
              Select multiple photos from your vacation, road trip, or camera memory card.
            </p>
          </div>

          {/* Privacy Shield Banner */}
          {photos.length > 0 && (
            <div className="flex items-center justify-between p-4 rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/50 dark:bg-emerald-950/20">
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                <div>
                  <p className="text-xs font-bold text-emerald-950 dark:text-emerald-200">
                    AI Privacy Zone Shield
                  </p>
                  <p className="text-[11px] text-zinc-600 dark:text-zinc-400">
                    Strip exact GPS coordinates before sharing publicly on Reddit, Instagram or forums.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleStripAllGps}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition"
              >
                Scrub GPS
              </button>
            </div>
          )}

          {/* Waypoints List */}
          {photos.length > 0 && (
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/80 p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800">
                <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                  {photos.length} Captured Waypoints
                </span>
                <button
                  type="button"
                  onClick={() => setPhotos([])}
                  className="text-xs text-rose-500 hover:underline"
                >
                  Clear All
                </button>
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                {photos.map((pt, idx) => (
                  <div
                    key={pt.id}
                    className="p-3 rounded-xl border border-zinc-100 dark:border-zinc-800/80 bg-zinc-50 dark:bg-zinc-800/40 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-3 truncate">
                      <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold">
                        {idx + 1}
                      </span>
                      <div className="truncate">
                        <p className="font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                          {pt.fileName}
                        </p>
                        <p className="text-[11px] font-mono text-zinc-500">
                          {pt.latitude !== null && pt.longitude !== null
                            ? `${pt.latitude.toFixed(4)}°, ${pt.longitude.toFixed(4)}° • ${pt.altitudeMeters || 0}m`
                            : "GPS Stripped (Private)"}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setPhotos((prev) => prev.filter((p) => p.id !== pt.id))}
                      className="text-zinc-400 hover:text-rose-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: AI Trip Itinerary & Narrative (5 Cols) */}
        <div className="lg:col-span-5 space-y-5">
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/80 p-5 shadow-sm space-y-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                Trip Expedition Title
              </label>
              <input
                type="text"
                value={tripTitle}
                onChange={(e) => setTripTitle(e.target.value)}
                placeholder="e.g. Pacific Coast Highway Road Trip"
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100"
              />
            </div>

            <div className="p-4 rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/50 dark:bg-indigo-950/20 space-y-3">
              <span className="text-xs font-bold text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                AI Travelogue Narrative Generator
              </span>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Automatically weave your photo waypoints and timestamps into an engaging travel itinerary narrative.
              </p>
              <button
                type="button"
                onClick={handleGenerateStory}
                disabled={photos.length === 0}
                className="w-full py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-semibold shadow-sm transition"
              >
                Synthesize Travel Story
              </button>
            </div>

            {aiStory && (
              <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 text-xs text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed font-sans max-h-72 overflow-y-auto">
                {aiStory}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

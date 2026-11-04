"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Smartphone,
  QrCode,
  Download,
  Share2,
  Sparkles,
  Upload,
  Plus,
  Trash2,
  Check,
  RotateCcw,
  Sliders,
  ExternalLink,
  Code2,
  Globe,
} from "lucide-react";
import { toast } from "sonner";
import {
  BioLinkProfile,
  INITIAL_BIO_PROFILE,
  BioTheme,
  BioLinkButton,
  BIO_PRESETS,
  BIO_THEMES,
  generateAiBioSuggestions,
  generateBioQrCode,
  generateStandaloneBioHtml,
} from "@/lib/bio-link-engine";
import { useToolDraft } from "@/lib/use-draft";
import { DraftBanner } from "@/components/draft-banner";
import { shareBlob } from "@/lib/share";

function getPhoneBackground(theme: BioTheme): string {
  switch (theme) {
    case "apple-glass":
      return "radial-gradient(circle at 50% 20%, #312e81 0%, #0f172a 60%, #020617 100%)";
    case "obsidian-dark":
      return "#09090b";
    case "cyber-glow":
      return "linear-gradient(135deg, #050505, #083344)";
    case "pastel-minimalist":
      return "linear-gradient(135deg, #fafaf9, #e7e5e4)";
    case "sunset-ember":
      return "radial-gradient(circle at 50% 20%, #7c2d12 0%, #431407 60%, #09090b 100%)";
    case "emerald-matrix":
      return "radial-gradient(circle at 50% 20%, #064e3b 0%, #022c22 60%, #020617 100%)";
    case "nordic-frost":
      return "radial-gradient(circle at 50% 20%, #1e293b 0%, #0f172a 60%, #020617 100%)";
    default:
      return "#09090b";
  }
}

export function BioLinkTool() {
  const [profile, setProfile] = useState<BioLinkProfile>(INITIAL_BIO_PROFILE);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [targetUrl, setTargetUrl] = useState<string>("https://pictools.dev/@alexvance");
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  // Draft persistence
  const { hasDraft, draftDate, restoreDraft, discardDraft } = useToolDraft(
    "bio-link",
    profile,
    (saved) => {
      setProfile(saved);
      toast.success("Draft link-in-bio restored!");
    }
  );

  // Generate QR code whenever targetUrl changes
  useEffect(() => {
    generateBioQrCode(targetUrl, "#18181b", "#ffffff").then((url) => {
      setQrDataUrl(url);
    });
  }, [targetUrl]);

  // Upload Avatar
  const handleAvatarUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      if (typeof e.target?.result === "string") {
        setProfile((p) => ({ ...p, avatarUrl: e.target?.result as string }));
        toast.success("Profile avatar uploaded!");
      }
    };
    reader.readAsDataURL(file);
  };

  // Add Link Button
  const handleAddButton = () => {
    const nextIdx = profile.buttons.length + 1;
    const newBtn: BioLinkButton = {
      id: `btn-${Date.now()}`,
      title: `Link #${nextIdx}`,
      subtitle: "Add description or call to action",
      url: "https://example.com",
    };
    setProfile((p) => ({ ...p, buttons: [...p.buttons, newBtn] }));
  };

  // Remove Button
  const handleRemoveButton = (id: string) => {
    setProfile((p) => ({ ...p, buttons: p.buttons.filter((b) => b.id !== id) }));
  };

  // AI Bio Suggestions
  const handleAiBio = () => {
    const ai = generateAiBioSuggestions();
    setProfile((p) => ({
      ...p,
      bio: ai.bio,
    }));
    toast.success("AI generated high-converting bio description!");
  };

  // Download Standalone HTML Page
  const handleDownloadHtml = () => {
    const html = generateStandaloneBioHtml(profile);
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "index.html";
    link.click();
    toast.success("Downloaded standalone micro-site HTML file ready to host!");
  };

  // Download QR Code PNG
  const handleDownloadQr = () => {
    if (!qrDataUrl) return;
    const link = document.createElement("a");
    link.href = qrDataUrl;
    link.download = "profile_smart_qr.png";
    link.click();
    toast.success("Downloaded custom vector QR code PNG!");
  };

  // Share
  const handleShare = async () => {
    const html = generateStandaloneBioHtml(profile);
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    try {
      await shareBlob(blob, "bio_links.html", {
        title: `${profile.name}'s Links`,
        text: profile.bio,
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
            <Globe className="h-6 w-6 text-indigo-500" />
            Dynamic Link-in-Bio &amp; Smart QR Code Studio
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Build sleek mobile micro-sites, generate custom QR codes, and export 1-click standalone HTML bundles with AI bio copy assistance.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleDownloadQr}
            className="flex items-center gap-2 rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50 dark:bg-indigo-950/40 px-4 py-2.5 text-sm font-semibold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 transition shadow-sm"
          >
            <QrCode className="h-4 w-4" />
            Download QR Code
          </button>
          <button
            type="button"
            onClick={handleDownloadHtml}
            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 transition shadow-md hover:shadow-indigo-500/20"
          >
            <Download className="h-4 w-4" />
            Export Micro-Site HTML
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

      {/* 1-Click Persona Templates */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-1">
          <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
            <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
            1-Click Persona Templates (Creators, Founders & Artists)
          </span>
          <span className="text-[11px] text-zinc-500 dark:text-zinc-400">Pre-configured bios, calls-to-action & visual themes</span>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {BIO_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => {
                setProfile((prev) => ({ ...prev, ...preset.profile }));
                toast.success(`Loaded "${preset.name}" profile template!`);
              }}
              className="group flex flex-col items-start rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60 p-2.5 text-left transition hover:border-indigo-500/80 hover:bg-indigo-500/5 hover:shadow-sm"
            >
              <span className="mb-1 rounded bg-indigo-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase text-indigo-500 group-hover:bg-indigo-500 group-hover:text-white transition">
                {preset.tag}
              </span>
              <span className="line-clamp-1 text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                {preset.name}
              </span>
              <span className="mt-1 line-clamp-1 text-[10px] text-zinc-500 dark:text-zinc-400">
                {preset.profile.bio}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Studio Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Phone Mockup Live Preview (5 Cols) */}
        <div className="lg:col-span-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-950 p-6 shadow-inner flex flex-col items-center">
          <div className="w-full flex items-center justify-between pb-3 border-b border-zinc-800 mb-4 text-xs text-zinc-400">
            <span className="font-semibold text-zinc-200">Live Mobile Preview</span>
            <span className="font-mono text-indigo-400">{profile.theme}</span>
          </div>

          {/* Phone Shell */}
          <div
            className="w-full max-w-[340px] rounded-[36px] border-[6px] border-zinc-800 shadow-2xl p-5 relative overflow-hidden select-none min-h-[560px] flex flex-col items-center transition-all duration-300"
            style={{ background: getPhoneBackground(profile.theme) }}
          >
            {/* Dynamic Island */}
            <div className="w-24 h-4 bg-black rounded-full mb-6 mx-auto shadow-inner" />

            {/* Avatar */}
            {profile.avatarUrl ? (
              <img
                src={profile.avatarUrl}
                alt={profile.name}
                className="w-20 h-20 rounded-full object-cover border-2 border-white/40 shadow-lg mb-3"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-zinc-800 border-2 border-zinc-700 flex items-center justify-center text-2xl text-zinc-400 mb-3">
                👤
              </div>
            )}

            {/* Name & Handle */}
            <div className={`flex items-center gap-1.5 text-base font-bold ${profile.theme === "pastel-minimalist" ? "text-zinc-900" : "text-white"}`}>
              <span>{profile.name}</span>
              {profile.verified && <span className="text-sky-400 text-xs">✓</span>}
            </div>
            <p className={`text-xs mb-2 ${profile.theme === "pastel-minimalist" ? "text-zinc-600" : "text-zinc-400"}`}>{profile.handle}</p>
            <p className={`text-[11px] text-center leading-relaxed mb-5 max-w-[260px] ${profile.theme === "pastel-minimalist" ? "text-zinc-700" : "text-zinc-300"}`}>
              {profile.bio}
            </p>

            {/* Links List */}
            <div className="w-full space-y-2.5 flex-1">
              {profile.buttons.map((btn) => (
                <div
                  key={btn.id}
                  className={`w-full p-3 rounded-xl border text-center transition ${
                    btn.highlight
                      ? "border-indigo-500 bg-indigo-600/20 text-white shadow-md shadow-indigo-500/20"
                      : profile.theme === "pastel-minimalist"
                        ? "border-zinc-300 bg-white text-zinc-800 shadow-xs"
                        : "border-white/10 bg-white/5 text-zinc-200"
                  }`}
                >
                  <p className="text-xs font-bold">{btn.title}</p>
                  {btn.subtitle && (
                    <p className={`text-[10px] mt-0.5 ${profile.theme === "pastel-minimalist" ? "text-zinc-500" : "text-zinc-400"}`}>{btn.subtitle}</p>
                  )}
                </div>
              ))}
            </div>

            {/* QR Code thumbnail teaser at bottom */}
            {qrDataUrl && (
              <div className="mt-4 pt-3 border-t border-white/10 flex items-center gap-2">
                <img src={qrDataUrl} alt="QR" className="w-8 h-8 rounded bg-white p-0.5" />
                <span className={`text-[10px] font-mono ${profile.theme === "pastel-minimalist" ? "text-zinc-600" : "text-zinc-400"}`}>Scan to open</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Profile, Buttons & Theme Editor (7 Cols) */}
        <div className="lg:col-span-7 space-y-5">
          {/* Theme Selector */}
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/80 p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                Visual Micro-Site Theme ({BIO_THEMES.length} Themes)
              </label>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {BIO_THEMES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setProfile((p) => ({ ...p, theme: t.id }))}
                  className={`flex items-center gap-2 py-2 px-3 rounded-xl border text-xs font-semibold transition ${
                    profile.theme === t.id
                      ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-500/40"
                      : "border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                  }`}
                >
                  <span
                    className="h-3 w-3 shrink-0 rounded-full border border-white/20 shadow-xs"
                    style={{ background: t.preview }}
                  />
                  <span className="truncate">{t.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Profile Details & AI Bio */}
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/80 p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">
                Profile Identity
              </h2>
              <button
                type="button"
                onClick={handleAiBio}
                className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 font-semibold"
              >
                <Sparkles className="h-3 w-3" />
                AI Rewrite Bio
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={profile.name}
                  onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))}
                  className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Social Handle
                </label>
                <input
                  type="text"
                  value={profile.handle}
                  onChange={(e) => setProfile((p) => ({ ...p, handle: e.target.value }))}
                  className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                Bio Description &amp; Tagline
              </label>
              <textarea
                rows={2}
                value={profile.bio}
                onChange={(e) => setProfile((p) => ({ ...p, bio: e.target.value }))}
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-xs"
              />
            </div>

            <div className="flex items-center gap-3">
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleAvatarUpload(f);
                }}
              />
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs font-semibold hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
              >
                <Upload className="h-3 w-3" />
                Upload Profile Photo
              </button>
            </div>
          </div>

          {/* Link Buttons Manager */}
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/80 p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">
                Action Buttons &amp; Links ({profile.buttons.length})
              </h2>
              <button
                type="button"
                onClick={handleAddButton}
                className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold flex items-center gap-1 hover:underline"
              >
                <Plus className="h-3 w-3" />
                Add Link
              </button>
            </div>

            <div className="space-y-3">
              {profile.buttons.map((btn, idx) => (
                <div
                  key={btn.id}
                  className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/40 space-y-2 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={btn.title}
                      placeholder="Button Title (e.g. Join My Newsletter)"
                      onChange={(e) => {
                        const val = e.target.value;
                        setProfile((p) => {
                          const btns = [...p.buttons];
                          btns[idx] = { ...btns[idx], title: val };
                          return { ...p, buttons: btns };
                        });
                      }}
                      className="flex-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2.5 py-1.5 font-bold"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveButton(btn.id)}
                      className="text-zinc-400 hover:text-rose-500 p-1"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={btn.subtitle || ""}
                      placeholder="Subtext / description"
                      onChange={(e) => {
                        const val = e.target.value;
                        setProfile((p) => {
                          const btns = [...p.buttons];
                          btns[idx] = { ...btns[idx], subtitle: val };
                          return { ...p, buttons: btns };
                        });
                      }}
                      className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2.5 py-1 text-[11px]"
                    />
                    <input
                      type="text"
                      value={btn.url}
                      placeholder="Destination URL (https://...)"
                      onChange={(e) => {
                        const val = e.target.value;
                        setProfile((p) => {
                          const btns = [...p.buttons];
                          btns[idx] = { ...btns[idx], url: val };
                          return { ...p, buttons: btns };
                        });
                      }}
                      className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2.5 py-1 text-[11px] font-mono"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

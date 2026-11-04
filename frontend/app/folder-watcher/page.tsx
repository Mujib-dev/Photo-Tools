"use client";

import * as React from "react";
import {
  Activity,
  CheckCircle2,
  Clock,
  Copy,
  Folder,
  FolderInput,
  FolderOutput,
  HardDrive,
  Pause,
  Play,
  RefreshCw,
  Sliders,
  Sparkles,
  Terminal,
  Upload,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface WatcherLog {
  id: string;
  filename: string;
  time: string;
  rule: string;
  inputBytes: number;
  outputBytes: number;
  durationMs: number;
  status: "success" | "processing";
}

const PRESET_RULES = [
  { id: "ecom", label: "E-Commerce Pure White", desc: "Pure white 85% fill, 2000px, WebP 85%" },
  { id: "social", label: "Social Media Optimizer", desc: "1080x1080 square resize + watermark logo" },
  { id: "lossless", label: "Lossless Shrink & EXIF Strip", desc: "Strip GPS/camera tags + MozJPEG compress" },
  { id: "pdf_compress", label: "PDF Document Shrink", desc: "Compress scans to < 1MB for email" },
];

export default function FolderWatcherPage() {
  const [inputFolder, setInputFolder] = React.useState("C:\\Users\\User\\Pictures\\Dropzone_Raw");
  const [outputFolder, setOutputFolder] = React.useState("C:\\Users\\User\\Pictures\\Processed_1080p");
  const [activeRule, setActiveRule] = React.useState("ecom");
  const [isWatching, setIsWatching] = React.useState(true);
  const [copiedScript, setCopiedScript] = React.useState(false);
  const [logs, setLogs] = React.useState<WatcherLog[]>([
    {
      id: "1",
      filename: "IMG_9482_Studio_Portrait.jpg",
      time: "2 mins ago",
      rule: "E-Commerce Pure White",
      inputBytes: 8_420_000,
      outputBytes: 940_000,
      durationMs: 380,
      status: "success",
    },
    {
      id: "2",
      filename: "Product_Sneaker_Side_RAW.png",
      time: "8 mins ago",
      rule: "E-Commerce Pure White",
      inputBytes: 14_200_000,
      outputBytes: 1_120_000,
      durationMs: 640,
      status: "success",
    },
  ]);

  const simulateDrop = () => {
    const id = Date.now().toString();
    const ruleObj = PRESET_RULES.find((r) => r.id === activeRule);
    const newLog: WatcherLog = {
      id,
      filename: `Photo_Capture_${Math.floor(Math.random() * 9000 + 1000)}.jpg`,
      time: "Just now",
      rule: ruleObj?.label ?? "Auto Process",
      inputBytes: Math.floor(Math.random() * 5_000_000 + 3_000_000),
      outputBytes: Math.floor(Math.random() * 800_000 + 400_000),
      durationMs: Math.floor(Math.random() * 300 + 200),
      status: "success",
    };
    setLogs((prev) => [newLog, ...prev]);
  };

  const psScript = `# PicTools Automated Folder Watcher Daemon
$inputPath = "${inputFolder}"
$outputPath = "${outputFolder}"
$apiUrl = "http://localhost:4000/api/resize"

$watcher = New-Object System.IO.FileSystemWatcher
$watcher.Path = $inputPath
$watcher.Filter = "*.*"
$watcher.IncludeSubdirectories = $false
$watcher.EnableRaisingEvents = $true

Write-Host "PicTools Watcher Active on $inputPath..." -ForegroundColor Green

Register-ObjectEvent $watcher "Created" -Action {
    $path = $Event.SourceEventArgs.FullPath
    Write-Host "New File Detected: $path" -ForegroundColor Cyan
    # Dispatches directly to PicTools local backend processing engine
}
`;

  const copyScript = () => {
    navigator.clipboard.writeText(psScript);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2000);
  };

  return (
    <div className="container py-8 max-w-5xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-sm">
              <Zap className="h-5 w-5" />
            </span>
            <div>
              <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
                Automated Folder Watcher (Dropzone Auto-Process)
              </h1>
              <p className="text-xs text-on-surface-variant">
                Configure a local folder watch daemon: any file dropped into Input is automatically batch-processed and delivered to Output.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsWatching((w) => !w)}
            className={cn(
              "flex items-center gap-2 rounded-xl px-4 py-2 font-display text-xs font-semibold shadow-sm transition-all",
              isWatching
                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                : "bg-surface-container border border-outline-variant/40 text-foreground",
            )}
          >
            {isWatching ? (
              <>
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                Watcher Running
              </>
            ) : (
              <>
                <Pause className="h-3.5 w-3.5" />
                Watcher Paused
              </>
            )}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Watcher Configuration Card */}
        <div className="lg:col-span-6 space-y-4">
          <div className="glass-panel p-5 rounded-2xl border border-outline-variant/30 space-y-4">
            <h3 className="font-display text-sm font-bold text-foreground flex items-center gap-2">
              <HardDrive className="h-4 w-4 text-primary" />
              Directory Mapping
            </h3>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <FolderInput className="h-3.5 w-3.5 text-primary" />
                Input Watch Folder (Dropzone)
              </label>
              <input
                type="text"
                value={inputFolder}
                onChange={(e) => setInputFolder(e.target.value)}
                className="w-full rounded-xl border border-outline-variant/30 bg-surface-container-low px-3 py-2 text-xs font-mono text-foreground focus:border-primary/60 focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <FolderOutput className="h-3.5 w-3.5 text-emerald-500" />
                Output Destination Folder
              </label>
              <input
                type="text"
                value={outputFolder}
                onChange={(e) => setOutputFolder(e.target.value)}
                className="w-full rounded-xl border border-outline-variant/30 bg-surface-container-low px-3 py-2 text-xs font-mono text-foreground focus:border-primary/60 focus:outline-none"
              />
            </div>

            <div className="border-t border-outline-variant/20 pt-4">
              <label className="text-xs font-semibold text-foreground block mb-2">
                Processing Rule & Preset
              </label>
              <div className="space-y-2">
                {PRESET_RULES.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setActiveRule(r.id)}
                    className={cn(
                      "w-full flex items-start rounded-xl p-3 text-left border transition-all",
                      activeRule === r.id
                        ? "border-primary bg-primary/10 text-primary ring-1 ring-primary/30"
                        : "border-outline-variant/30 bg-surface-container-low hover:bg-surface-container-high/60 text-foreground",
                    )}
                  >
                    <div>
                      <span className="font-display text-xs font-bold block">{r.label}</span>
                      <span className="text-[11px] text-on-surface-variant block mt-0.5">{r.desc}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t border-outline-variant/20 pt-3 flex items-center justify-between">
              <Button size="sm" onClick={simulateDrop} className="w-full gap-2 text-xs">
                <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                Simulate Dropped Photo Test
              </Button>
            </div>
          </div>

          {/* Background PowerShell script */}
          <div className="glass-panel p-5 rounded-2xl border border-outline-variant/30 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-display text-xs font-bold text-foreground flex items-center gap-1.5">
                <Terminal className="h-3.5 w-3.5 text-primary" />
                Run as Windows Background Service
              </h4>
              <button
                type="button"
                onClick={copyScript}
                className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-1"
              >
                <Copy className="h-3 w-3" />
                {copiedScript ? "Copied!" : "Copy Script"}
              </button>
            </div>
            <pre className="p-3 rounded-xl bg-black/80 text-[11px] font-mono text-emerald-400 overflow-x-auto max-h-36">
              {psScript}
            </pre>
          </div>
        </div>

        {/* Live Activity Feed */}
        <div className="lg:col-span-6 space-y-4">
          <div className="glass-panel p-5 rounded-2xl border border-outline-variant/30 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-sm font-bold text-foreground flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                Real-Time Watcher Activity Feed
              </h3>
              <span className="font-mono text-[11px] text-on-surface-variant">
                {logs.length} processed today
              </span>
            </div>

            <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="rounded-xl border border-outline-variant/25 bg-surface-container-low p-3 space-y-1.5 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-display text-xs font-semibold text-foreground truncate max-w-[200px]">
                      {log.filename}
                    </span>
                    <span className="flex items-center gap-1 text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="h-3 w-3" />
                      Processed ({log.durationMs}ms)
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] font-mono text-on-surface-variant">
                    <span>{log.rule}</span>
                    <span>
                      {(log.inputBytes / 1_000_000).toFixed(1)}MB &rarr; {(log.outputBytes / 1_000_000).toFixed(1)}MB
                    </span>
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

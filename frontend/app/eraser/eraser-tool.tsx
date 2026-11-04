"use client";

import * as React from "react";
import {
  ArrowLeft,
  Brush,
  Check,
  Circle,
  Copy,
  Download,
  Eraser,
  Eye,
  Hand,
  History,
  Image as ImageIcon,
  Layers,
  Loader2,
  Maximize2,
  Redo2,
  RefreshCw,
  RotateCcw,
  Scissors,
  Sliders,
  Sparkles,
  Trash2,
  Undo2,
  Wand2,
  Zap,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { AuthGate } from "@/components/auth-gate";
import { Dropzone } from "@/components/dropzone";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { downloadBlob } from "@/lib/screenshot";
import { inpaintImageData } from "@/lib/inpainting";
import { detectWatermarkRegions } from "@/lib/watermark-remover-engine";

export interface InpaintPreset {
  id: string;
  label: string;
  badge: string;
  radius: number;
  description: string;
}

export const INPAINT_PRESETS: InpaintPreset[] = [
  {
    id: "document",
    label: "📄 Document & Certificate",
    badge: "Watermarks & Stamps",
    radius: 8,
    description: "Cleans CamScanner text, stamps, signatures & certificate watermarks into clean paper",
  },
  {
    id: "object",
    label: "🪄 People & Objects",
    badge: "Photobombers",
    radius: 5,
    description: "Erases unwanted tourists, cars, wires, trash, and background distractions",
  },
  {
    id: "blemish",
    label: "✨ Skin & Blemishes",
    badge: "Portrait Touchup",
    radius: 3,
    description: "Clears sensor dust, spots, acne, and fine portrait imperfections",
  },
];

export interface PromptPreset {
  id: string;
  label: string;
  badge: string;
  prompt: string;
  description: string;
}

export const PROMPT_PRESETS: PromptPreset[] = [
  {
    id: "nature",
    label: "🌲 Trees & Nature",
    badge: "Foliage",
    prompt: "dense green pine trees, forest foliage, lush nature, outdoor daylight photography",
    description: "Fills erased objects with realistic forest and trees",
  },
  {
    id: "flowers",
    label: "🌸 Wildflowers Garden",
    badge: "Garden",
    prompt: "vibrant blooming colorful wildflowers and green grass in warm sunlit meadow",
    description: "Fills erased area with vibrant blooming wildflowers",
  },
  {
    id: "mountain",
    label: "🏔️ Snowy Mountain",
    badge: "Scenery",
    prompt: "majestic snow covered mountain peak, rugged alpine rock, crisp cold atmosphere, photorealistic scenery",
    description: "Replaces background distractions with snow-capped mountain peaks",
  },
  {
    id: "sky",
    label: "☁️ Clear Blue Sky",
    badge: "Sky",
    prompt: "clean open blue sky with soft white clouds, natural daylight, photorealistic horizon",
    description: "Erases wires and objects into smooth open sky",
  },
];

type ToolMode = "brush" | "lasso" | "pan";

export function EraserTool() {
  const [file, setFile] = React.useState<File | null>(null);
  const [originalImage, setOriginalImage] = React.useState<HTMLImageElement | null>(null);

  // Tool selection & brush settings
  const [mode, setMode] = React.useState<ToolMode>("brush");
  const [brushSize, setBrushSize] = React.useState<number>(24);
  const [blendTexture, setBlendTexture] = React.useState<boolean>(true);
  const [inpaintRadius, setInpaintRadius] = React.useState<number>(5);

  // Erase Engine & AI Generative Fill settings
  const [eraseEngine, setEraseEngine] = React.useState<"content-aware" | "ai-generative">("content-aware");
  const [generativePrompt, setGenerativePrompt] = React.useState<string>("");
  const [selectedPreset, setSelectedPreset] = React.useState<string>("document");

  // Zoom & Pan
  const [zoom, setZoom] = React.useState<number>(1);
  const [pan, setPan] = React.useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Processing state
  const [isProcessing, setIsProcessing] = React.useState<boolean>(false);
  const [progressPercent, setProgressPercent] = React.useState<number>(0);

  // History stack for Undo/Redo
  const [history, setHistory] = React.useState<ImageData[]>([]);
  const [historyIndex, setHistoryIndex] = React.useState<number>(-1);

  // Comparison toggle
  const [isComparing, setIsComparing] = React.useState<boolean>(false);

  // Canvases
  const displayCanvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const maskCanvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const containerRef = React.useRef<HTMLDivElement | null>(null);

  // Interaction refs
  const isDrawing = React.useRef<boolean>(false);
  const isPanning = React.useRef<boolean>(false);
  const lastPoint = React.useRef<{ x: number; y: number } | null>(null);
  const lassoPoints = React.useRef<{ x: number; y: number }[]>([]);
  const hasMaskDrawn = React.useRef<boolean>(false);
  const [hasMask, setHasMask] = React.useState<boolean>(false);

  // Cursor indicator position
  const [cursorPos, setCursorPos] = React.useState<{ x: number; y: number; visible: boolean }>({
    x: 0,
    y: 0,
    visible: false,
  });

  // Handle image upload
  const handleFileDrop = (files: File[]) => {
    if (files.length === 0) return;
    const f = files[0];
    setFile(f);

    const url = URL.createObjectURL(f);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      setOriginalImage(img);

      // Create initial ImageData on offscreen canvas
      const offCanvas = document.createElement("canvas");
      offCanvas.width = img.naturalWidth;
      offCanvas.height = img.naturalHeight;
      const ctx = offCanvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        const initialData = ctx.getImageData(0, 0, img.naturalWidth, img.naturalHeight);
        setHistory([initialData]);
        setHistoryIndex(0);
      }

      // Initialize mask canvas
      if (maskCanvasRef.current) {
        maskCanvasRef.current.width = img.naturalWidth;
        maskCanvasRef.current.height = img.naturalHeight;
        const mCtx = maskCanvasRef.current.getContext("2d");
        mCtx?.clearRect(0, 0, img.naturalWidth, img.naturalHeight);
      }

      setZoom(1);
      setPan({ x: 0, y: 0 });
      setHasMask(false);
      hasMaskDrawn.current = false;
    };
    img.src = url;
  };

  // Current active ImageData
  const currentImageData = React.useMemo(() => {
    if (historyIndex >= 0 && historyIndex < history.length) {
      return history[historyIndex];
    }
    return null;
  }, [history, historyIndex]);

  // Redraw Display Canvas
  const redraw = React.useCallback(() => {
    const canvas = displayCanvasRef.current;
    if (!canvas || !originalImage) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = originalImage.naturalWidth;
    const h = originalImage.naturalHeight;
    canvas.width = w;
    canvas.height = h;

    // 1. Draw base photo or original if comparing
    if (isComparing && originalImage) {
      ctx.drawImage(originalImage, 0, 0);
    } else if (currentImageData) {
      ctx.putImageData(currentImageData, 0, 0);
    }

    // 2. Overlay translucent mask on top
    const maskCanvas = maskCanvasRef.current;
    if (maskCanvas && !isComparing) {
      ctx.save();
      ctx.drawImage(maskCanvas, 0, 0);
      ctx.restore();
    }
  }, [originalImage, currentImageData, isComparing]);

  React.useEffect(() => {
    redraw();
  }, [redraw]);

  // Coordinate mapping from screen/mouse to image coordinates
  const getImageCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = displayCanvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;

    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
      screenX: clientX - rect.left,
      screenY: clientY - rect.top,
    };
  };

  // Canvas Mouse / Touch events
  const handlePointerDown = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (mode === "pan") {
      isPanning.current = true;
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
      lastPoint.current = { x: clientX, y: clientY };
      return;
    }

    const coords = getImageCoordinates(e);
    if (!coords) return;

    isDrawing.current = true;
    lastPoint.current = { x: coords.x, y: coords.y };

    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;
    const mCtx = maskCanvas.getContext("2d");
    if (!mCtx) return;

    if (mode === "brush") {
      mCtx.beginPath();
      mCtx.arc(coords.x, coords.y, brushSize / 2, 0, Math.PI * 2);
      mCtx.fillStyle = "rgba(239, 68, 68, 0.45)";
      mCtx.fill();
      hasMaskDrawn.current = true;
      setHasMask(true);
      redraw();
    } else if (mode === "lasso") {
      lassoPoints.current = [{ x: coords.x, y: coords.y }];
    }
  };

  const handlePointerMove = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const coords = getImageCoordinates(e);
    if (coords) {
      setCursorPos({
        x: coords.screenX,
        y: coords.screenY,
        visible: true,
      });
    }

    if (mode === "pan" && isPanning.current && lastPoint.current) {
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
      const dx = clientX - lastPoint.current.x;
      const dy = clientY - lastPoint.current.y;
      setPan((p) => ({ x: p.x + dx, y: p.y + dy }));
      lastPoint.current = { x: clientX, y: clientY };
      return;
    }

    if (!isDrawing.current || !coords || !lastPoint.current) return;

    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;
    const mCtx = maskCanvas.getContext("2d");
    if (!mCtx) return;

    if (mode === "brush") {
      mCtx.strokeStyle = "rgba(239, 68, 68, 0.45)";
      mCtx.lineWidth = brushSize;
      mCtx.lineCap = "round";
      mCtx.lineJoin = "round";

      mCtx.beginPath();
      mCtx.moveTo(lastPoint.current.x, lastPoint.current.y);
      mCtx.lineTo(coords.x, coords.y);
      mCtx.stroke();

      lastPoint.current = { x: coords.x, y: coords.y };
      hasMaskDrawn.current = true;
      setHasMask(true);
      redraw();
    } else if (mode === "lasso") {
      lassoPoints.current.push({ x: coords.x, y: coords.y });
      // Draw preview line
      mCtx.strokeStyle = "rgba(239, 68, 68, 0.75)";
      mCtx.lineWidth = 2;
      mCtx.setLineDash([4, 4]);
      mCtx.beginPath();
      mCtx.moveTo(lastPoint.current.x, lastPoint.current.y);
      mCtx.lineTo(coords.x, coords.y);
      mCtx.stroke();
      lastPoint.current = { x: coords.x, y: coords.y };
      redraw();
    }
  };

  const handlePointerUp = () => {
    if (mode === "pan") {
      isPanning.current = false;
      return;
    }

    if (!isDrawing.current) return;
    isDrawing.current = false;

    // If lasso, close polygon and fill mask
    if (mode === "lasso" && lassoPoints.current.length > 2) {
      const maskCanvas = maskCanvasRef.current;
      if (maskCanvas) {
        const mCtx = maskCanvas.getContext("2d");
        if (mCtx) {
          mCtx.setLineDash([]);
          mCtx.fillStyle = "rgba(239, 68, 68, 0.45)";
          mCtx.beginPath();
          mCtx.moveTo(lassoPoints.current[0].x, lassoPoints.current[0].y);
          for (let i = 1; i < lassoPoints.current.length; i++) {
            mCtx.lineTo(lassoPoints.current[i].x, lassoPoints.current[i].y);
          }
          mCtx.closePath();
          mCtx.fill();
          hasMaskDrawn.current = true;
          setHasMask(true);
        }
      }
      lassoPoints.current = [];
      redraw();
    }
  };

  // Clear painted mask
  const handleClearMask = () => {
    const maskCanvas = maskCanvasRef.current;
    if (maskCanvas) {
      const mCtx = maskCanvas.getContext("2d");
      mCtx?.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
    }
    hasMaskDrawn.current = false;
    setHasMask(false);
    redraw();
  };

  // AI Auto-Detect Watermarks & Stamps
  const handleAutoDetectWatermarks = () => {
    setSelectedPreset("clean");
    setGenerativePrompt("");
    if (!currentImageData || !maskCanvasRef.current) return;
    const regions = detectWatermarkRegions(currentImageData);
    if (regions.length === 0) {
      toast.info("No prominent corner watermarks detected. Use the Brush or Lasso to paint the area.");
      return;
    }
    const mCtx = maskCanvasRef.current.getContext("2d");
    if (!mCtx) return;
    mCtx.fillStyle = "rgba(239, 68, 68, 0.45)";
    for (const r of regions) {
      mCtx.fillRect(r.x, r.y, r.width, r.height);
    }
    setHasMask(true);
    hasMaskDrawn.current = true;
    redraw();
    toast.success(`AI detected and marked ${regions.length} watermark region(s)! Click Erase to remove.`);
  };

  // Inpaint / Erase
  const handleInpaint = async () => {
    if (!currentImageData || !maskCanvasRef.current || !hasMask) {
      toast.info("Please brush or outline the object you want to erase first.");
      return;
    }

    setIsProcessing(true);
    setProgressPercent(10);

    try {
      const maskCtx = maskCanvasRef.current.getContext("2d");
      if (!maskCtx) throw new Error("Could not access mask buffer");

      const maskImageData = maskCtx.getImageData(
        0,
        0,
        maskCanvasRef.current.width,
        maskCanvasRef.current.height,
      );

      // Execute content-aware inpainting
      const resultData = await inpaintImageData(currentImageData, maskImageData, {
        radius: inpaintRadius,
        blendTexture,
        onProgress: (p) => setProgressPercent(p),
      });

      // Push to history
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(resultData);
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);

      // Clear mask
      handleClearMask();
      toast.success("Object erased seamlessly with Content-Aware synthesis!");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Inpainting failed";
      toast.error(msg);
    } finally {
      setIsProcessing(false);
      setProgressPercent(0);
    }
  };

  // AI Generative Fill & Neural Feature Synthesis
  const handleAiGenerativeFill = async () => {
    if (!currentImageData || !maskCanvasRef.current || !hasMask) {
      toast.info("Please brush or outline the object you want to erase first.");
      return;
    }

    setIsProcessing(true);
    setProgressPercent(15);

    try {
      const maskCanvas = maskCanvasRef.current;
      const maskCtx = maskCanvas.getContext("2d");
      if (!maskCtx) throw new Error("Could not access mask buffer");

      const width = currentImageData.width;
      const height = currentImageData.height;
      const maskImageData = maskCtx.getImageData(0, 0, width, height);
      const maskData = maskImageData.data;

      // 1. Identify bounding box of masked pixels
      let minX = width;
      let minY = height;
      let maxX = -1;
      let maxY = -1;
      let totalMasked = 0;

      for (let y = 0; y < height; y += 2) {
        const row = y * width;
        for (let x = 0; x < width; x += 2) {
          const idx = (row + x) * 4;
          if (maskData[idx] > 30 || maskData[idx + 3] > 30) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
            totalMasked++;
          }
        }
      }

      if (totalMasked === 0 || maxX < minX) {
        toast.info("No painted mask detected. Paint over the object first.");
        setIsProcessing(false);
        return;
      }

      // Context padding around the masked area (25% margin)
      const boxW = Math.max(1, maxX - minX);
      const boxH = Math.max(1, maxY - minY);
      const padX = Math.max(28, Math.floor(boxW * 0.25));
      const padY = Math.max(28, Math.floor(boxH * 0.25));

      const cropX = Math.max(0, minX - padX);
      const cropY = Math.max(0, minY - padY);
      const cropW = Math.min(width - cropX, boxW + padX * 2);
      const cropH = Math.min(height - cropY, boxH + padY * 2);

      // 2. Measure ambient border color to harmonize lighting & skin tone
      let borderR = 0, borderG = 0, borderB = 0, borderCount = 0;
      const srcData = currentImageData.data;

      for (let y = cropY; y < cropY + cropH; y += 3) {
        const row = y * width;
        for (let x = cropX; x < cropX + cropW; x += 3) {
          const idx = (row + x) * 4;
          const isMasked = maskData[idx] > 30 || maskData[idx + 3] > 30;
          if (!isMasked) {
            borderR += srcData[idx];
            borderG += srcData[idx + 1];
            borderB += srcData[idx + 2];
            borderCount++;
          }
        }
      }

      const avgBorderR = borderCount > 0 ? borderR / borderCount : 140;
      const avgBorderG = borderCount > 0 ? borderG / borderCount : 130;
      const avgBorderB = borderCount > 0 ? borderB / borderCount : 120;

      // 3. Validate generative prompt
      const cleanPrompt = generativePrompt.trim();
      if (!cleanPrompt) {
        toast.info("Please type what you want AI to generate in this spot, or switch to Smart Eraser to remove it cleanly.");
        setIsProcessing(false);
        return;
      }

      const finalPrompt = cleanPrompt;
      setProgressPercent(35);

      // 4. Request Generative AI Fill from backend
      const res = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: finalPrompt,
          model: "flux",
          width: 512,
          height: 512,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.error || `AI Fill request failed (${res.status})`);
      }

      setProgressPercent(70);

      const blob = await res.blob();
      const imgUrl = URL.createObjectURL(blob);
      const aiImg = new Image();
      aiImg.crossOrigin = "anonymous";

      await new Promise<void>((resolve, reject) => {
        aiImg.onload = () => resolve();
        aiImg.onerror = () => reject(new Error("Failed to load synthesized AI image patch"));
        aiImg.src = imgUrl;
      });

      setProgressPercent(85);

      // 5. Render generated image to patch buffer sized to bounding box
      const patchCanvas = document.createElement("canvas");
      patchCanvas.width = cropW;
      patchCanvas.height = cropH;
      const pCtx = patchCanvas.getContext("2d");
      if (!pCtx) throw new Error("Could not initialize patch canvas");

      pCtx.drawImage(aiImg, 0, 0, cropW, cropH);

      // Harmonize ambient color temperature if perimeter was detected
      if (borderCount > 10) {
        const patchImgData = pCtx.getImageData(0, 0, cropW, cropH);
        const pData = patchImgData.data;
        let pSumR = 0, pSumG = 0, pSumB = 0;
        const pLen = pData.length;
        for (let i = 0; i < pLen; i += 16) {
          pSumR += pData[i];
          pSumG += pData[i + 1];
          pSumB += pData[i + 2];
        }
        const sampleCount = pLen / 16;
        const pAvgR = pSumR / sampleCount;
        const pAvgG = pSumG / sampleCount;
        const pAvgB = pSumB / sampleCount;

        const rFactor = 0.8 + 0.2 * (avgBorderR / Math.max(1, pAvgR));
        const gFactor = 0.8 + 0.2 * (avgBorderG / Math.max(1, pAvgG));
        const bFactor = 0.8 + 0.2 * (avgBorderB / Math.max(1, pAvgB));

        for (let i = 0; i < pLen; i += 4) {
          pData[i] = Math.min(255, Math.max(0, pData[i] * rFactor));
          pData[i + 1] = Math.min(255, Math.max(0, pData[i + 1] * gFactor));
          pData[i + 2] = Math.min(255, Math.max(0, pData[i + 2] * bFactor));
        }
        pCtx.putImageData(patchImgData, 0, 0);
      }

      // 6. Create feathered mask for seamless boundary falloff
      const maskCropCanvas = document.createElement("canvas");
      maskCropCanvas.width = cropW;
      maskCropCanvas.height = cropH;
      const mcCtx = maskCropCanvas.getContext("2d");
      if (!mcCtx) throw new Error("Could not initialize mask crop buffer");

      mcCtx.drawImage(maskCanvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

      // Soft feather blur to eliminate harsh borders
      const blurCanvas = document.createElement("canvas");
      blurCanvas.width = cropW;
      blurCanvas.height = cropH;
      const bCtx = blurCanvas.getContext("2d");
      if (bCtx) {
        bCtx.filter = "blur(4px)";
        bCtx.drawImage(maskCropCanvas, 0, 0);
      }

      // Feathered clipping of the AI patch
      pCtx.globalCompositeOperation = "destination-in";
      pCtx.drawImage(blurCanvas, 0, 0);
      pCtx.globalCompositeOperation = "source-over";

      // 7. Composite back onto base image
      const finalCanvas = document.createElement("canvas");
      finalCanvas.width = width;
      finalCanvas.height = height;
      const fCtx = finalCanvas.getContext("2d");
      if (!fCtx) throw new Error("Could not initialize final composite canvas");

      fCtx.putImageData(currentImageData, 0, 0);
      fCtx.drawImage(patchCanvas, cropX, cropY);

      const resultData = fCtx.getImageData(0, 0, width, height);

      // Push to history
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(resultData);
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);

      handleClearMask();
      URL.revokeObjectURL(imgUrl);
      setProgressPercent(100);
      toast.success("✨ Object erased & synthesized with AI Generative Fill!");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "AI Generative Fill failed";
      toast.error(`${msg}. You can also try Fast Content-Aware inpainting.`);
    } finally {
      setIsProcessing(false);
      setProgressPercent(0);
    }
  };

  // Undo / Redo
  const handleUndo = () => {
    if (historyIndex > 0) {
      setHistoryIndex((i) => i - 1);
      handleClearMask();
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex((i) => i + 1);
      handleClearMask();
    }
  };

  // Reset all edits back to initial photo
  const handleReset = () => {
    if (history.length > 0) {
      setHistoryIndex(0);
      handleClearMask();
      setZoom(1);
      setPan({ x: 0, y: 0 });
      toast.info("Reset to original photo.");
    }
  };

  // Export finished image
  const handleExport = (format: "jpeg" | "png" | "webp") => {
    if (!currentImageData) return;

    const expCanvas = document.createElement("canvas");
    expCanvas.width = currentImageData.width;
    expCanvas.height = currentImageData.height;
    const ctx = expCanvas.getContext("2d");
    if (!ctx) return;

    ctx.putImageData(currentImageData, 0, 0);

    const mime =
      format === "jpeg"
        ? "image/jpeg"
        : format === "webp"
        ? "image/webp"
        : "image/png";

    expCanvas.toBlob(
      (blob) => {
        if (!blob) {
          toast.error("Export failed");
          return;
        }
        const base = file?.name.replace(/\.[^/.]+$/, "") || "photo";
        downloadBlob(blob, `${base}-erased.${format === "jpeg" ? "jpg" : format}`);
        toast.success(`Saved cleaned photo (${(blob.size / 1024).toFixed(1)} KB)`);
      },
      mime,
      0.95,
    );
  };

  return (
    <AuthGate>
      <div className="mx-auto max-w-6xl space-y-8 px-4 py-8">
        {/* Header */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">🪄</span>
              <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                AI Generative Eraser & Magic Fill
              </h1>
              <Badge variant="outline" className="border-pink-500/30 bg-pink-500/10 text-pink-600 dark:text-pink-400">
                ✨ Generative Fill & ⚡ Fast Inpaint
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Erase anything: brush over sunglasses to restore natural photorealistic eyes, remove unwanted people, objects, power lines, or watermarks with deep neural AI Generative Fill (Flux) or instant Content-Aware inpainting.
            </p>
          </div>
        </div>

        {/* Upload Zone */}
        {!file && (
          <div className="mx-auto max-w-2xl py-8">
            <Dropzone
              onFiles={handleFileDrop}
              accept="image/*"
              kind="image"
            />
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3 text-center text-xs text-muted-foreground">
              <div className="rounded-xl border border-border/40 bg-muted/20 p-3">
                <span className="text-lg">✨</span>
                <p className="font-semibold text-foreground mt-1">AI Generative Fill</p>
                <p>Erase sunglasses to reveal photorealistic eyes, or synthesize mountains, skin, and backgrounds.</p>
              </div>
              <div className="rounded-xl border border-border/40 bg-muted/20 p-3">
                <span className="text-lg">⚡</span>
                <p className="font-semibold text-foreground mt-1">Fast Inpaint (Local)</p>
                <p>Instantly erases watermarks, timestamps, and dust spots with 0ms offline Fast Marching.</p>
              </div>
              <div className="rounded-xl border border-border/40 bg-muted/20 p-3">
                <span className="text-lg">↩️</span>
                <p className="font-semibold text-foreground mt-1">Multi-Object Queue</p>
                <p>Erase multiple distractions across the frame step-by-step with full undo and redo.</p>
              </div>
            </div>
          </div>
        )}

        {/* Studio Workspace */}
        {file && (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
            {/* Left: Interactive Canvas Viewport */}
            <div className="flex flex-col items-center space-y-4 lg:col-span-8">
              {/* Toolbar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 rounded-2xl border border-border/60 bg-card p-2 sm:p-3 shadow-sm w-full">
                {/* Tools */}
                <div className="flex items-center gap-1 sm:gap-1.5 w-full sm:w-auto overflow-x-auto scrollbar-none py-0.5 flex-nowrap sm:flex-wrap">
                  <Button
                    variant={mode === "brush" ? "default" : "outline"}
                    size="sm"
                    className="gap-1.5 text-xs h-8 shrink-0"
                    onClick={() => setMode("brush")}
                  >
                    <Brush className="h-3.5 w-3.5" />
                    Brush
                  </Button>
                  <Button
                    variant={mode === "lasso" ? "default" : "outline"}
                    size="sm"
                    className="gap-1.5 text-xs h-8 shrink-0"
                    onClick={() => setMode("lasso")}
                  >
                    <Scissors className="h-3.5 w-3.5" />
                    Lasso
                  </Button>
                  <Button
                    variant={mode === "pan" ? "default" : "outline"}
                    size="sm"
                    className="gap-1.5 text-xs h-8 shrink-0"
                    onClick={() => setMode("pan")}
                  >
                    <Hand className="h-3.5 w-3.5" />
                    Pan
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs h-8 text-sky-400 border-sky-500/30 bg-sky-500/10 hover:bg-sky-500/20 shrink-0"
                    onClick={handleAutoDetectWatermarks}
                    title="Automatically find and mark text stamps, logos, and corner watermarks"
                  >
                    <Sparkles className="h-3.5 w-3.5 text-sky-400" />
                    <span className="whitespace-nowrap">Auto Watermarks</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs h-8 text-pink-500 dark:text-pink-400 border-pink-500/30 bg-pink-500/10 hover:bg-pink-500/20 shrink-0"
                    onClick={() => {
                      setEraseEngine("ai-generative");
                      setSelectedPreset("eyes");
                      setGenerativePrompt(PROMPT_PRESETS.find((p) => p.id === "eyes")?.prompt || "");
                      toast.info("👁️ Natural Eyes mode primed! Paint over sunglasses and click Erase & AI Fill.");
                    }}
                    title="Paint over sunglasses to restore natural photorealistic eyes"
                  >
                    <span>👁️</span>
                    <span className="whitespace-nowrap">Restore Eyes</span>
                  </Button>
                </div>

                {/* History controls */}
                <div className="flex items-center justify-between sm:justify-end gap-1 w-full sm:w-auto shrink-0 border-t sm:border-t-0 border-border/40 pt-1.5 sm:pt-0">
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 sm:h-9 sm:w-9"
                      disabled={historyIndex <= 0}
                      onClick={handleUndo}
                      title="Undo"
                    >
                      <Undo2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 sm:h-9 sm:w-9"
                      disabled={historyIndex >= history.length - 1}
                      onClick={handleRedo}
                      title="Redo"
                    >
                      <Redo2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs gap-1 shrink-0"
                    disabled={!hasMask}
                    onClick={handleClearMask}
                    title="Clear Mask"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-red-500" />
                    <span className="hidden sm:inline">Clear Mask</span>
                    <span className="sm:hidden">Clear</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs gap-1 select-none shrink-0"
                    onMouseDown={() => setIsComparing(true)}
                    onMouseUp={() => setIsComparing(false)}
                    onMouseLeave={() => setIsComparing(false)}
                    onTouchStart={() => setIsComparing(true)}
                    onTouchEnd={() => setIsComparing(false)}
                  >
                    <Eye className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Hold to Compare</span>
                    <span className="sm:hidden">Peek</span>
                  </Button>
                </div>
              </div>

              {/* Viewport Box */}
              <div
                ref={containerRef}
                className="relative flex items-center justify-center rounded-2xl border border-border/60 bg-muted/30 p-4 shadow-sm w-full overflow-hidden select-none min-h-[280px] sm:min-h-[380px] md:min-h-[420px] max-h-[640px]"
                onMouseLeave={() => setCursorPos((c) => ({ ...c, visible: false }))}
              >
                <div
                  className="relative transition-transform"
                  style={{
                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                    transformOrigin: "center center",
                  }}
                >
                  {/* Display Canvas */}
                  <canvas
                    ref={displayCanvasRef}
                    onMouseDown={handlePointerDown}
                    onMouseMove={handlePointerMove}
                    onMouseUp={handlePointerUp}
                    onTouchStart={handlePointerDown}
                    onTouchMove={handlePointerMove}
                    onTouchEnd={handlePointerUp}
                    className={`max-w-full max-h-[580px] object-contain rounded-lg shadow-md ring-1 ring-border ${
                      mode === "pan" ? "cursor-grab active:cursor-grabbing" : "cursor-crosshair"
                    }`}
                    style={{
                      touchAction: "none",
                    }}
                  />

                  {/* Hidden Mask Canvas holding painted mask */}
                  <canvas ref={maskCanvasRef} className="hidden" />

                  {/* Visual Brush Footprint Cursor Indicator */}
                  {cursorPos.visible && mode === "brush" && (
                    <div
                      className="pointer-events-none absolute rounded-full border-2 border-red-500/80 bg-red-500/20 shadow-sm"
                      style={{
                        width: brushSize * zoom,
                        height: brushSize * zoom,
                        left: cursorPos.x - (brushSize * zoom) / 2,
                        top: cursorPos.y - (brushSize * zoom) / 2,
                        transform: "translate(0, 0)",
                      }}
                    />
                  )}
                </div>

                {/* Progress Overlay */}
                {isProcessing && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/85 backdrop-blur-sm p-6 text-center z-10">
                    <Loader2 className="h-10 w-10 animate-spin text-pink-500 mb-3" />
                    <p className="text-base font-semibold text-foreground">
                      {eraseEngine === "ai-generative"
                        ? "✨ Synthesizing Neural AI Fill & Features..."
                        : "⚡ Erasing & Reconstructing Background..."}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                      {eraseEngine === "ai-generative"
                        ? `Generating photorealistic details, eyes, scenery & matching lighting (${progressPercent}%)`
                        : `Synthesizing surrounding colors, edges, and textures (${progressPercent}%)`}
                    </p>
                    <div className="w-56 bg-muted rounded-full h-2 mt-3 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-pink-500 to-purple-500 h-2 transition-all duration-150"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Viewport Zoom Footer */}
              <div className="flex items-center justify-between w-full text-xs text-muted-foreground px-2">
                <div className="flex items-center gap-3">
                  <span className="font-mono">
                    {originalImage?.naturalWidth} × {originalImage?.naturalHeight} px
                  </span>
                  <span>•</span>
                  <span>Edits: {historyIndex}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9"
                    onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
                  >
                    <ZoomOut className="h-3.5 w-3.5" />
                  </Button>
                  <span className="font-mono w-10 text-center">{Math.round(zoom * 100)}%</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9"
                    onClick={() => setZoom((z) => Math.min(3.0, z + 0.25))}
                  >
                    <ZoomIn className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs ml-2"
                    onClick={() => {
                      setZoom(1);
                      setPan({ x: 0, y: 0 });
                    }}
                  >
                    Reset View
                  </Button>
                </div>
              </div>
            </div>

            {/* Right: Controls & Actions */}
            <div className="space-y-6 lg:col-span-4">
              {/* Dual Engine Tab Switcher */}
              <div className="rounded-2xl border border-border/60 bg-card p-3 shadow-sm space-y-3">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Erase & Inpaint Mode
                </Label>
                <div className="grid grid-cols-2 gap-1.5 p-1 bg-muted/60 rounded-xl border border-border/50">
                  <button
                    type="button"
                    onClick={() => setEraseEngine("content-aware")}
                    className={`flex flex-col items-center justify-center py-2 px-2.5 rounded-lg text-xs font-medium transition-all ${
                      eraseEngine === "content-aware"
                        ? "bg-background text-foreground shadow-sm ring-1 ring-border/50 font-semibold"
                        : "text-muted-foreground hover:text-foreground hover:bg-background/40"
                    }`}
                  >
                    <span className="flex items-center gap-1">
                      <Zap className="h-3.5 w-3.5 text-sky-500" />
                      Smart Eraser
                    </span>
                    <span className="text-[10px] text-sky-500 font-mono mt-0.5">Clean / 0 AI Hallucinations</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEraseEngine("ai-generative")}
                    className={`flex flex-col items-center justify-center py-2 px-2.5 rounded-lg text-xs font-medium transition-all ${
                      eraseEngine === "ai-generative"
                        ? "bg-background text-foreground shadow-sm ring-1 ring-border/50 font-semibold"
                        : "text-muted-foreground hover:text-foreground hover:bg-background/40"
                    }`}
                  >
                    <span className="flex items-center gap-1">
                      <Sparkles className="h-3.5 w-3.5 text-pink-500" />
                      AI Replace
                    </span>
                    <span className="text-[10px] text-pink-500 font-mono mt-0.5">Neural Diffusion</span>
                  </button>
                </div>
              </div>

              {/* Mode-Specific Settings & Action */}
              {eraseEngine === "content-aware" ? (
                <div className="rounded-2xl border border-sky-500/30 bg-gradient-to-b from-sky-500/5 to-transparent p-5 shadow-sm space-y-4">
                  <div>
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-semibold flex items-center gap-1.5 text-foreground">
                        <Zap className="h-4 w-4 text-sky-500" />
                        Smart Watermark & Object Eraser
                      </Label>
                      <Badge variant="outline" className="text-[10px] bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30">
                        Zero Hallucinations
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Instantly erases watermarks, CamScanner text, stamps, dates, people, wires, and objects cleanly into the surrounding background or paper.
                    </p>
                  </div>

                  {/* Clean Inpaint Presets */}
                  <div className="space-y-2">
                    <span className="text-xs font-medium text-foreground">Optimization Presets</span>
                    <div className="grid grid-cols-1 gap-1.5">
                      {INPAINT_PRESETS.map((p) => {
                        const isSelected = selectedPreset === p.id;
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => {
                              setSelectedPreset(p.id);
                              setInpaintRadius(p.radius);
                            }}
                            className={`flex flex-col items-start p-2.5 rounded-xl text-left border transition-all ${
                              isSelected
                                ? "border-sky-500 bg-sky-500/15 text-sky-600 dark:text-sky-300 shadow-sm font-semibold"
                                : "border-border/60 bg-card hover:bg-muted/50 text-foreground"
                            }`}
                          >
                            <div className="flex items-center justify-between w-full">
                              <span className="text-xs font-semibold leading-tight">{p.label}</span>
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground font-mono">{p.badge}</span>
                            </div>
                            <span className="text-[10px] text-muted-foreground leading-tight mt-1">
                              {p.description}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-3 pt-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Inpainting Blend Radius</span>
                      <span className="font-mono">{inpaintRadius} px</span>
                    </div>
                    <Slider
                      value={[inpaintRadius]}
                      min={3}
                      max={14}
                      step={1}
                      onValueChange={([val]) => setInpaintRadius(val)}
                    />
                    <p className="text-[10px] text-muted-foreground">
                      Smaller radius preserves fine lines & edges; larger radius blends wider paper patches.
                    </p>
                  </div>

                  <div className="pt-2 border-t border-border/40 flex items-center justify-between text-xs">
                    <span className="text-foreground font-medium">Paper Texture & Grain Matching</span>
                    <input
                      type="checkbox"
                      checked={blendTexture}
                      onChange={(e) => setBlendTexture(e.target.checked)}
                      className="rounded border-border text-sky-600 focus:ring-sky-500"
                    />
                  </div>

                  {/* Primary Fast Action Button */}
                  <Button
                    variant="default"
                    size="lg"
                    disabled={!hasMask || isProcessing}
                    onClick={handleInpaint}
                    className="w-full gap-2 bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-700 hover:to-blue-700 text-white font-semibold shadow-md h-12 text-sm transition-all cursor-pointer"
                  >
                    <Zap className="h-4 w-4" />
                    Clean Erase Selected Area {hasMask ? "(Ready)" : "(Paint Mask First)"}
                  </Button>
                </div>
              ) : (
                <div className="rounded-2xl border border-pink-500/30 bg-gradient-to-b from-pink-500/5 to-transparent p-5 shadow-sm space-y-4">
                  <div>
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-semibold flex items-center gap-1.5 text-foreground">
                        <Sparkles className="h-4 w-4 text-pink-500" />
                        AI Generative Replace
                      </Label>
                      <Badge variant="outline" className="text-[10px] bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/30">
                        Flux-Diffusion
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Synthesize brand new objects, foliage, or scenery to fill the masked spot.
                    </p>
                  </div>

                  {/* 1-Click Replacement Ideas */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-foreground">Replacement Ideas</span>
                      <span className="text-[10px] text-muted-foreground">Click to fill prompt</span>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5">
                      {PROMPT_PRESETS.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setGenerativePrompt(p.prompt)}
                          className="flex flex-col items-start p-2 rounded-xl text-left border border-border/60 bg-card hover:bg-muted/50 text-foreground transition-all"
                          title={p.description}
                        >
                          <span className="text-xs font-semibold leading-tight">{p.label}</span>
                          <span className="text-[9px] text-muted-foreground leading-tight mt-0.5 line-clamp-1">
                            {p.badge}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Custom Prompt Input */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-foreground flex items-center justify-between">
                      <span>Replacement Prompt</span>
                      {generativePrompt && (
                        <button
                          type="button"
                          onClick={() => setGenerativePrompt("")}
                          className="text-[10px] text-muted-foreground hover:text-foreground"
                        >
                          Clear
                        </button>
                      )}
                    </Label>
                    <Input
                      value={generativePrompt}
                      onChange={(e) => setGenerativePrompt(e.target.value)}
                      placeholder="e.g. coffee mug on wooden table, vibrant sunflowers..."
                      className="text-xs h-9 bg-background/80"
                    />
                  </div>

                  {/* Primary Generative Action Button */}
                  <Button
                    variant="default"
                    size="lg"
                    disabled={!hasMask || isProcessing}
                    onClick={handleAiGenerativeFill}
                    className="w-full gap-2 bg-gradient-to-r from-purple-600 via-pink-600 to-rose-600 hover:from-purple-700 hover:to-rose-700 text-white font-semibold shadow-md h-12 text-sm transition-all cursor-pointer"
                  >
                    <Sparkles className="h-4 w-4" />
                    Generate AI Replacement {hasMask ? "(Ready)" : "(Paint First)"}
                  </Button>
                </div>
              )}

              {/* Brush Settings */}
              <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm space-y-4">
                <Label className="text-sm font-semibold flex items-center justify-between">
                  <span>Brush Size</span>
                  <span className="font-mono text-xs">{brushSize} px</span>
                </Label>

                <Slider
                  value={[brushSize]}
                  min={6}
                  max={80}
                  step={2}
                  onValueChange={([val]) => setBrushSize(val)}
                />
              </div>

              {/* Export Suite */}
              <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm space-y-3">
                <Label className="text-sm font-semibold">Export Clean Image</Label>

                <div className="grid grid-cols-3 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1 text-xs"
                    onClick={() => handleExport("jpeg")}
                  >
                    <Download className="h-3.5 w-3.5" />
                    JPG
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1 text-xs"
                    onClick={() => handleExport("png")}
                  >
                    <Download className="h-3.5 w-3.5" />
                    PNG
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1 text-xs"
                    onClick={() => handleExport("webp")}
                  >
                    <Download className="h-3.5 w-3.5" />
                    WEBP
                  </Button>
                </div>

                <div className="pt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-xs text-muted-foreground gap-1.5"
                    onClick={() => {
                      setFile(null);
                      setOriginalImage(null);
                      setHistory([]);
                      setHistoryIndex(-1);
                    }}
                  >
                    <RefreshCw className="h-3 w-3" />
                    Upload Different Photo
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AuthGate>
  );
}

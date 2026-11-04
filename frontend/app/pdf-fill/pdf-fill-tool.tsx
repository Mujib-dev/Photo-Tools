"use client";

import React, { useState, useRef, useEffect, useId } from "react";
import {
  FileText,
  Upload,
  Download,
  ChevronLeft,
  ChevronRight,
  Type,
  Check,
  X,
  Calendar,
  PenTool,
  Trash2,
  ZoomIn,
  ZoomOut,
  Sparkles,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import {
  FillElement,
  FillFieldType,
  loadPdfDocument,
  renderPdfPage,
  exportFlattenedPdf,
} from "@/lib/pdf-fill-engine";
import { downloadBlob } from "@/lib/screenshot";

export function PdfFillTool() {
  const [file, setFile] = useState<File | null>(null);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(0); // 0-based
  const [zoomScale, setZoomScale] = useState<number>(1.4);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // Placed elements across all pages
  const [elements, setElements] = useState<FillElement[]>([]);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);

  // Active Tool selection
  const [activeTool, setActiveTool] = useState<FillFieldType>("text");
  const [fontSize, setFontSize] = useState<number>(16);
  const [fontColor, setFontColor] = useState<string>("#000000");
  const [textInputVal, setTextInputVal] = useState<string>("Sample Text");

  // Signature Modal State
  const [showSigModal, setShowSigModal] = useState<boolean>(false);
  const [savedSignatureUrl, setSavedSignatureUrl] = useState<string | null>(null);
  const [isDrawingSig, setIsDrawingSig] = useState<boolean>(false);

  // Canvas Refs
  const pageCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sigCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputId = useId();

  // Load PDF file
  const handlePdfUpload = async (uploadedFile: File) => {
    if (uploadedFile.type !== "application/pdf" && !uploadedFile.name.endsWith(".pdf")) {
      toast.error("Please upload a valid PDF document.");
      return;
    }

    try {
      setIsLoading(true);
      const doc = await loadPdfDocument(uploadedFile);
      setFile(uploadedFile);
      setPdfDoc(doc);
      setNumPages(doc.numPages);
      setCurrentPage(0);
      setElements([]);
      setSelectedElementId(null);
      toast.success(`Loaded PDF: ${uploadedFile.name} (${doc.numPages} pages)`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to load PDF document.");
    } finally {
      setIsLoading(false);
    }
  };

  // Render current page when page index or zoom changes
  useEffect(() => {
    if (!pdfDoc || !pageCanvasRef.current) return;

    let isMounted = true;
    renderPdfPage(pdfDoc, currentPage, pageCanvasRef.current, zoomScale)
      .catch((err) => {
        if (isMounted) console.error("Render page error:", err);
      });

    return () => {
      isMounted = false;
    };
  }, [pdfDoc, currentPage, zoomScale]);

  // Handle clicking on page to stamp selected element
  const handlePageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!pageCanvasRef.current) return;

    const rect = pageCanvasRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    if (clickX < 0 || clickX > rect.width || clickY < 0 || clickY > rect.height) return;

    const xPercent = Math.round((clickX / rect.width) * 10000) / 100;
    const yPercent = Math.round((clickY / rect.height) * 10000) / 100;

    if (activeTool === "signature" && !savedSignatureUrl) {
      setShowSigModal(true);
      return;
    }

    const todayStr = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

    const newEl: FillElement = {
      id: `el-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      pageIndex: currentPage,
      type: activeTool,
      xPercent,
      yPercent,
      text: activeTool === "text" ? textInputVal : activeTool === "date" ? todayStr : undefined,
      fontSize,
      color: fontColor,
      signatureDataUrl: activeTool === "signature" ? savedSignatureUrl || undefined : undefined,
      widthPercent: activeTool === "signature" ? 22 : undefined,
    };

    setElements((prev) => [...prev, newEl]);
    setSelectedElementId(newEl.id);
  };

  // Delete element
  const handleDeleteElement = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setElements((prev) => prev.filter((el) => el.id !== id));
    if (selectedElementId === id) setSelectedElementId(null);
  };

  // Update text of selected element
  const handleUpdateElementText = (id: string, newText: string) => {
    setElements((prev) =>
      prev.map((el) => (el.id === id ? { ...el, text: newText } : el))
    );
  };

  // Signature Canvas Helpers
  const startSigDraw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    setIsDrawingSig(true);
    const rect = canvas.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
  };

  const drawSig = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawingSig) return;
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#002B49";
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
  };

  const endSigDraw = () => {
    setIsDrawingSig(false);
  };

  const handleClearSig = () => {
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx?.clearRect(0, 0, canvas.width, canvas.height);
  };

  const handleSaveSignature = () => {
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    setSavedSignatureUrl(url);
    setShowSigModal(false);
    toast.success("Signature saved! Click anywhere on the PDF page to stamp it.");
  };

  // Flatten and Export signed PDF
  const handleExportPdf = async () => {
    if (!pdfDoc || !file) return;

    try {
      setIsExporting(true);
      toast.info("Assembling and flattening signed PDF pages...");

      const pagesToProcess = [];

      for (let i = 0; i < numPages; i++) {
        const offscreenCanvas = document.createElement("canvas");
        await renderPdfPage(pdfDoc, i, offscreenCanvas, 2.0);
        const pageElements = elements.filter((el) => el.pageIndex === i);
        pagesToProcess.push({ canvas: offscreenCanvas, elements: pageElements });
      }

      const pdfBlob = await exportFlattenedPdf(pagesToProcess);
      const downloadName = file.name.replace(/\.[^/.]+$/, "") + "-signed.pdf";
      downloadBlob(pdfBlob, downloadName);
      toast.success("Downloaded flattened signed PDF!");
    } catch (err: any) {
      toast.error(err?.message || "Failed to generate signed PDF.");
    } finally {
      setIsExporting(false);
    }
  };

  const currentElements = elements.filter((el) => el.pageIndex === currentPage);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400">
          <PenTool className="h-3.5 w-3.5" />
          DocuSign & Adobe Acrobat Alternative
        </div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Interactive PDF Form "Fill & Sign" Studio
        </h1>
        <p className="mt-2 text-sm text-muted-foreground sm:text-base">
          Fill out non-interactive PDF forms, stamp dates, checkmarks, text boxes, and draw legal digital signatures. 100% in-browser and private.
        </p>
      </div>

      {!file ? (
        /* Upload Hero Dropzone */
        <div
          onClick={() => fileInputRef.current?.click()}
          className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-border/80 bg-card/60 p-12 text-center transition hover:border-primary/60 hover:bg-muted/30 cursor-pointer shadow-lg"
        >
          <div className="rounded-2xl bg-emerald-500/10 p-5 text-emerald-400 mb-4 shadow-inner">
            <FileText className="h-10 w-10" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Drop any PDF form or agreement here</h2>
          <p className="mt-2 text-sm text-muted-foreground max-w-md">
            W-9 tax forms, leases, freelance contracts, liability waivers, or application documents.
          </p>
          <button
            type="button"
            className="mt-6 flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-md hover:opacity-90 transition"
          >
            <Upload className="h-4 w-4" />
            Select PDF Document
          </button>
          <input
            id={fileInputId}
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handlePdfUpload(e.target.files[0])}
          />
        </div>
      ) : (
        /* Interactive PDF Editor Workspace */
        <div className="space-y-4">
          {/* Top Control Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card p-3 shadow-md">
            {/* Tool Selection Buttons */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setActiveTool("text")}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                  activeTool === "text"
                    ? "bg-primary text-primary-foreground shadow"
                    : "border border-border/60 bg-background text-muted-foreground hover:bg-muted"
                }`}
              >
                <Type className="h-3.5 w-3.5" />
                Text
              </button>

              <button
                type="button"
                onClick={() => setActiveTool("check")}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                  activeTool === "check"
                    ? "bg-primary text-primary-foreground shadow"
                    : "border border-border/60 bg-background text-muted-foreground hover:bg-muted"
                }`}
              >
                <Check className="h-3.5 w-3.5" />
                Check (✓)
              </button>

              <button
                type="button"
                onClick={() => setActiveTool("cross")}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                  activeTool === "cross"
                    ? "bg-primary text-primary-foreground shadow"
                    : "border border-border/60 bg-background text-muted-foreground hover:bg-muted"
                }`}
              >
                <X className="h-3.5 w-3.5" />
                Cross (✗)
              </button>

              <button
                type="button"
                onClick={() => setActiveTool("date")}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                  activeTool === "date"
                    ? "bg-primary text-primary-foreground shadow"
                    : "border border-border/60 bg-background text-muted-foreground hover:bg-muted"
                }`}
              >
                <Calendar className="h-3.5 w-3.5" />
                Date Stamp
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTool("signature");
                  if (!savedSignatureUrl) setShowSigModal(true);
                }}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                  activeTool === "signature"
                    ? "bg-emerald-600 text-white shadow"
                    : "border border-border/60 bg-background text-muted-foreground hover:bg-muted"
                }`}
              >
                <PenTool className="h-3.5 w-3.5" />
                {savedSignatureUrl ? "Signature (Ready)" : "Draw Signature"}
              </button>
            </div>

            {/* Customizer Props for Text */}
            {activeTool === "text" && (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={textInputVal}
                  onChange={(e) => setTextInputVal(e.target.value)}
                  placeholder="Text to stamp..."
                  className="rounded-lg border border-border/60 bg-background px-2.5 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 w-36"
                />

                <select
                  value={fontSize}
                  onChange={(e) => setFontSize(parseInt(e.target.value, 10))}
                  className="rounded-lg border border-border/60 bg-background px-2 py-1 text-xs text-foreground cursor-pointer"
                >
                  <option value={12}>12 pt</option>
                  <option value={14}>14 pt</option>
                  <option value={16}>16 pt</option>
                  <option value={20}>20 pt</option>
                  <option value={24}>24 pt</option>
                </select>

                <div className="flex items-center gap-1">
                  {["#000000", "#002B49", "#D32F2F"].map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setFontColor(color)}
                      className={`h-5 w-5 rounded-full border border-border/80 transition ${
                        fontColor === color ? "ring-2 ring-primary ring-offset-1" : ""
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Export and Actions */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportPdf}
                disabled={isExporting}
                className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow hover:bg-emerald-500 transition disabled:opacity-50"
              >
                <Download className="h-3.5 w-3.5" />
                {isExporting ? "Flattening..." : "Download Signed PDF"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setFile(null);
                  setPdfDoc(null);
                  setElements([]);
                }}
                className="rounded-xl border border-border/60 bg-muted/40 p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition"
                title="Open new file"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Page Navigation & Zoom Bar */}
          <div className="flex items-center justify-between text-xs text-muted-foreground px-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={currentPage === 0}
                onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                className="rounded-lg border border-border/60 bg-card p-1.5 text-foreground hover:bg-muted disabled:opacity-40 transition"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="font-semibold text-foreground">
                Page {currentPage + 1} of {numPages}
              </span>
              <button
                type="button"
                disabled={currentPage >= numPages - 1}
                onClick={() => setCurrentPage((p) => Math.min(numPages - 1, p + 1))}
                className="rounded-lg border border-border/60 bg-card p-1.5 text-foreground hover:bg-muted disabled:opacity-40 transition"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setZoomScale((s) => Math.max(0.8, s - 0.2))}
                className="rounded-lg border border-border/60 bg-card p-1.5 text-foreground hover:bg-muted transition"
                title="Zoom Out"
              >
                <ZoomOut className="h-3.5 w-3.5" />
              </button>
              <span className="font-mono">{Math.round(zoomScale * 100)}%</span>
              <button
                type="button"
                onClick={() => setZoomScale((s) => Math.min(2.5, s + 0.2))}
                className="rounded-lg border border-border/60 bg-card p-1.5 text-foreground hover:bg-muted transition"
                title="Zoom In"
              >
                <ZoomIn className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* PDF Page Canvas + Overlay Container */}
          <div
            ref={containerRef}
            className="relative mx-auto overflow-auto rounded-2xl border border-border/80 bg-neutral-900/50 p-4 shadow-2xl flex justify-center max-h-[750px]"
          >
            <div
              className="relative shadow-2xl cursor-crosshair inline-block select-none bg-white rounded"
              onClick={handlePageClick}
            >
              {/* Underlying rendered PDF page */}
              <canvas ref={pageCanvasRef} className="block" />

              {/* Interactive Placed Elements on Current Page */}
              {currentElements.map((el) => {
                const isSelected = selectedElementId === el.id;
                return (
                  <div
                    key={el.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedElementId(el.id);
                    }}
                    style={{
                      left: `${el.xPercent}%`,
                      top: `${el.yPercent}%`,
                      transform: "translate(0, 0)",
                    }}
                    className={`group absolute cursor-pointer transition-all ${
                      isSelected
                        ? "ring-2 ring-sky-500 rounded bg-sky-500/10 p-0.5"
                        : "hover:ring-1 hover:ring-sky-400/60"
                    }`}
                  >
                    {/* Render Content */}
                    {el.type === "text" || el.type === "date" ? (
                      <span
                        style={{
                          fontSize: `${(el.fontSize || 16) * (zoomScale / 1.4)}px`,
                          color: el.color || "#000000",
                        }}
                        className="font-sans font-medium whitespace-nowrap leading-none block"
                      >
                        {el.text}
                      </span>
                    ) : el.type === "check" ? (
                      <span className="text-xl font-bold text-sky-700 leading-none">✓</span>
                    ) : el.type === "cross" ? (
                      <span className="text-xl font-bold text-red-600 leading-none">✗</span>
                    ) : el.type === "signature" && el.signatureDataUrl ? (
                      <img
                        src={el.signatureDataUrl}
                        alt="Signature"
                        className="h-10 w-auto object-contain pointer-events-none"
                      />
                    ) : null}

                    {/* Delete Badge */}
                    <button
                      type="button"
                      onClick={(e) => handleDeleteElement(el.id, e)}
                      className="absolute -top-3 -right-3 hidden h-4 w-4 items-center justify-center rounded-full bg-red-500 text-white shadow group-hover:flex hover:scale-110 transition"
                      title="Delete"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Signature Pad Modal Dialog */}
      {showSigModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-border/80 bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PenTool className="h-5 w-5 text-emerald-400" />
                <h3 className="text-base font-bold text-foreground">Draw Your Signature</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSigModal(false)}
                className="p-1 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-muted-foreground">
              Sign smoothly inside the box using your mouse, trackpad, or finger on touch screens.
            </p>

            <div className="rounded-xl border border-border/80 bg-white p-2">
              <canvas
                ref={sigCanvasRef}
                width={400}
                height={160}
                onMouseDown={startSigDraw}
                onMouseMove={drawSig}
                onMouseUp={endSigDraw}
                onMouseLeave={endSigDraw}
                className="w-full h-40 cursor-crosshair touch-none"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={handleClearSig}
                className="flex items-center gap-1 rounded-xl border border-border/60 bg-muted/40 px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Clear
              </button>

              <button
                type="button"
                onClick={handleSaveSignature}
                className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow hover:bg-emerald-500 transition"
              >
                <Check className="h-3.5 w-3.5" />
                Save & Use Signature
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

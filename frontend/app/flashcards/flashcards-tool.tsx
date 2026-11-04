"use client";

import React, { useState, useRef, useId } from "react";
import {
  GraduationCap,
  Upload,
  Download,
  RotateCcw,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  Printer,
  BookOpen,
} from "lucide-react";
import { toast } from "sonner";
import {
  Flashcard,
  SAMPLE_DECKS,
  extractFlashcardsFromText,
} from "@/lib/flashcard-engine";
import { extractTextFromFile } from "@/lib/file-text-extractor";

export function FlashcardsTool() {
  const [deck, setDeck] = useState<Flashcard[]>(SAMPLE_DECKS.cs.cards);
  const [deckTitle, setDeckTitle] = useState<string>("Computer Science & Web Architecture");
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isFlipped, setIsFlipped] = useState<boolean>(false);
  const [inputText, setInputText] = useState<string>("");
  const [isLoadingFile, setIsLoadingFile] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputId = useId();

  const currentCard = deck[currentIndex] || deck[0];

  // Upload Notes Document (PDF, Word, TXT)
  const handleFileUpload = async (file: File) => {
    try {
      setIsLoadingFile(true);
      const res = await extractTextFromFile(file);
      const extracted = extractFlashcardsFromText(res.text);

      if (extracted.length > 0) {
        setDeck(extracted);
        setDeckTitle(file.name.replace(/\.[^/.]+$/, ""));
        setCurrentIndex(0);
        setIsFlipped(false);
        toast.success(`Generated ${extracted.length} flashcards from ${file.name}!`);
      } else {
        toast.error("Could not detect any Q&A or key concepts from this document.");
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to read notes document.");
    } finally {
      setIsLoadingFile(false);
    }
  };

  // Generate from pasted text
  const handleGenerateFromText = () => {
    if (!inputText.trim()) {
      toast.error("Please paste your lecture notes or text first.");
      return;
    }
    const extracted = extractFlashcardsFromText(inputText);
    if (extracted.length > 0) {
      setDeck(extracted);
      setDeckTitle("Custom Study Deck");
      setCurrentIndex(0);
      setIsFlipped(false);
      setInputText("");
      toast.success(`Generated ${extracted.length} flashcards!`);
    } else {
      toast.error("Could not parse flashcards. Use format: 'Term: Definition' or bullet points.");
    }
  };

  // Toggle Mastery
  const toggleMastered = (cardId: string) => {
    setDeck((prev) =>
      prev.map((c) => (c.id === cardId ? { ...c, mastered: !c.mastered } : c))
    );
  };

  // Next / Prev Navigation
  const goNext = () => {
    if (currentIndex < deck.length - 1) {
      setCurrentIndex((i) => i + 1);
      setIsFlipped(false);
    }
  };

  const goPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
      setIsFlipped(false);
    }
  };

  // Print Study Sheet
  const handlePrintStudySheet = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    let html = `
      <html>
      <head>
        <title>${deckTitle} — Study Sheet</title>
        <style>
          body { font-family: system-ui, sans-serif; padding: 40px; color: #1e293b; max-width: 800px; margin: 0 auto; }
          h1 { border-bottom: 2px solid #0f172a; padding-bottom: 12px; }
          .card { margin-bottom: 24px; padding: 16px; border: 1px solid #cbd5e1; border-radius: 8px; page-break-inside: avoid; }
          .q { font-weight: bold; font-size: 16px; color: #0f172a; margin-bottom: 8px; }
          .a { font-size: 14px; color: #334155; line-height: 1.5; }
        </style>
      </head>
      <body>
        <h1>${deckTitle} — Review Sheet</h1>
    `;

    deck.forEach((card, idx) => {
      html += `
        <div class="card">
          <div class="q">${idx + 1}. ${card.question}</div>
          <div class="a">${card.answer}</div>
        </div>
      `;
    });

    html += `
        <script>window.onload = function() { window.print(); }</script>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  const masteredCount = deck.filter((c) => c.mastered).length;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <div className="inline-flex items-center gap-2 rounded-full border border-sky-500/20 bg-sky-500/10 px-3 py-1 text-xs font-semibold text-sky-400">
          <GraduationCap className="h-3.5 w-3.5" />
          Academic & Student Study Studio
        </div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          AI Flashcard & Study Quiz Generator
        </h1>
        <p className="mt-2 text-sm text-muted-foreground sm:text-base">
          Drop PDF lecture notes or textbook chapters to generate interactive flipping Q&A flashcards and printable revision sheets. 100% in-browser.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Interactive Flipping Flashcard */}
        <div className="space-y-4 lg:col-span-7">
          {/* Deck Stats Bar */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-bold text-foreground truncate max-w-[240px]">
              {deckTitle}
            </span>
            <div className="flex items-center gap-3 font-mono">
              <span>Card {currentIndex + 1} of {deck.length}</span>
              <span className="text-emerald-400 font-bold">
                ✓ {masteredCount} Mastered
              </span>
            </div>
          </div>

          {/* 3D Flipping Card */}
          {currentCard && (
            <div
              onClick={() => setIsFlipped(!isFlipped)}
              className="relative aspect-[4/3] w-full cursor-pointer select-none rounded-3xl border border-border/80 bg-card p-8 shadow-2xl transition hover:border-primary/60 flex flex-col justify-between"
            >
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="font-mono uppercase font-bold tracking-wider">
                  {isFlipped ? "💡 Answer" : "❓ Question (Click to flip)"}
                </span>
                {currentCard.mastered && (
                  <span className="flex items-center gap-1 text-emerald-400 font-bold">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Mastered
                  </span>
                )}
              </div>

              <div className="py-8 text-center">
                <p className={`font-bold transition-all ${
                  isFlipped ? "text-lg text-emerald-400 leading-relaxed font-sans" : "text-2xl text-foreground"
                }`}>
                  {isFlipped ? currentCard.answer : currentCard.question}
                </p>
              </div>

              <div className="text-center text-[11px] text-muted-foreground">
                Tap or click card to flip
              </div>
            </div>
          )}

          {/* Navigation & Mastery Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card p-3 shadow-md">
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={currentIndex === 0}
                onClick={goPrev}
                className="flex items-center gap-1 rounded-xl border border-border/60 bg-background px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted disabled:opacity-40 transition"
              >
                <ChevronLeft className="h-4 w-4" /> Prev
              </button>

              <button
                type="button"
                disabled={currentIndex === deck.length - 1}
                onClick={goNext}
                className="flex items-center gap-1 rounded-xl border border-border/60 bg-background px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted disabled:opacity-40 transition"
              >
                Next <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              {currentCard && (
                <button
                  type="button"
                  onClick={() => toggleMastered(currentCard.id)}
                  className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition ${
                    currentCard.mastered
                      ? "bg-emerald-600 text-white shadow"
                      : "border border-border/60 bg-background text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {currentCard.mastered ? "Mastered" : "Mark as Mastered"}
                </button>
              )}

              <button
                type="button"
                onClick={handlePrintStudySheet}
                className="flex items-center gap-1.5 rounded-xl border border-border/60 bg-muted/40 px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted transition"
                title="Print study review sheet"
              >
                <Printer className="h-3.5 w-3.5" />
                Print Sheet
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: AI Document Ingestion & Sample Decks */}
        <div className="space-y-4 lg:col-span-5">
          <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-xl space-y-4">
            {/* Drop Notes Document */}
            <div>
              <label className="text-xs font-bold text-foreground block mb-1.5">
                Drop PDF / Word Notes
              </label>
              <div
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border/80 bg-background/50 p-4 text-center cursor-pointer hover:border-primary/60 transition"
              >
                <Upload className="h-5 w-5 text-muted-foreground mb-1" />
                <span className="text-xs font-semibold text-foreground">
                  {isLoadingFile ? "Reading document..." : "Upload PDF or Word Notes"}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  Automatically extracts definitions & Q&A
                </span>
                <input
                  id={fileInputId}
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx,.doc,.txt"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                />
              </div>
            </div>

            {/* Paste Text / AI Slicer */}
            <div className="space-y-2 pt-2 border-t border-border/40">
              <label className="text-xs font-bold text-foreground block">
                Or Paste Lecture Notes / Text
              </label>
              <textarea
                rows={3}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Paste terms, definitions or study notes here..."
                className="w-full rounded-xl border border-border/60 bg-background p-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
              />
              <button
                type="button"
                onClick={handleGenerateFromText}
                className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground shadow hover:opacity-90 transition"
              >
                <Sparkles className="h-3.5 w-3.5" />
                AI Generate Flashcards
              </button>
            </div>

            {/* Sample Decks */}
            <div className="pt-2 border-t border-border/40 space-y-2">
              <label className="text-xs font-bold text-foreground block">
                Sample Preloaded Decks
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setDeck(SAMPLE_DECKS.cs.cards);
                    setDeckTitle(SAMPLE_DECKS.cs.title);
                    setCurrentIndex(0);
                    setIsFlipped(false);
                  }}
                  className="rounded-xl border border-border/60 bg-background p-2 text-left text-xs font-semibold text-foreground hover:bg-muted"
                >
                  💻 Web & CS
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDeck(SAMPLE_DECKS.business.cards);
                    setDeckTitle(SAMPLE_DECKS.business.title);
                    setCurrentIndex(0);
                    setIsFlipped(false);
                  }}
                  className="rounded-xl border border-border/60 bg-background p-2 text-left text-xs font-semibold text-foreground hover:bg-muted"
                >
                  📈 Business & Startups
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

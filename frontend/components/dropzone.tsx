"use client";

import * as React from "react";
import { CloudUpload } from "lucide-react";

import { cn } from "@/lib/utils";

type DropzoneKind = "image" | "pdf" | "document" | "audio";

interface DropzoneProps {
  onFiles: (files: File[]) => void;
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  compact?: boolean;
  /** Which uploads to keep: images (default), PDFs, or any importable document. */
  kind?: DropzoneKind;
}

const IMAGE_PATTERN = /\.(jpe?g|png|gif|webp|bmp|tiff?|heic|heif)$/i;

const DOCUMENT_PATTERN =
  /\.(pdf|docx?|txt|md|markdown|csv|log|rtf|png|jpe?g|gif|webp|bmp|tiff?|heic|heif)$/i;

const AUDIO_PATTERN =
  /\.(wav|mp3|m4a|aac|ogg|oga|opus|flac|webm|mp4|m4v|mov|mkv|avi|wmv|mpg|mpeg|3gp)$/i;

function keepByKind(files: File[], kind: DropzoneKind): File[] {
  if (kind === "audio") {
    return files.filter(
      (f) =>
        f.type.startsWith("audio/") ||
        f.type.startsWith("video/") ||
        AUDIO_PATTERN.test(f.name),
    );
  }
  if (kind === "pdf") {
    return files.filter((f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"));
  }
  if (kind === "document") {
    return files.filter(
      (f) =>
        f.type.startsWith("image/") ||
        f.type.startsWith("text/") ||
        DOCUMENT_PATTERN.test(f.name),
    );
  }
  return files.filter((f) => f.type.startsWith("image/") || IMAGE_PATTERN.test(f.name));
}

const KIND_LABEL: Record<DropzoneKind, { aria: string; title: string; tap: string; drop: string }> = {
  image: {
    aria: "Upload images",
    title: "Drag & drop your images here",
    tap: "Tap to choose your images",
    drop: "Drop images here",
  },
  pdf: {
    aria: "Upload PDFs",
    title: "Drag & drop your PDFs here",
    tap: "Tap to choose your PDFs",
    drop: "Drop PDFs here",
  },
  document: {
    aria: "Upload documents",
    title: "Drag & drop a PDF, Word, text or image file",
    tap: "Tap to choose a file",
    drop: "Drop your file here",
  },
  audio: {
    aria: "Upload audio or video",
    title: "Drag & drop an audio or video file",
    tap: "Tap to choose an audio or video file",
    drop: "Drop your file here",
  },
};

export function Dropzone({
  onFiles,
  accept = "image/*,.heic,.heif",
  multiple = true,
  disabled = false,
  compact = false,
  kind = "image",
}: DropzoneProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = React.useState(false);
  const [coarsePointer, setCoarsePointer] = React.useState(false);
  const labels = KIND_LABEL[kind];

  // Drag & drop does not exist on a phone, so the wording changes to match
  // the device the visitor is actually using.
  React.useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const query = window.matchMedia("(pointer: coarse)");
    const sync = () => setCoarsePointer(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  const handleFiles = (list: FileList | null) => {
    if (!list || list.length === 0) return;
    const kept = keepByKind(Array.from(list), kind);
    if (kept.length > 0) onFiles(multiple ? kept : kept.slice(0, 1));
  };

  return (
    <div
      role="button"
      tabIndex={0}
      data-dropzone="true"
      aria-label={labels.aria}
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && !disabled) inputRef.current?.click();
      }}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (!disabled) handleFiles(e.dataTransfer.files);
      }}
      className={cn(
        "group cursor-pointer rounded-[32px] border-2 border-dashed text-center transition-colors",
        compact ? "px-4 py-8" : "p-6 sm:p-8 md:p-10",
        dragging
          ? "border-primary-container bg-primary-container/5"
          : "border-outline-variant hover:border-primary-container",
        disabled && "pointer-events-none opacity-50",
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <div
        className={cn(
          "mx-auto flex items-center justify-center rounded-full bg-surface-container-high transition-transform duration-500 group-hover:scale-110",
          compact ? "mb-3 h-14 w-14" : "mb-4 h-16 w-16 sm:h-20 sm:w-20",
        )}
      >
        <CloudUpload className={compact ? "h-7 w-7" : "h-8 w-8 sm:h-10 sm:w-10"} />
      </div>
      <p className={cn("font-display text-foreground", compact ? "text-lg" : "text-xl font-medium")}>
        {dragging ? labels.drop : coarsePointer ? labels.tap : labels.title}
      </p>
      {!coarsePointer && (
        <p className="mt-1 text-on-surface-variant">
          or <span className="font-medium text-primary-container">click to browse</span> from your
          device
        </p>
      )}
    </div>
  );
}

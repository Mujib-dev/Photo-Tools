"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { CloudUpload, FileUp } from "lucide-react";
import { toast } from "sonner";

import { TOOLS } from "@/lib/tools";

function hasFiles(event: DragEvent): boolean {
  return Array.from(event.dataTransfer?.types ?? []).includes("Files");
}

function matchesAccept(file: File, accept: string): boolean {
  const tokens = accept
    .split(",")
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean);
  if (tokens.length === 0) return true;

  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();

  return tokens.some((token) => {
    if (token.startsWith(".")) return name.endsWith(token);
    if (token.endsWith("/*")) return type.startsWith(token.slice(0, -1));
    return type === token;
  });
}

function assignFiles(input: HTMLInputElement, files: File[]) {
  const data = new DataTransfer();
  for (const file of files) data.items.add(file);
  input.files = data.files;
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function hasUploadTarget(): boolean {
  return Boolean(
    document.querySelector("#main-content input[type=file], #main-content [data-dropzone]"),
  );
}

export function GlobalDropUpload() {
  const pathname = usePathname();
  const [dragging, setDragging] = React.useState(false);
  const dragDepth = React.useRef(0);

  const tool = React.useMemo(
    () =>
      TOOLS.find(
        (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
      ) ?? null,
    [pathname],
  );

  React.useEffect(() => {
    if (!tool) return;

    const reset = () => {
      dragDepth.current = 0;
      setDragging(false);
    };

    const onDragEnter = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      if (!hasUploadTarget()) return;
      dragDepth.current += 1;
      setDragging(true);
    };

    const onDragOver = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
    };

    const onDragLeave = (event: DragEvent) => {
      if (!hasFiles(event) && dragDepth.current === 0) return;
      if (event.relatedTarget === null) {
        reset();
        return;
      }
      dragDepth.current = Math.max(0, dragDepth.current - 1);
      if (dragDepth.current === 0) setDragging(false);
    };

    const onDrop = (event: DragEvent) => {
      const files = event.dataTransfer?.files;
      const handledByTarget = event.defaultPrevented;
      if (!files || files.length === 0) {
        reset();
        return;
      }

      event.preventDefault();
      reset();

      const target = event.target instanceof Element ? event.target : null;
      if (handledByTarget || target?.closest("[data-dropzone]")) return;

      const inputs = Array.from(
        document.querySelectorAll<HTMLInputElement>("#main-content input[type=file]"),
      ).filter((input) => !input.disabled);

      if (inputs.length === 0) {
        toast.info("This tool does not take file uploads. Choose a file-based tool instead.");
        return;
      }

      const dropped = Array.from(files);
      const input = inputs.find((candidate) =>
        dropped.some((file) => matchesAccept(file, candidate.accept)),
      );

      if (!input) {
        toast.error("That file type is not accepted here.");
        return;
      }

      const accepted = dropped.filter((file) => matchesAccept(file, input.accept));
      const selected = input.multiple ? accepted : accepted.slice(0, 1);

      try {
        assignFiles(input, selected);
        input.closest("label, [role='button']")?.scrollIntoView({
          block: "center",
          behavior: "smooth",
        });
        toast.success(
          selected.length === 1
            ? `Added ${selected[0].name}`
            : `Added ${selected.length} files to ${tool.label}`,
        );
      } catch {
        toast.error("Could not hand the dropped file to this tool.");
      }
    };

    window.addEventListener("dragenter", onDragEnter);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);
    window.addEventListener("dragend", reset);

    return () => {
      window.removeEventListener("dragenter", onDragEnter);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
      window.removeEventListener("dragend", reset);
    };
  }, [tool]);

  if (!tool || !dragging) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-0 z-[110] flex items-center justify-center bg-background/75 p-6 backdrop-blur-sm"
    >
      <div className="flex max-w-lg flex-col items-center rounded-[32px] border-2 border-dashed border-primary bg-card/95 px-8 py-12 text-center shadow-2xl">
        <div className="relative mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-primary">
          <CloudUpload className="h-10 w-10" />
          <FileUp className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-card p-1 text-primary-container" />
        </div>
        <p className="font-display text-2xl font-bold text-foreground">
          Drop files into {tool.label}
        </p>
        <p className="mt-2 text-sm text-on-surface-variant">
          The tool&apos;s upload area will pick them up automatically. Use the{" "}
          <span className="font-semibold text-primary">Save as</span> button afterward to keep your
          settings.
        </p>
      </div>
    </div>
  );
}

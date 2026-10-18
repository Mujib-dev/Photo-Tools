"use client";

import Link from "next/link";
import { CloudUpload } from "lucide-react";

import { useAuth } from "@/components/auth-provider";

export function HomeUpload() {
  const { status } = useAuth();

  if (status !== "authed") return null;

  return (
    <Link
      href="/resize"
      aria-label="Upload images — go to the resizer"
      className="group block cursor-pointer rounded-[32px] border-2 border-dashed border-outline-variant glass-panel p-6 text-center transition-colors hover:border-primary-container sm:p-10"
    >
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-surface-container-high transition-transform duration-500 group-hover:scale-110 sm:h-24 sm:w-24">
        <CloudUpload className="h-8 w-8 text-primary-container sm:h-12 sm:w-12" />
      </div>
      <h3 className="font-display text-xl font-medium text-foreground">
        Drag &amp; drop your images here
      </h3>
      <p className="mt-1 text-on-surface-variant">or click to browse from your device</p>
      <p className="mt-4 font-mono text-xs text-secondary-foreground">
        Supports JPG, PNG, BMP, TIFF (Max 50MB)
      </p>
    </Link>
  );
}

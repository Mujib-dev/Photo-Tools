import Link from "next/link";
import { Sparkles, ScanLine, Repeat, Scaling, ArrowRight } from "lucide-react";

import { HomeUpload } from "@/components/home-upload";
import { TOOLS } from "@/lib/tools";

export default function HomePage() {
  return (
    <div>
      {/* Hero */}
      <section className="mx-auto max-w-[1280px] px-4 pb-16 pt-12 sm:px-6 md:pb-20 md:pt-24">
        <div className="mx-auto mb-14 max-w-3xl text-center">
          <h1 className="font-display text-[28px] font-semibold leading-tight tracking-[-0.01em] text-foreground text-balance sm:text-[36px] md:text-5xl md:leading-[56px]">
            Resize, Enhance, Scan &amp; Convert Your Images in Seconds
          </h1>
          <p className="mt-4 font-body text-base leading-7 text-on-surface-variant sm:text-lg">
            Simple, fast, and high-quality tools for all your photos.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row sm:gap-4">
            <Link
              href="/resize"
              className="flex items-center justify-center gap-2 rounded-xl bg-primary-container px-8 py-3.5 font-display text-[13px] font-semibold tracking-[0.02em] text-on-primary-container shadow-[0_4px_12px_rgba(37,99,235,0.2)] transition-transform duration-500 hover:scale-[1.02] sm:px-10 sm:py-4"
            >
              <Scaling className="h-5 w-5" />
              Resize Image
            </Link>
            <Link
              href="/enhance"
              className="flex items-center justify-center gap-2 rounded-xl bg-primary px-8 py-3.5 font-display text-[13px] font-semibold tracking-[0.02em] text-on-primary shadow-[0_4px_12px_rgba(37,99,235,0.2)] transition-transform duration-500 hover:scale-[1.02] sm:px-10 sm:py-4"
            >
              <Sparkles className="h-5 w-5" />
              Enhance Photo
            </Link>
            <Link
              href="/convert"
              className="flex items-center justify-center gap-2 rounded-xl border border-outline-variant px-8 py-3.5 font-display text-[13px] font-semibold tracking-[0.02em] text-foreground transition-colors hover:bg-surface-container-high/50 sm:px-10 sm:py-4"
            >
              <Repeat className="h-5 w-5" />
              Convert Image
            </Link>
            <Link
              href="/scan"
              className="flex items-center justify-center gap-2 rounded-xl border border-outline-variant px-8 py-3.5 font-display text-[13px] font-semibold tracking-[0.02em] text-foreground transition-colors hover:bg-surface-container-high/50 sm:px-10 sm:py-4"
            >
              <ScanLine className="h-5 w-5" />
              Scan Document
            </Link>
          </div>
        </div>

        {/* Upload area — hidden until the visitor has an account */}
        <HomeUpload />
      </section>

      {/* Tools */}
      <section className="mx-auto max-w-[1280px] px-4 pb-16 sm:px-6">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4">
          {TOOLS.map((tool) => {
            const Icon = tool.icon;
            return (
              <Link
                key={tool.href}
                href={tool.href}
                className="group rounded-2xl glass-panel p-6 transition-all duration-300 hover:border-primary-container"
              >
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-xl bg-primary-container/10 transition-colors group-hover:bg-primary-container/20">
                  <Icon className="h-8 w-8 text-primary-container" />
                </div>
                <h3 className="mb-2 flex items-center gap-2 font-display text-xl font-medium text-foreground">
                  {tool.title}
                  <ArrowRight className="h-4 w-4 text-on-surface-variant transition-transform duration-300 group-hover:translate-x-1" />
                </h3>
                <p className="text-on-surface-variant">{tool.blurb}</p>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}

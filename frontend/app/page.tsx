import Link from "next/link";
import { Sparkles, ScanLine, Repeat, Scaling, Volume2, FileText, ShieldCheck } from "lucide-react";

import { OnboardingChecklist } from "@/components/onboarding-checklist";
import { ToolDirectory } from "@/components/tool-directory";

export default function HomePage() {
  return (
    <div>
      {/* Hero */}
      <section className="mx-auto max-w-[1280px] px-4 pb-12 pt-12 sm:px-6 md:pb-16 md:pt-20">
        <div className="mx-auto mb-10 max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3.5 py-1 text-xs font-semibold text-primary mb-4 shadow-xs">
            <ShieldCheck className="h-3.5 w-3.5 text-primary shrink-0" />
            <span>Official LynkZone Software Suite · 100% Offline &amp; Private</span>
          </div>
          <h1 className="font-display text-[28px] font-semibold leading-tight tracking-[-0.01em] text-foreground text-balance sm:text-[36px] md:text-5xl md:leading-[56px]">
            Photos, Documents &amp; Voice Tools in One Place
          </h1>
          <p className="mt-4 font-body text-base leading-7 text-on-surface-variant sm:text-lg">
            High-speed, privacy-first processing for images, PDFs, video, and multi-language speech.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-2.5 sm:gap-3.5">
            <Link
              href="/ai-generator"
              className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 via-purple-600 to-pink-600 px-6 py-3 font-display text-[13px] font-semibold tracking-[0.02em] text-white shadow-[0_4px_16px_rgba(147,51,234,0.3)] transition-transform duration-300 hover:scale-[1.02]"
            >
              <Sparkles className="h-4 w-4 text-yellow-300 animate-pulse" />
              AI Creative Studio
            </Link>
            <Link
              href="/resize"
              className="flex items-center justify-center gap-2 rounded-xl bg-primary-container px-6 py-3 font-display text-[13px] font-semibold tracking-[0.02em] text-on-primary-container shadow-[0_4px_12px_rgba(37,99,235,0.2)] transition-transform duration-300 hover:scale-[1.02]"
            >
              <Scaling className="h-4 w-4" />
              Resize
            </Link>
            <Link
              href="/enhance"
              className="flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 font-display text-[13px] font-semibold tracking-[0.02em] text-on-primary shadow-[0_4px_12px_rgba(37,99,235,0.2)] transition-transform duration-300 hover:scale-[1.02]"
            >
              <Sparkles className="h-4 w-4" />
              Enhance
            </Link>
            <Link
              href="/pdf"
              className="flex items-center justify-center gap-2 rounded-xl border border-outline-variant px-6 py-3 font-display text-[13px] font-semibold tracking-[0.02em] text-foreground transition-colors hover:bg-surface-container-high/50"
            >
              <FileText className="h-4 w-4" />
              PDF Tools
            </Link>
            <Link
              href="/text-to-speech"
              className="flex items-center justify-center gap-2 rounded-xl border border-outline-variant px-6 py-3 font-display text-[13px] font-semibold tracking-[0.02em] text-foreground transition-colors hover:bg-surface-container-high/50"
            >
              <Volume2 className="h-4 w-4" />
              Voice Tools
            </Link>
          </div>
        </div>

        {/* Getting-started checklist for signed-in users */}
        <OnboardingChecklist />
      </section>

      {/* Interactive Tool Directory with Category Tabs & Search */}
      <ToolDirectory />
    </div>
  );
}

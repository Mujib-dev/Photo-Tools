"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Flame, Search, X } from "lucide-react";

import { TOOL_GROUPS, TOOLS, type ToolItem } from "@/lib/tools";
import { cn } from "@/lib/utils";
import { hasQueryInjection } from "@/lib/validation";

const FEATURED_TOOL_HREFS: string[] = [
  "/ai-generator",
  "/product-studio",
  "/enhance",
  "/remove-bg",
  "/video-bg-remover",
  "/parallax-animator",
  "/floorplan-stager",
  "/convert",
  "/compress",
  "/pdf",
  "/watermark-remover",
  "/text-to-speech",
  "/resize",
];

const TOP_VIRAL_HREFS = new Set([
  "/ai-generator",
  "/product-studio",
  "/enhance",
  "/remove-bg",
  "/video-bg-remover",
  "/parallax-animator",
]);

export function ToolDirectory() {
  const [activeCategory, setActiveCategory] = React.useState<string>("featured");
  const [searchQuery, setSearchQuery] = React.useState<string>("");
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  // Focus search with '/' key when not already inside an input
  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === "/" &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA"
      ) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const categories = React.useMemo(
    () => [
      { id: "featured", label: "Popular", count: FEATURED_TOOL_HREFS.length, icon: Flame },
      { id: "all", label: "All Tools", count: TOOLS.length },
      ...TOOL_GROUPS.map((g) => ({
        id: g.label.toLowerCase(),
        label: g.label,
        count: g.items.length,
        icon: g.icon,
      })),
    ],
    [],
  );

  const filteredTools = React.useMemo(() => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      return TOOLS.filter((tool) => {
        const matchesTitle = tool.title.toLowerCase().includes(q);
        const matchesLabel = tool.label.toLowerCase().includes(q);
        const matchesDesc = tool.desc.toLowerCase().includes(q);
        const matchesBlurb = tool.blurb.toLowerCase().includes(q);
        const matchesHref = tool.href.toLowerCase().includes(q);
        return matchesTitle || matchesLabel || matchesDesc || matchesBlurb || matchesHref;
      });
    }

    if (activeCategory === "featured") {
      const featuredSet = new Set(FEATURED_TOOL_HREFS);
      return TOOLS.filter((tool) => featuredSet.has(tool.href));
    }

    if (activeCategory !== "all") {
      const group = TOOL_GROUPS.find((g) => g.label.toLowerCase() === activeCategory);
      if (group) {
        return group.items;
      }
    }

    return TOOLS;
  }, [activeCategory, searchQuery]);

  return (
    <section className="mx-auto max-w-[1536px] px-4 pb-20 sm:px-6 lg:px-8">
      {/* Category Pills and Search Bar */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 sm:flex-wrap no-scrollbar">
          {categories.map((cat) => {
            const isSelected = activeCategory === cat.id && !searchQuery.trim();
            const Icon = "icon" in cat ? cat.icon : null;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  setActiveCategory(cat.id);
                  if (searchQuery) setSearchQuery("");
                }}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 font-display text-xs font-medium transition-all duration-200",
                  isSelected
                    ? "bg-primary-container text-on-primary-container shadow-sm ring-1 ring-primary/20"
                    : "border border-outline-variant/30 bg-surface-container-low text-on-surface-variant hover:border-outline-variant hover:text-foreground",
                )}
              >
                {Icon && <Icon className="h-3.5 w-3.5 shrink-0 opacity-80" />}
                <span>{cat.label}</span>
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.2 font-mono text-[10px]",
                    isSelected
                      ? "bg-on-primary-container/15 text-on-primary-container"
                      : "bg-muted text-on-surface-variant/70",
                  )}
                >
                  {cat.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search Bar */}
        <div className="relative w-full sm:w-72 md:w-80">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant/60" />
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => {
              if (hasQueryInjection(e.target.value)) return;
              setSearchQuery(e.target.value);
            }}
            placeholder="Search all 70+ tools... (press /)"
            className="h-9 w-full rounded-xl border border-outline-variant/30 bg-surface-container-low pl-9 pr-8 text-xs text-foreground placeholder:text-on-surface-variant/50 focus:border-primary/60 focus:bg-background focus:outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant/60 hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Grid of Tools */}
      {filteredTools.length > 0 ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
            {filteredTools.map((tool) => {
              const Icon = tool.icon;
              const isViral = TOP_VIRAL_HREFS.has(tool.href);
              return (
                <Link
                  key={tool.href}
                  href={tool.href}
                  className="group relative flex flex-col justify-between rounded-xl border border-outline-variant/30 bg-surface-container-low/70 p-3.5 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:bg-surface-container hover:shadow-md sm:p-4"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2.5">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary/20 sm:h-9 sm:w-9">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        {isViral && (
                          <span className="rounded-full bg-amber-500/10 px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                            Viral
                          </span>
                        )}
                        <ArrowRight className="h-3.5 w-3.5 shrink-0 text-on-surface-variant/40 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-primary" />
                      </div>
                    </div>
                    <h3 className="font-display text-sm font-semibold text-foreground truncate" title={tool.title}>
                      {tool.title}
                    </h3>
                    <p className="mt-1 text-xs leading-relaxed text-on-surface-variant line-clamp-2" title={tool.desc}>
                      {tool.desc}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Callout when viewing the Popular / Featured tools */}
          {activeCategory === "featured" && !searchQuery.trim() && (
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-3 rounded-2xl border border-outline-variant/30 bg-surface-container-high/40 px-5 py-4">
              <div className="text-center sm:text-left">
                <p className="font-display text-sm font-semibold text-foreground">
                  Looking for more specialized tools?
                </p>
                <p className="mt-0.5 text-xs text-on-surface-variant">
                  Explore all 55+ local &amp; cloud tools for batch video rotoscoping, PDF workflows, audio speech, and 3D mockups.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveCategory("all")}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-primary px-4 py-2 font-display text-xs font-semibold text-on-primary shadow-sm transition-transform hover:scale-[1.02]"
              >
                Browse All {TOOLS.length} Tools
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="rounded-2xl border border-dashed border-outline-variant/30 p-12 text-center">
          <p className="font-display text-base font-medium text-foreground">No tools found</p>
          <p className="mt-1 text-sm text-on-surface-variant">
            No tools match &ldquo;{searchQuery}&rdquo;. Try another search term or reset category filters.
          </p>
          <button
            type="button"
            onClick={() => {
              setActiveCategory("featured");
              setSearchQuery("");
            }}
            className="mt-4 rounded-xl bg-primary-container px-4 py-2 font-display text-xs font-semibold text-on-primary-container hover:scale-[1.02]"
          >
            Show popular tools
          </button>
        </div>
      )}
    </section>
  );
}

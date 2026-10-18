import type { ReactNode } from "react";

export function LegalPage({
  title,
  updated,
  intro,
  children,
}: {
  title: string;
  updated: string;
  intro: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-[820px] px-4 py-8 sm:px-6 md:py-12">
      <header className="mb-8">
        <h1 className="font-display text-3xl font-semibold leading-tight tracking-[-0.01em] text-balance sm:text-[32px] md:text-4xl">
          {title}
        </h1>
        <p className="mt-2 font-mono text-xs uppercase tracking-widest text-on-surface-variant">
          Last updated {updated}
        </p>
        <p className="mt-4 text-on-surface-variant">{intro}</p>
      </header>

      <div className="glass-panel space-y-8 rounded-[32px] p-6 sm:p-9">{children}</div>
    </div>
  );
}

export function LegalSection({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="font-display text-lg font-semibold text-foreground sm:text-xl">{heading}</h2>
      <div className="mt-2.5 space-y-3 text-sm leading-6 text-on-surface-variant">{children}</div>
    </section>
  );
}

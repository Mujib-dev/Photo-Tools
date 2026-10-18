"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, HardDrive, Loader2, Lock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth-provider";
import { TOOLS } from "@/lib/tools";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const pathname = usePathname();

  if (status === "loading") {
    return (
      <div className="mx-auto flex max-w-[1280px] flex-col items-center justify-center px-6 py-32">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="mt-4 text-sm text-on-surface-variant">Checking your session…</p>
      </div>
    );
  }

  if (status === "guest") {
    const next = encodeURIComponent(pathname);

    return (
      <div className="mx-auto max-w-[1280px] px-4 py-16 sm:px-6 md:py-24">
        <div className="glass-panel mx-auto max-w-lg overflow-hidden rounded-[32px]">
          <div className="border-b border-outline-variant/20 bg-primary-container/10 px-6 pb-5 pt-6 text-center sm:px-10">
            <span className="mx-auto mb-3.5 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15">
              <Lock className="h-5 w-5 text-primary" />
            </span>
            <p className="font-mono text-[10px] uppercase tracking-widest text-primary">Free account</p>
            <h2 className="mt-1.5 font-display text-[24px] font-semibold tracking-[-0.01em]">
              Sign in to continue
            </h2>
            <p className="mx-auto mt-1.5 max-w-sm text-sm text-on-surface-variant">
              Create a free account to resize and convert your images. Your files never leave this
              computer.
            </p>
          </div>

          <div className="px-6 py-5 sm:px-10">
            <p className="font-mono text-[10px] uppercase tracking-widest text-on-surface-variant">
              What you unlock
            </p>
            <ul className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1.5 sm:grid-cols-4">
              {TOOLS.map((tool) => {
                const Icon = tool.icon;
                return (
                  <li key={tool.href} className="flex items-center gap-1.5 text-[13px] text-foreground">
                    <Icon className="h-3.5 w-3.5 shrink-0 text-primary" />
                    <span className="truncate">{tool.label}</span>
                  </li>
                );
              })}
            </ul>

            <Button asChild className="mt-5 w-full rounded-xl py-3">
              <Link href={`/signup?next=${next}`}>
                Create Account
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>

            <p className="mt-3.5 text-center text-sm text-on-surface-variant">
              Already have an account?{" "}
              <Link href={`/login?next=${next}`} className="font-semibold text-primary hover:underline">
                Log in
              </Link>
            </p>

            <p className="mt-4 flex items-center justify-center gap-2 border-t border-outline-variant/20 pt-4 font-mono text-xs text-on-surface-variant">
              <HardDrive className="h-3.5 w-3.5 shrink-0 text-primary" />
              Processed on this computer
            </p>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

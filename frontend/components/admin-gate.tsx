"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, Loader2, ShieldAlert, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth-provider";

/**
 * Restricts the admin console to administrator accounts. The backend enforces
 * this again on every request; this is only the client-side gate.
 */
export function AdminGate({ children }: { children: React.ReactNode }) {
  const { status, user } = useAuth();
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
              <ShieldCheck className="h-5 w-5 text-primary" />
            </span>
            <p className="font-mono text-[10px] uppercase tracking-widest text-primary">
              Administrators only
            </p>
            <h2 className="mt-1.5 font-display text-[24px] font-semibold tracking-[-0.01em]">
              Sign in to continue
            </h2>
            <p className="mx-auto mt-1.5 max-w-sm text-sm text-on-surface-variant">
              The admin console is restricted to administrator accounts. Sign in to verify your
              access.
            </p>
          </div>
          <div className="px-6 py-5 sm:px-10">
            <Button asChild className="w-full rounded-xl py-3">
              <Link href={`/login?next=${next}`}>
                Sign in
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (user?.role !== "admin" && user?.role !== "superadmin") {
    return (
      <div className="mx-auto max-w-[1280px] px-4 py-16 sm:px-6 md:py-24">
        <div className="glass-panel mx-auto max-w-lg overflow-hidden rounded-[32px] px-6 py-10 text-center sm:px-10">
          <span className="mx-auto mb-3.5 flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/15">
            <ShieldAlert className="h-5 w-5 text-destructive" />
          </span>
          <h2 className="font-display text-[24px] font-semibold tracking-[-0.01em]">
            Not authorized
          </h2>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-on-surface-variant">
            Your account does not have administrator privileges. Ask a site administrator to grant
            you access.
          </p>
          <Button asChild variant="outline" className="mt-6 rounded-xl">
            <Link href="/">Back to home</Link>
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

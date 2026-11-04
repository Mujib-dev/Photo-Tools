"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Circle,
  Gift,
  KeyRound,
  Loader2,
  Rocket,
  Sparkles,
  X,
} from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import { listApiKeysCached } from "@/lib/apiKeys";
import { fetchCreditsCached, type CreditsState } from "@/lib/credits";
import { cn } from "@/lib/utils";

const DISMISS_KEY = "pt_onb_dismissed";
const INVITE_COPIED_KEY = "pt_onb_invite_copied";

interface Step {
  id: string;
  icon: typeof Rocket;
  title: string;
  hint: string;
  done: boolean;
  href?: string;
}

/**
 * "Getting started" checklist shown on the home page for signed-in users.
 * Progress is server-derived where it matters (credits usage, API keys) so it
 * stays correct across devices; only dismissal and "invite link copied" are
 * local. Re-fetches on focus so freshly completed work shows up.
 */
export function OnboardingChecklist() {
  const { status } = useAuth();
  const [credits, setCredits] = React.useState<CreditsState | null>(null);
  const [apiKeyCount, setApiKeyCount] = React.useState<number | null>(null);
  const [dismissed, setDismissed] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
  }, []);

  const lastLoadRef = React.useRef(0);
  const load = React.useCallback(async (force = false) => {
    if (status !== "authed") return;
    const now = Date.now();
    if (!force && now - lastLoadRef.current < 15_000) return;
    lastLoadRef.current = now;
    try {
      setCredits(await fetchCreditsCached());
    } catch {
      /* checklist simply stays partial when unavailable */
    }
    try {
      setApiKeyCount((await listApiKeysCached()).length);
    } catch {
      /* ditto */
    }
  }, [status]);

  React.useEffect(() => {
    if (status !== "authed") return;
    void load(true);
    const onFocus = () => void load(false);
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [status, load]);

  if (status !== "authed" || dismissed === null || dismissed) return null;

  const usage = credits?.usage;
  const inviteCopied =
    typeof localStorage !== "undefined" && localStorage.getItem(INVITE_COPIED_KEY) === "1";

  const steps: Step[] = [
    {
      id: "signup",
      icon: Rocket,
      title: "Create your account",
      hint: "Your files stay on this device — an account just unlocks history and credits.",
      done: true,
    },
    {
      id: "first-job",
      icon: Sparkles,
      title: "Process your first file",
      hint: "Resize, enhance, convert — pick any tool and upload something.",
      done: (usage?.jobs ?? 0) > 0,
      href: "/resize",
    },
    {
      id: "complete-job",
      icon: CheckCircle2,
      title: "Finish a task successfully",
      hint: "Wait for a job to complete and download the result.",
      done: (usage?.completed ?? 0) > 0,
    },
    {
      id: "invite",
      icon: Gift,
      title: "Invite a friend",
      hint: "Copy your invite link — you both get bonus credits when they sign up.",
      done: (credits?.referral.count ?? 0) > 0 || inviteCopied,
      href: "/profile#credits",
    },
    {
      id: "api-key",
      icon: KeyRound,
      title: "Create an API key",
      hint: "Automate your workflows by calling PicTools from scripts.",
      done: (apiKeyCount ?? 0) > 0,
      href: "/profile",
    },
  ];

  const doneCount = steps.filter((step) => step.done).length;
  const allDone = doneCount === steps.length;
  const pct = Math.round((doneCount / steps.length) * 100);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  };

  return (
    <div className="mx-auto mt-10 max-w-3xl rounded-[28px] border border-outline-variant/40 bg-surface-container-lowest/80 p-5 shadow-[0_12px_40px_rgba(0,0,0,0.06)] sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <Rocket className="h-4 w-4 text-primary" />
          </span>
          <div>
            <h2 className="font-display text-[15px] font-semibold tracking-[-0.01em]">
              {allDone ? "You're all set!" : "Getting started"}
            </h2>
            <p className="text-xs text-on-surface-variant">
              {allDone
                ? "Nice work — everything below is done. Head to your profile to manage credits and invites."
                : `${doneCount} of ${steps.length} steps done`}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss checklist"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-surface-container-high">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>

      <ol className="mt-4 space-y-1">
        {steps.map((step) => {
          const Icon = step.icon;
          const body = (
            <span className="flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors">
              <span className="mt-0.5 shrink-0">
                {step.done ? (
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                ) : credits === null ? (
                  <Loader2 className="h-4 w-4 animate-spin text-on-surface-variant/60" />
                ) : (
                  <Circle className="h-4 w-4 text-on-surface-variant/50" />
                )}
              </span>
              <span className="min-w-0">
                <span
                  className={cn(
                    "block text-[13px] font-semibold leading-tight",
                    step.done ? "text-on-surface-variant line-through" : "text-foreground",
                  )}
                >
                  {step.title}
                </span>
                {!step.done && (
                  <span className="mt-0.5 block text-xs leading-4 text-on-surface-variant">{step.hint}</span>
                )}
              </span>
              {!step.done && step.href && <ArrowRight className="ml-auto mt-1 h-3.5 w-3.5 shrink-0 text-on-surface-variant/50" />}
            </span>
          );
          return (
            <li key={step.id}>
              {!step.done && step.href ? (
                <Link href={step.href} className="block rounded-xl hover:bg-surface-container-high/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  {body}
                </Link>
              ) : (
                body
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

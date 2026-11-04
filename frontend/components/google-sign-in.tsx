"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Copy, Check, ExternalLink, KeyRound, X } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";

/**
 * Renders Google's official "Continue with Google" button via Google Identity Services.
 * When NEXT_PUBLIC_GOOGLE_CLIENT_ID is configured, handles live authentication.
 * When not yet configured, provides an interactive Google API setup guide modal.
 */

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (options: {
            client_id: string;
            callback: (response: { credential?: string }) => void;
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
          }) => void;
          renderButton: (element: HTMLElement, options: Record<string, unknown>) => void;
          prompt?: () => void;
        };
      };
    };
  }
}

const SCRIPT_ID = "google-gsi-client";
let scriptPromise: Promise<void> | null = null;

function loadGsi(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.google?.accounts?.id) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    const script = existing ?? document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Could not load Google sign-in."));
    if (!existing) document.head.appendChild(script);
  });
  return scriptPromise;
}

export function GoogleSignIn({
  next = "/",
  onError,
}: {
  next?: string;
  onError?: (message: string) => void;
}) {
  const { loginWithGoogle } = useAuth();
  const router = useRouter();
  const [clientId, setClientId] = React.useState<string | null>(
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || null
  );
  const [showConfigModal, setShowConfigModal] = React.useState(false);
  const [manualIdInput, setManualIdInput] = React.useState("");
  const [copiedEnv, setCopiedEnv] = React.useState(false);
  const buttonRef = React.useRef<HTMLDivElement>(null);

  // Initialize GIS when a clientId is available
  React.useEffect(() => {
    if (!clientId) return;
    const id = clientId;
    let cancelled = false;
    const target = buttonRef.current;

    loadGsi()
      .then(() => {
        if (cancelled || !target || !window.google?.accounts?.id) return;
        window.google.accounts.id.initialize({
          client_id: id,
          cancel_on_tap_outside: true,
          callback: (response) => {
            const credential = response.credential;
            if (!credential) return;
            void (async () => {
              try {
                await loginWithGoogle(credential);
                router.push(next);
                router.refresh();
              } catch (err) {
                onError?.(err instanceof Error ? err.message : "Google sign-in failed.");
              }
            })();
          },
        });
        target.innerHTML = "";
        window.google.accounts.id.renderButton(target, {
          theme: "outline",
          size: "large",
          shape: "pill",
          text: "continue_with",
          logo_alignment: "center",
          width: 340,
        });
      })
      .catch((err) => {
        if (!cancelled) onError?.(err instanceof Error ? err.message : "Could not load Google sign-in.");
      });

    return () => {
      cancelled = true;
    };
  }, [clientId, loginWithGoogle, next, onError, router]);

  const handleButtonClick = () => {
    if (!clientId) {
      setShowConfigModal(true);
    } else if (window.google?.accounts?.id?.prompt) {
      window.google.accounts.id.prompt();
    }
  };

  const copyEnvSnippet = () => {
    navigator.clipboard.writeText("NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com\nGOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com");
    setCopiedEnv(true);
    toast.success("Environment variable snippet copied to clipboard!");
    setTimeout(() => setCopiedEnv(false), 2500);
  };

  const applyCustomClientId = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = manualIdInput.trim();
    if (!trimmed.includes(".apps.googleusercontent.com")) {
      toast.error("Invalid Google Client ID format. It usually ends with .apps.googleusercontent.com");
      return;
    }
    setClientId(trimmed);
    setShowConfigModal(false);
    toast.success("Google Client ID applied for this session!");
  };

  return (
    <>
      <div className="my-5 flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.14em] text-on-surface-variant">
        <span className="h-px flex-1 bg-outline-variant/40" />
        or continue with
        <span className="h-px flex-1 bg-outline-variant/40" />
      </div>

      <div className="flex flex-col items-center justify-center">
        {/* Render container for official Google Identity Services iframe */}
        <div ref={buttonRef} className={clientId ? "flex justify-center" : "hidden"} />

        {/* Fallback branded Google Button when GIS is initializing or client ID needs setup */}
        {(!clientId || !buttonRef.current?.hasChildNodes()) && (
          <button
            type="button"
            onClick={handleButtonClick}
            className="flex h-11 w-full max-w-[340px] items-center justify-center gap-3 rounded-full border border-outline-variant/40 bg-surface-container-high/40 px-5 text-sm font-semibold text-foreground shadow-xs transition-all hover:border-outline-variant/80 hover:bg-surface-container-high active:scale-[0.99] cursor-pointer"
          >
            <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>Continue with Google</span>
          </button>
        )}
      </div>

      {/* Google API Setup Modal */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in-50">
          <div className="relative w-full max-w-lg rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-6 shadow-2xl">
            <button
              type="button"
              onClick={() => setShowConfigModal(false)}
              className="absolute right-4 top-4 rounded-lg p-1 text-on-surface-variant hover:bg-muted hover:text-foreground cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <KeyRound className="h-5 w-5 text-primary" />
              </span>
              <div>
                <h3 className="font-display text-lg font-bold text-foreground">
                  Google API Sign-In Setup
                </h3>
                <p className="text-xs text-on-surface-variant">
                  Configure Google Cloud OAuth 2.0 Credentials
                </p>
              </div>
            </div>

            <div className="space-y-4 text-xs text-on-surface-variant">
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 leading-relaxed">
                <p className="font-medium text-foreground">
                  To enable live Google Sign-In, PicTools needs a Google OAuth Client ID:
                </p>
                <ol className="mt-2 list-decimal space-y-1.5 pl-4 text-xs">
                  <li>
                    Visit the{" "}
                    <a
                      href="https://console.cloud.google.com/apis/credentials"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 font-semibold text-primary underline"
                    >
                      Google Cloud Credentials Console <ExternalLink className="h-3 w-3" />
                    </a>
                  </li>
                  <li>
                    Create an <strong>OAuth 2.0 Client ID</strong> (Application type: <em>Web application</em>).
                  </li>
                  <li>
                    Add Authorized JavaScript origin: <code className="rounded bg-muted px-1 py-0.5 font-mono text-foreground">http://localhost:3000</code>
                  </li>
                  <li>
                    Paste the Client ID into <code className="font-mono text-foreground">frontend/.env.local</code> and <code className="font-mono text-foreground">backend/.env</code>.
                  </li>
                </ol>
              </div>

              {/* Copy snippet button */}
              <div className="flex items-center justify-between gap-2 rounded-xl border border-outline-variant/20 bg-surface-container-high/40 p-3">
                <div className="font-mono text-[11px] text-foreground truncate">
                  NEXT_PUBLIC_GOOGLE_CLIENT_ID=...
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={copyEnvSnippet}
                  className="shrink-0 gap-1.5 h-8 text-xs cursor-pointer"
                >
                  {copiedEnv ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
                  {copiedEnv ? "Copied" : "Copy Env Template"}
                </Button>
              </div>

              {/* Direct test input */}
              <form onSubmit={applyCustomClientId} className="space-y-2 pt-2 border-t border-outline-variant/20">
                <label className="block font-medium text-foreground">
                  Or test directly by pasting your Google Client ID here:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={manualIdInput}
                    onChange={(e) => setManualIdInput(e.target.value)}
                    placeholder="xxxxxxxxxxxx.apps.googleusercontent.com"
                    className="flex-1 rounded-xl border border-outline-variant/30 bg-background px-3 py-2 font-mono text-xs text-foreground focus:border-primary focus:outline-none"
                  />
                  <Button type="submit" size="sm" className="rounded-xl px-4 text-xs cursor-pointer">
                    Apply
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

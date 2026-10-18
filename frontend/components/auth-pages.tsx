"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Loader2, LogIn, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/components/auth-provider";
import { cn } from "@/lib/utils";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const DEFAULT_EMAIL = "demo@pic.tools";
const DEFAULT_PASSWORD = "password123";

function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-hero-grid relative flex min-h-[calc(100vh-11rem)] flex-col items-center justify-center px-4 py-12 sm:px-6 sm:py-16">
      <div className="pointer-events-none absolute -top-32 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-primary-container/20 blur-[120px]" />
      <div className="relative w-full max-w-md">
        <div className="glass-panel rounded-[32px] p-6 shadow-[0_24px_64px_rgba(0,0,0,0.08)] sm:p-10">
          {children}
        </div>
        <p className="mt-6 text-center font-mono text-xs text-on-surface-variant">
          Your files never leave this computer.
        </p>
      </div>
    </div>
  );
}

function Brand() {
  return (
    <div className="mb-8 flex flex-col items-center text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/pictools-logo.png"
        alt="PicTools logo"
        className="mb-3 h-14 w-auto object-contain"
      />
      <span className="font-display text-2xl font-bold tracking-tighter text-primary dark:text-primary">
        PicTools
      </span>
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block font-display text-[13px] font-semibold tracking-[0.02em]">
        {label}
      </span>
      {children}
      {error && <span className="mt-1 block text-xs text-destructive">{error}</span>}
    </label>
  );
}

const inputClass =
  "h-11 rounded-xl border-outline-variant/50 bg-surface-container-high/50 px-4 text-sm focus-visible:ring-primary-container/40";

function PasswordInput({
  value,
  onChange,
  id,
  placeholder,
  autoComplete,
}: {
  value: string;
  onChange: (v: string) => void;
  id: string;
  placeholder: string;
  autoComplete: string;
}) {
  const [show, setShow] = React.useState(false);
  return (
    <div className="relative">
      <Input
        id={id}
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className={cn(inputClass, "pr-11")}
        required
        minLength={8}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? "Hide password" : "Show password"}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant transition-colors hover:text-foreground"
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

function useNextPath(): string {
  const params = useSearchParams();
  const next = params.get("next");
  if (!next || !next.startsWith("/")) return "/";
  return next;
}

function LoginForm() {
  const { login } = useAuth();
  const router = useRouter();
  const next = useNextPath();
  const [email, setEmail] = React.useState(DEFAULT_EMAIL);
  const [password, setPassword] = React.useState(DEFAULT_PASSWORD);
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!EMAIL_RE.test(email.trim())) {
      setError("Enter a valid email address.");
      return;
    }
    if (password.length < 8) {
      setError("Your password must be at least 8 characters.");
      return;
    }
    setSubmitting(true);
    try {
      await login(email.trim().toLowerCase(), password);
      toast.success("Welcome back!");
      router.push(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Brand />
      <h1 className="font-display text-[28px] font-semibold tracking-[-0.01em]">Welcome back</h1>
      <p className="mb-5 mt-1.5 text-sm text-on-surface-variant">
        Log in to resize and convert your images.
      </p>

      <div className="mb-5 rounded-lg border border-primary/20 bg-primary-container/10 px-3 py-2 text-xs text-on-surface-variant">
        Demo account: <span className="font-mono font-semibold text-primary">{DEFAULT_EMAIL}</span>{" "}
        / <span className="font-mono font-semibold text-primary">{DEFAULT_PASSWORD}</span>
      </div>

      <form onSubmit={onSubmit} className="space-y-5">
        <Field label="Email">
          <Input
            id="login-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            className={inputClass}
            required
          />
        </Field>
        <Field label="Password">
          <PasswordInput
            id="login-password"
            value={password}
            onChange={setPassword}
            placeholder="••••••••"
            autoComplete="current-password"
          />
        </Field>

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <Button type="submit" disabled={submitting} className="w-full rounded-xl py-4" size="lg">
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Logging in…
            </>
          ) : (
            <>
              <LogIn className="h-4 w-4" />
              Log In
            </>
          )}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-on-surface-variant">
        Don&apos;t have an account?{" "}
        <Link href={`/signup?next=${encodeURIComponent(next)}`} className="font-semibold text-primary hover:underline">
          Sign up
        </Link>
      </p>
    </>
  );
}

function SignupForm() {
  const { register } = useAuth();
  const router = useRouter();
  const next = useNextPath();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!EMAIL_RE.test(email.trim())) {
      setError("Enter a valid email address.");
      return;
    }
    if (password.length < 8) {
      setError("Your password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setSubmitting(true);
    try {
      await register(email.trim().toLowerCase(), password);
      toast.success("Account created — you're in!");
      router.push(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign up failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Brand />
      <h1 className="font-display text-[28px] font-semibold tracking-[-0.01em]">Create your account</h1>
      <p className="mb-7 mt-1.5 text-sm text-on-surface-variant">
        Free and instant — start processing your images right away.
      </p>

      <form onSubmit={onSubmit} className="space-y-5">
        <Field label="Email">
          <Input
            id="signup-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            className={inputClass}
            required
          />
        </Field>
        <Field label="Password" error={password && password.length < 8 ? "At least 8 characters." : undefined}>
          <PasswordInput
            id="signup-password"
            value={password}
            onChange={setPassword}
            placeholder="At least 8 characters"
            autoComplete="new-password"
          />
        </Field>
        <Field label="Confirm password">
          <PasswordInput
            id="signup-confirm"
            value={confirm}
            onChange={setConfirm}
            placeholder="Repeat your password"
            autoComplete="new-password"
          />
        </Field>

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <Button type="submit" disabled={submitting} className="w-full rounded-xl py-4" size="lg">
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Creating account…
            </>
          ) : (
            <>
              <UserPlus className="h-4 w-4" />
              Create Account
            </>
          )}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-on-surface-variant">
        Already have an account?{" "}
        <Link href={`/login?next=${encodeURIComponent(next)}`} className="font-semibold text-primary hover:underline">
          Log in
        </Link>
      </p>
    </>
  );
}

export function LoginPage() {
  return (
    <AuthShell>
      <LoginForm />
    </AuthShell>
  );
}

export function SignupPage() {
  return (
    <AuthShell>
      <SignupForm />
    </AuthShell>
  );
}

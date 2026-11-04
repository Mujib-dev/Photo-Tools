"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, Eye, EyeOff, Gift, KeyRound, Loader2, LogIn, MailQuestion, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GoogleSignIn } from "@/components/google-sign-in";
import { useAuth } from "@/components/auth-provider";
import {
  recoverPassword,
  remindLoginEmail,
  resetPassword,
  verifyRecoveryCode,
  type RecoveryChannel,
} from "@/lib/auth";
import {
  validateEmail,
  validatePassword,
  validateFullName,
  validatePhone,
  hasQueryInjection,
} from "@/lib/validation";
import { cn } from "@/lib/utils";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FULL_NAME_RE = /^[\p{L}\p{M}][\p{L}\p{M}' .-]*$/u;
const PHONE_RE = /^\+?\d{7,15}$/;
const normalizePhone = (value: string) => value.trim().replace(/[\s().-]/g, "");

function AuthShell({ children, compact }: { children: React.ReactNode; compact?: boolean }) {
  return (
    <div
      className={cn(
        "bg-hero-grid relative flex flex-col items-center justify-center px-4",
        compact ? "min-h-[calc(100vh-10rem)] py-4 sm:py-6" : "min-h-[calc(100vh-11rem)] py-8 sm:py-12",
      )}
    >
      <div className="pointer-events-none absolute -top-32 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-primary-container/20 blur-[120px]" />
      <div className={cn("relative w-full", compact ? "max-w-lg" : "max-w-md")}>
        <div
          className={cn(
            "glass-panel rounded-[28px] shadow-[0_20px_50px_rgba(0,0,0,0.06)]",
            compact ? "p-5 sm:p-6" : "p-6 sm:p-10",
          )}
        >
          {children}
        </div>
        <p className="mt-3 text-center font-mono text-[11px] text-on-surface-variant">
          Your files never leave this computer.
        </p>
      </div>
    </div>
  );
}

function Brand({ compact }: { compact?: boolean }) {
  if (compact) {
    return (
      <div className="mb-3 flex items-center justify-center gap-2 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/pictools-logo.png"
          alt="PicTools logo"
          className="h-7 w-auto object-contain"
        />
        <span className="font-display text-xl font-bold tracking-tight text-primary dark:text-primary">
          PicTools
        </span>
      </div>
    );
  }
  return (
    <div className="mb-6 flex flex-col items-center text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/pictools-logo.png"
        alt="PicTools logo"
        className="mb-2 h-10 w-auto object-contain"
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
  className,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1 block font-display text-xs font-semibold tracking-[0.01em]">
        {label}
      </span>
      {children}
      {error && <span className="mt-1 block text-xs text-destructive">{error}</span>}
    </label>
  );
}

const inputClass =
  "h-9.5 rounded-xl border-outline-variant/50 bg-surface-container-high/50 px-3.5 text-xs sm:text-sm focus-visible:ring-primary-container/40";

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
        className={cn(inputClass, "pr-12")}
        required
        minLength={8}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? "Hide password" : "Show password"}
        className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const emailVal = validateEmail(email);
    if (!emailVal.isValid) {
      setError(emailVal.error || "Enter a valid email address.");
      return;
    }
    if (hasQueryInjection(password)) {
      setError("Password contains invalid query characters.");
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

        <div className="-mt-2 text-right">
          <Link
            href="/forgot-password"
            className="text-xs font-semibold text-primary hover:underline"
          >
            Forgot password?
          </Link>
        </div>

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

      <GoogleSignIn next={next} onError={setError} />

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
  const params = useSearchParams();
  // Invite code from a friend's referral link (?ref=CODE). Unknown codes are
  // ignored server-side, so a stale link never blocks sign-up.
  const referralCode = (params.get("ref") ?? "").trim().slice(0, 32) || null;
  const [fullName, setFullName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [accepted, setAccepted] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const name = fullName.trim().replace(/\s+/g, " ");
    const nameVal = validateFullName(name);
    if (!nameVal.isValid) {
      setError(nameVal.error || "Enter a valid full name.");
      return;
    }
    const emailVal = validateEmail(email);
    if (!emailVal.isValid) {
      setError(emailVal.error || "Enter a valid email address.");
      return;
    }
    const phoneVal = validatePhone(phone);
    if (!phoneVal.isValid) {
      setError(phoneVal.error || "Enter a valid phone number (7–15 digits, optional +).");
      return;
    }
    const cleanedPhone = normalizePhone(phone);
    const pwVal = validatePassword(password, email);
    if (!pwVal.isValid) {
      setError(pwVal.error || "Your password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (!accepted) {
      setError("Please accept the Terms of Service and Privacy Policy to continue.");
      return;
    }
    setSubmitting(true);
    try {
      await register(email.trim().toLowerCase(), password, name, cleanedPhone, accepted, referralCode);
      toast.success("Account created — you're in!");
      router.push(next);
      router.refresh();
    } catch (err) {
      const rawMsg = err instanceof Error ? err.message : "Sign up failed.";
      if (
        rawMsg.toLowerCase().includes("already") ||
        rawMsg.toLowerCase().includes("email_exists") ||
        rawMsg.toLowerCase().includes("in use") ||
        (err as { status?: number })?.status === 409
      ) {
        setError("This email address is already registered. Please sign in instead, or reset your password if you forgot it.");
      } else {
        setError(rawMsg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Brand compact />
      <div className="mb-3 text-center">
        <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight">Create your account</h1>
        <p className="mt-0.5 text-xs text-on-surface-variant">
          Free and instant — start processing in seconds.
        </p>
      </div>

      {referralCode && (
        <div className="mb-3 flex items-start gap-2 rounded-xl border border-primary/30 bg-primary-container/15 px-3 py-1.5 text-xs leading-snug">
          <Gift className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
          <span className="text-on-surface">
            A friend invited you — get <strong className="text-primary">50 bonus credits</strong> when you join.
          </span>
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-2.5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <Field label="Full name">
            <Input
              id="signup-name"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your full name"
              autoComplete="name"
              className={inputClass}
              required
              minLength={2}
              maxLength={100}
            />
          </Field>
          <Field label="Phone number">
            <Input
              id="signup-phone"
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 555 123 4567"
              autoComplete="tel"
              className={inputClass}
              required
            />
          </Field>
        </div>

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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <Field label="Password" error={password && password.length < 8 ? "At least 8 chars." : undefined}>
            <PasswordInput
              id="signup-password"
              value={password}
              onChange={setPassword}
              placeholder="At least 8 chars"
              autoComplete="new-password"
            />
          </Field>
          <Field label="Confirm password">
            <PasswordInput
              id="signup-confirm"
              value={confirm}
              onChange={setConfirm}
              placeholder="Repeat password"
              autoComplete="new-password"
            />
          </Field>
        </div>

        <label className="flex items-start gap-2 text-xs leading-tight text-on-surface-variant pt-0.5">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
            className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-outline-variant/60 accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <span>
            I agree to the{" "}
            <Link
              href="/terms"
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-primary hover:underline"
            >
              Terms
            </Link>{" "}
            and{" "}
            <Link
              href="/privacy"
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-primary hover:underline"
            >
              Privacy Policy
            </Link>
            .
          </span>
        </label>

        {error && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive space-y-2">
            <div className="flex items-start gap-2">
              <span className="font-medium">{error}</span>
            </div>
            {(error.toLowerCase().includes("already registered") ||
              error.toLowerCase().includes("already exists") ||
              error.toLowerCase().includes("already in use")) && (
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-destructive/20 text-xs">
                <span className="text-on-surface-variant">Already have an account?</span>
                <Link
                  href={`/login?email=${encodeURIComponent(email)}`}
                  className="font-bold underline text-primary hover:text-primary/80"
                >
                  Sign in now →
                </Link>
                <span className="text-on-surface-variant">or</span>
                <Link
                  href={`/forgot-password?email=${encodeURIComponent(email)}`}
                  className="font-medium underline hover:text-primary"
                >
                  Reset password
                </Link>
              </div>
            )}
          </div>
        )}

        <Button type="submit" disabled={submitting} className="w-full rounded-xl h-10 text-xs sm:text-sm font-semibold" size="default">
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

      <div className="mt-2.5">
        <GoogleSignIn next={next} onError={setError} />
      </div>

      <p className="mt-3 text-center text-xs text-on-surface-variant">
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
    <AuthShell compact>
      <SignupForm />
    </AuthShell>
  );
}

const CHANNELS: { value: RecoveryChannel; label: string }[] = [
  { value: "email", label: "Email link" },
  { value: "sms", label: "Text (SMS)" },
  { value: "whatsapp", label: "WhatsApp" },
];

function ChannelPicker({
  value,
  onChange,
}: {
  value: RecoveryChannel;
  onChange: (channel: RecoveryChannel) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-1 rounded-xl border border-outline-variant/40 bg-surface-container-high/40 p-1">
      {CHANNELS.map((channel) => (
        <button
          key={channel.value}
          type="button"
          onClick={() => onChange(channel.value)}
          className={cn(
            "rounded-lg px-2 py-2 text-xs font-semibold transition-colors",
            value === channel.value
              ? "bg-primary text-on-primary shadow-sm"
              : "text-on-surface-variant hover:text-foreground",
          )}
        >
          {channel.label}
        </button>
      ))}
    </div>
  );
}

function ForgotPasswordForm() {
  const router = useRouter();
  const [step, setStep] = React.useState<"request" | "sent" | "code" | "reset" | "done">("request");
  const [identifier, setIdentifier] = React.useState("");
  const [channel, setChannel] = React.useState<RecoveryChannel>("email");
  const [destination, setDestination] = React.useState<string | null>(null);
  const [code, setCode] = React.useState("");
  const [resetToken, setResetToken] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const goRequest = () => {
    setStep("request");
    setCode("");
    setResetToken("");
    setPassword("");
    setConfirm("");
    setError(null);
  };

  const onRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const cleanId = identifier.trim();
    if (!cleanId) {
      setError("Enter your email or phone number.");
      return;
    }
    if (hasQueryInjection(cleanId)) {
      setError("Identifier contains invalid query characters.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await recoverPassword(cleanId, channel);
      setDestination(result.destination);
      setStep(result.channel === "email" ? "sent" : "code");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start the reset.");
    } finally {
      setSubmitting(false);
    }
  };

  const onVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!/^\d{4,8}$/.test(code.trim())) {
      setError("Enter the code we sent you.");
      return;
    }
    setSubmitting(true);
    try {
      const token = await verifyRecoveryCode(code.trim());
      setResetToken(token);
      setStep("reset");
    } catch (err) {
      setError(err instanceof Error ? err.message : "That code is not valid.");
    } finally {
      setSubmitting(false);
    }
  };

  const onReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const pwVal = validatePassword(password);
    if (!pwVal.isValid) {
      setError(pwVal.error || "Your password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setSubmitting(true);
    try {
      await resetPassword(resetToken, password);
      setStep("done");
      toast.success("Your password has been reset.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reset your password.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Brand />
      <h1 className="font-display text-[28px] font-semibold tracking-[-0.01em]">Reset your password</h1>
      <p className="mb-7 mt-1.5 text-sm text-on-surface-variant">
        We&apos;ll help you back into your account.
      </p>

      {step === "request" && (
        <form onSubmit={onRequest} className="space-y-5">
          <Field label="Email or phone number">
            <Input
              id="recover-identifier"
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="you@example.com or +1 555 123 4567"
              autoComplete="username"
              className={inputClass}
              required
            />
          </Field>
          <Field label="How should we send your reset?">
            <ChannelPicker value={channel} onChange={setChannel} />
          </Field>
          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}
          <Button type="submit" disabled={submitting} className="w-full rounded-xl py-4" size="lg">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
            Send reset
          </Button>
        </form>
      )}

      {step === "sent" && (
        <div className="space-y-5">
          <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary-container/10 px-4 py-3 text-sm text-on-surface-variant">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <span>
              If an account matches{destination ? ` ${destination}` : ""}, we&apos;ve sent a link to reset
              your password. Check your inbox and spam folder.
            </span>
          </div>
          <Button type="button" variant="outline" className="w-full rounded-xl py-4" size="lg" onClick={goRequest}>
            Use a different method
          </Button>
        </div>
      )}

      {step === "code" && (
        <form onSubmit={onVerify} className="space-y-5">
          <div className="rounded-xl border border-primary/20 bg-primary-container/10 px-4 py-3 text-sm text-on-surface-variant">
            We sent a {channel === "whatsapp" ? "WhatsApp" : "text"} message
            {destination ? ` to ${destination}` : ""} with a 6-digit code.
          </div>
          <Field label="Reset code">
            <Input
              id="recover-code"
              type="text"
              inputMode="numeric"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 8))}
              placeholder="123456"
              autoComplete="one-time-code"
              className={cn(inputClass, "text-center font-mono text-lg tracking-[0.4em]")}
              required
            />
          </Field>
          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}
          <Button type="submit" disabled={submitting} className="w-full rounded-xl py-4" size="lg">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
            Verify code
          </Button>
          <button
            type="button"
            onClick={goRequest}
            className="mx-auto block text-xs font-semibold text-primary hover:underline"
          >
            Use a different method
          </button>
        </form>
      )}

      {step === "reset" && (
        <form onSubmit={onReset} className="space-y-5">
          <Field label="New password" error={password && password.length < 8 ? "At least 8 characters." : undefined}>
            <PasswordInput
              id="recover-password"
              value={password}
              onChange={setPassword}
              placeholder="At least 8 characters"
              autoComplete="new-password"
            />
          </Field>
          <Field label="Confirm new password">
            <PasswordInput
              id="recover-confirm"
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
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
            Set new password
          </Button>
        </form>
      )}

      {step === "done" && (
        <div className="space-y-5">
          <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary-container/10 px-4 py-3 text-sm text-on-surface-variant">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <span>Your password has been changed. You can now log in with it.</span>
          </div>
          <Button
            type="button"
            className="w-full rounded-xl py-4"
            size="lg"
            onClick={() => router.push("/login")}
          >
            <LogIn className="h-4 w-4" />
            Go to log in
          </Button>
        </div>
      )}

      <p className="mt-6 text-center text-sm text-on-surface-variant">
        Forgot which email you used?{" "}
        <Link href="/forgot-email" className="font-semibold text-primary hover:underline">
          Recover your login email
        </Link>
      </p>
    </>
  );
}

function ResetPasswordForm() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token") ?? "";
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [done, setDone] = React.useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
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
      await resetPassword(token, password);
      setDone(true);
      toast.success("Your password has been reset.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reset your password.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Brand />
      <h1 className="font-display text-[28px] font-semibold tracking-[-0.01em]">Choose a new password</h1>

      {!token && (
        <div className="mt-5 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          This reset link is incomplete. Request a new one from the{" "}
          <Link href="/forgot-password" className="font-semibold underline">
            forgot password
          </Link>{" "}
          page.
        </div>
      )}

      {token && done && (
        <div className="mt-5 space-y-5">
          <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary-container/10 px-4 py-3 text-sm text-on-surface-variant">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <span>Your password has been changed. You can now log in with it.</span>
          </div>
          <Button type="button" className="w-full rounded-xl py-4" size="lg" onClick={() => router.push("/login")}>
            <LogIn className="h-4 w-4" />
            Go to log in
          </Button>
        </div>
      )}

      {token && !done && (
        <form onSubmit={onSubmit} className="mt-5 space-y-5">
          <Field label="New password" error={password && password.length < 8 ? "At least 8 characters." : undefined}>
            <PasswordInput
              id="reset-password"
              value={password}
              onChange={setPassword}
              placeholder="At least 8 characters"
              autoComplete="new-password"
            />
          </Field>
          <Field label="Confirm new password">
            <PasswordInput
              id="reset-confirm"
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
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
            Set new password
          </Button>
        </form>
      )}
    </>
  );
}

function ForgotEmailForm() {
  const [phone, setPhone] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [done, setDone] = React.useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const cleaned = normalizePhone(phone);
    if (!PHONE_RE.test(cleaned)) {
      setError("Enter the phone number you registered with (7–15 digits).");
      return;
    }
    setSubmitting(true);
    try {
      await remindLoginEmail(cleaned);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not look that up.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Brand />
      <h1 className="font-display text-[28px] font-semibold tracking-[-0.01em]">Recover your login email</h1>
      <p className="mb-7 mt-1.5 text-sm text-on-surface-variant">
        Enter the phone number you registered with and we&apos;ll email you the address on file.
      </p>

      {done ? (
        <div className="space-y-5">
          <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary-container/10 px-4 py-3 text-sm text-on-surface-variant">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <span>If an account uses that number, we&apos;ve emailed the login address to it.</span>
          </div>
          <Button
            type="button"
            className="w-full rounded-xl py-4"
            size="lg"
            onClick={() => {
              setDone(false);
              setPhone("");
            }}
          >
            Try another number
          </Button>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-5">
          <Field label="Phone number">
            <Input
              id="forgot-email-phone"
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 555 123 4567"
              autoComplete="tel"
              className={inputClass}
              required
            />
          </Field>
          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}
          <Button type="submit" disabled={submitting} className="w-full rounded-xl py-4" size="lg">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <MailQuestion className="h-4 w-4" />}
            Email me my address
          </Button>
        </form>
      )}

      <p className="mt-6 text-center text-sm text-on-surface-variant">
        Remembered it after all?{" "}
        <Link href="/login" className="font-semibold text-primary hover:underline">
          Back to log in
        </Link>
      </p>
    </>
  );
}

export function ForgotPasswordPage() {
  return (
    <AuthShell>
      <ForgotPasswordForm />
    </AuthShell>
  );
}

export function ResetPasswordPage() {
  return (
    <AuthShell>
      <ResetPasswordForm />
    </AuthShell>
  );
}

export function ForgotEmailPage() {
  return (
    <AuthShell>
      <ForgotEmailForm />
    </AuthShell>
  );
}

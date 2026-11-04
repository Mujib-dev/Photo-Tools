"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Cable,
  Camera,
  Coins,
  Download,
  Eye,
  EyeOff,
  FileJson,
  KeyRound,
  Loader2,
  Mail,
  Phone,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

import { ApiKeysSection } from "@/components/api-keys";
import { CreditsSection } from "@/components/credits-section";
import { UsageDashboard } from "@/components/usage-dashboard";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AuthUser } from "@/lib/types";
import { cn } from "@/lib/utils";
import { validateEmail, validatePassword, hasQueryInjection } from "@/lib/validation";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const AVATAR_SIZE = 256;
const AVATAR_SOURCE_MAX_BYTES = 10 * 1024 * 1024;

function fileToAvatar(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new window.Image();
    image.onload = () => {
      try {
        const side = Math.min(image.naturalWidth, image.naturalHeight);
        if (!side) throw new Error("That image is empty.");
        const canvas = document.createElement("canvas");
        canvas.width = AVATAR_SIZE;
        canvas.height = AVATAR_SIZE;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Your browser cannot process images.");
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, AVATAR_SIZE, AVATAR_SIZE);
        context.drawImage(
          image,
          (image.naturalWidth - side) / 2,
          (image.naturalHeight - side) / 2,
          side,
          side,
          0,
          0,
          AVATAR_SIZE,
          AVATAR_SIZE,
        );
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      } catch (err) {
        reject(err);
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("That image could not be loaded."));
    };
    image.src = objectUrl;
  });
}

const inputClass =
  "h-10 rounded-xl border-outline-variant/40 bg-surface-container-high/40 px-3.5 text-xs sm:text-sm focus-visible:ring-primary-container/40";

function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block font-display text-xs font-semibold tracking-[0.01em]">
        {label}
      </span>
      {children}
      {hint && !error && <span className="mt-1 block text-[11px] text-on-surface-variant">{hint}</span>}
      {error && <span className="mt-1 block text-[11px] text-destructive">{error}</span>}
    </label>
  );
}

function PasswordInput({
  value,
  onChange,
  id,
  placeholder,
  autoComplete,
}: {
  value: string;
  onChange: (value: string) => void;
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
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className={cn(inputClass, "pr-11")}
        required
      />
      <button
        type="button"
        onClick={() => setShow((current) => !current)}
        aria-label={show ? "Hide password" : "Show password"}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant transition-colors hover:text-foreground"
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

function ErrorNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
      {children}
    </div>
  );
}

function SectionHeading({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Mail | typeof KeyRound | typeof Coins | typeof Cable | typeof FileJson;
  title: string;
  description: string;
}) {
  return (
    <div className="mb-4 flex items-start gap-2.5">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10">
        <Icon className="h-4 w-4 text-primary" />
      </span>
      <div>
        <h2 className="font-display text-[15px] font-semibold tracking-[-0.01em] text-foreground">{title}</h2>
        <p className="mt-0.5 text-xs text-on-surface-variant leading-relaxed">{description}</p>
      </div>
    </div>
  );
}

function EmailForm({ user }: { user: AuthUser }) {
  const { updateProfile } = useAuth();
  const [email, setEmail] = React.useState(user.email);
  const [currentPassword, setCurrentPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    const nextEmail = email.trim().toLowerCase();
    if (hasQueryInjection(nextEmail)) {
      setError("Email address contains prohibited query characters or injection sequences.");
      return;
    }
    const emailResult = validateEmail(nextEmail);
    if (!emailResult.isValid) {
      setError(emailResult.error || "Enter a valid email address.");
      return;
    }
    if (!currentPassword) {
      setError("Enter your current password.");
      return;
    }
    if (hasQueryInjection(currentPassword)) {
      setError("Password contains prohibited injection sequences.");
      return;
    }
    if (nextEmail === user.email) {
      toast.info("Your email is already up to date.");
      return;
    }
    setSubmitting(true);
    try {
      await updateProfile({ email: nextEmail, currentPassword });
      setCurrentPassword("");
      toast.success("Email updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update your email.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field label="Email address" hint="You will use this email to sign in.">
        <Input
          id="profile-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          preventQueryInjection
          autoComplete="email"
          className={inputClass}
          required
        />
      </Field>
      <Field label="Current password" hint="Required to confirm the change.">
        <PasswordInput
          id="profile-email-password"
          value={currentPassword}
          onChange={setCurrentPassword}
          placeholder="Your current password"
          autoComplete="current-password"
        />
      </Field>
      {error && <ErrorNote>{error}</ErrorNote>}
      <div className="flex justify-end">
        <Button type="submit" disabled={submitting} className="rounded-xl">
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : (
            "Save email"
          )}
        </Button>
      </div>
    </form>
  );
}

function PasswordForm() {
  const { updateProfile } = useAuth();
  const [currentPassword, setCurrentPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!currentPassword) {
      setError("Enter your current password.");
      return;
    }
    if (hasQueryInjection(currentPassword) || hasQueryInjection(newPassword) || hasQueryInjection(confirm)) {
      setError("Input contains prohibited characters or injection sequences.");
      return;
    }
    const passwordResult = validatePassword(newPassword);
    if (!passwordResult.isValid) {
      setError(passwordResult.error || "Password does not meet complexity requirements.");
      return;
    }
    if (newPassword !== confirm) {
      setError("New passwords do not match.");
      return;
    }
    setSubmitting(true);
    try {
      await updateProfile({ currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirm("");
      toast.success("Password updated. Other devices have been signed out.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update your password.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field label="Current password">
        <PasswordInput
          id="profile-current-password"
          value={currentPassword}
          onChange={setCurrentPassword}
          placeholder="Your current password"
          autoComplete="current-password"
        />
      </Field>
      <Field label="New password" hint="At least 8 characters.">
        <PasswordInput
          id="profile-new-password"
          value={newPassword}
          onChange={setNewPassword}
          placeholder="Choose a new password"
          autoComplete="new-password"
        />
      </Field>
      <Field label="Confirm new password">
        <PasswordInput
          id="profile-confirm-password"
          value={confirm}
          onChange={setConfirm}
          placeholder="Repeat the new password"
          autoComplete="new-password"
        />
      </Field>
      {error && <ErrorNote>{error}</ErrorNote>}
      <div className="flex justify-end">
        <Button type="submit" disabled={submitting} className="rounded-xl">
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Updating…
            </>
          ) : (
            "Update password"
          )}
        </Button>
      </div>
    </form>
  );
}

function AccountExportCard({ user }: { user: AuthUser }) {
  const [downloading, setDownloading] = React.useState(false);

  const exportData = () => {
    setDownloading(true);
    try {
      const payload = {
        exportVersion: "1.0",
        exportedAt: new Date().toISOString(),
        service: "Photo Tools & Studio",
        account: {
          id: user.id,
          email: user.email,
          fullName: user.fullName ?? null,
          phone: user.phone ?? null,
          role: user.role ?? "user",
          hasCustomAvatar: Boolean(user.avatar),
        },
        privacyPolicy: {
          dataRetention: "Temporary job files and image outputs are pruned automatically after 15 minutes.",
          rights: "Under GDPR and modern privacy standards, you have the right to access and export your account data at any time.",
        },
      };

      const jsonStr = JSON.stringify(payload, null, 2);
      const blob = new Blob([jsonStr], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const dateStr = new Date().toISOString().split("T")[0];
      link.href = url;
      link.download = `phototools-account-data-${dateStr}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success("Account data exported successfully as JSON.");
    } catch {
      toast.error("Failed to export account data. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-high/40 p-4">
        <dl className="grid grid-cols-1 gap-x-4 gap-y-2 text-xs sm:grid-cols-2">
          <div>
            <dt className="text-on-surface-variant font-medium">User Identifier</dt>
            <dd className="font-mono text-foreground font-semibold truncate">{user.id}</dd>
          </div>
          <div>
            <dt className="text-on-surface-variant font-medium">Account Role</dt>
            <dd className="font-mono text-primary font-semibold uppercase">
              {user.role === "superadmin" ? "Super admin" : (user.role ?? "user")}
            </dd>
          </div>
          <div>
            <dt className="text-on-surface-variant font-medium">Email Address</dt>
            <dd className="font-mono text-foreground truncate">{user.email}</dd>
          </div>
          <div>
            <dt className="text-on-surface-variant font-medium">Profile Name</dt>
            <dd className="text-foreground">{user.fullName || "Not specified"}</dd>
          </div>
        </dl>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <p className="text-xs text-on-surface-variant max-w-sm">
          Download your personal account profile, roles, and settings in machine-readable JSON format.
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={exportData}
          disabled={downloading}
          className="gap-2 rounded-xl"
        >
          {downloading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4 text-primary" />
          )}
          Export My Data (JSON)
        </Button>
      </div>
    </div>
  );
}

type ProfileTab = "security" | "credits" | "usage" | "api-keys" | "export";

const TABS: { id: ProfileTab; label: string; icon: typeof KeyRound }[] = [
  { id: "security", label: "Account & Security", icon: KeyRound },
  { id: "credits", label: "Credits & Plans", icon: Coins },
  { id: "usage", label: "Usage", icon: BarChart3 },
  { id: "api-keys", label: "API Keys", icon: Cable },
  { id: "export", label: "Data Export", icon: FileJson },
];

function ProfileContent({ user }: { user: AuthUser }) {
  const { updateAvatar } = useAuth();
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const [avatarBusy, setAvatarBusy] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<ProfileTab>("security");

  React.useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.toLowerCase();
      if (hash === "#credits") setActiveTab("credits");
      else if (hash === "#usage") setActiveTab("usage");
      else if (hash === "#api-keys" || hash === "#api") setActiveTab("api-keys");
      else if (hash === "#export") setActiveTab("export");
      else if (hash === "#security" || hash === "#general") setActiveTab("security");
    };

    handleHash();
    window.addEventListener("hashchange", handleHash);
    return () => window.removeEventListener("hashchange", handleHash);
  }, []);

  const pickAvatar = () => fileInputRef.current?.click();

  const onAvatarSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Choose an image file.");
      return;
    }
    if (file.size > AVATAR_SOURCE_MAX_BYTES) {
      toast.error("Choose an image smaller than 10 MB.");
      return;
    }
    setAvatarBusy(true);
    try {
      const avatar = await fileToAvatar(file);
      await updateAvatar(avatar);
      toast.success("Profile photo updated.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to update your profile photo.");
    } finally {
      setAvatarBusy(false);
    }
  };

  const removeAvatar = async () => {
    setAvatarBusy(true);
    try {
      await updateAvatar(null);
      toast.success("Profile photo removed.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to remove your profile photo.");
    } finally {
      setAvatarBusy(false);
    }
  };

  return (
    <div className="bg-hero-grid relative min-h-[calc(100vh-10rem)]">
      <div className="pointer-events-none absolute -top-32 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-primary-container/20 blur-[120px]" />
      <div className="relative mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
        {/* Compact Profile Header Card */}
        <div className="glass-panel mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl p-4 sm:p-5">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={pickAvatar}
                disabled={avatarBusy}
                aria-label="Change profile photo"
                className="group relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-outline-variant/30 bg-primary/15 font-mono text-base font-bold text-primary transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait"
              >
                {user.avatar ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={user.avatar}
                    alt="Profile photo"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  (user.fullName ?? user.email).slice(0, 2).toUpperCase()
                )}
                <span className="absolute inset-0 flex items-center justify-center bg-black/45 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                  {avatarBusy ? (
                    <Loader2 className="h-4 w-4 animate-spin text-white" />
                  ) : (
                    <Camera className="h-4 w-4 text-white" />
                  )}
                </span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={onAvatarSelected}
                className="hidden"
              />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="truncate font-display text-lg sm:text-xl font-bold tracking-tight text-foreground">
                  {user.fullName || "Your Account"}
                </h1>
                <span className="inline-flex items-center gap-1 rounded-full border border-outline-variant/40 bg-muted/60 px-2 py-0.2 font-mono text-[10px] uppercase tracking-wider text-on-surface-variant">
                  <ShieldCheck className="h-3 w-3 text-primary" />
                  {user.role === "superadmin" ? "Super admin" : user.role === "admin" ? "Admin" : "Member"}
                </span>
              </div>
              <p className="truncate text-xs text-on-surface-variant mt-0.5">{user.email}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <button
              type="button"
              onClick={pickAvatar}
              disabled={avatarBusy}
              className="rounded-lg border border-outline-variant/30 bg-surface-container-high/40 px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50"
            >
              {user.avatar ? "Change Photo" : "Upload Photo"}
            </button>
            {user.avatar && (
              <button
                type="button"
                onClick={() => void removeAvatar()}
                disabled={avatarBusy}
                className="rounded-lg px-2 py-1 text-xs text-on-surface-variant hover:text-destructive transition-colors disabled:opacity-50"
              >
                Remove
              </button>
            )}
          </div>
        </div>

        {/* Compact Segmented Tabs Navigation */}
        <div className="mb-6 flex overflow-x-auto gap-1 rounded-xl border border-outline-variant/30 bg-surface-container-low/60 p-1">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveTab(tab.id);
                  window.location.hash = `#${tab.id}`;
                }}
                className={cn(
                  "flex items-center gap-2 whitespace-nowrap rounded-lg px-3.5 py-2 font-display text-xs font-semibold transition-all duration-200",
                  isSelected
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-on-surface-variant hover:bg-surface-container-high/60 hover:text-foreground"
                )}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab 1: Account & Security (Compact Side-by-Side Grid) */}
        {activeTab === "security" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 animate-in fade-in-50 duration-200">
            <section className="glass-panel rounded-2xl p-5 sm:p-6 flex flex-col justify-between">
              <div>
                <SectionHeading
                  icon={Mail}
                  title="Email Address"
                  description="Change the primary email for your account."
                />
                <EmailForm user={user} />
              </div>
            </section>

            <section className="glass-panel rounded-2xl p-5 sm:p-6 flex flex-col justify-between">
              <div>
                <SectionHeading
                  icon={KeyRound}
                  title="Password"
                  description="Update password. Other devices will be signed out."
                />
                <PasswordForm />
              </div>
            </section>
          </div>
        )}

        {/* Tab 2: Credits & Plans */}
        {activeTab === "credits" && (
          <div className="animate-in fade-in-50 duration-200">
            <section id="credits" className="glass-panel scroll-mt-24 rounded-2xl p-5 sm:p-6">
              <SectionHeading
                icon={Coins}
                title="Credits & Plans"
                description="Your balance, subscription tier, usage, and referral links."
              />
              <div className="mt-4">
                <CreditsSection />
              </div>
            </section>
          </div>
        )}

        {/* Tab 3: Usage Dashboard */}
        {activeTab === "usage" && (
          <div className="animate-in fade-in-50 duration-200">
            <section id="usage" className="glass-panel scroll-mt-24 rounded-2xl p-5 sm:p-6">
              <SectionHeading
                icon={BarChart3}
                title="Usage Dashboard"
                description="How many credits you've used, which tools consumed them and your monthly trends."
              />
              <div className="mt-4">
                <UsageDashboard />
              </div>
            </section>
          </div>
        )}

        {/* Tab 4: API Keys */}
        {activeTab === "api-keys" && (
          <div className="animate-in fade-in-50 duration-200">
            <section className="glass-panel rounded-2xl p-5 sm:p-6">
              <SectionHeading
                icon={Cable}
                title="API Keys"
                description="Manage personal API keys for developer integrations and CLI automation."
              />
              <div className="mt-4">
                <ApiKeysSection />
              </div>
            </section>
          </div>
        )}

        {/* Tab 5: Account Data Export */}
        {activeTab === "export" && (
          <div className="animate-in fade-in-50 duration-200">
            <section className="glass-panel rounded-2xl p-5 sm:p-6">
              <SectionHeading
                icon={FileJson}
                title="Account Data Export"
                description="Export your personal profile, credentials, and settings in machine-readable JSON."
              />
              <AccountExportCard user={user} />
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

export function ProfilePage() {
  const { status, user } = useAuth();

  if (status === "loading") {
    return (
      <div className="flex min-h-[calc(100vh-11rem)] items-center justify-center px-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (status === "guest" || !user) {
    return (
      <div className="flex min-h-[calc(100vh-11rem)] items-center justify-center px-4 py-16 sm:px-6">
        <div className="glass-panel w-full max-w-md rounded-[32px] px-6 py-10 text-center sm:px-10">
          <span className="mx-auto mb-3.5 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15">
            <ShieldCheck className="h-5 w-5 text-primary" />
          </span>
          <h1 className="font-display text-[24px] font-semibold tracking-[-0.01em]">
            Sign in to view your profile
          </h1>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-on-surface-variant">
            Log in to update your email address or password.
          </p>
          <Button asChild className="mt-6 w-full rounded-xl py-3">
            <Link href="/login?next=%2Fprofile">
              Sign in
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return <ProfileContent user={user} />;
}

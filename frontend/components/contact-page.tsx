"use client";

import * as React from "react";
import {
  CheckCircle2,
  Clock,
  Mail,
  MessageCircle,
  Phone,
  Send,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { submitContact } from "@/lib/api";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[\d\s().-]{7,20}$/;

const phoneDigits = (value: string) => value.replace(/\D/g, "");

const SUBJECTS = [
  { value: "general", label: "General question" },
  { value: "resize", label: "Photo Resizer help" },
  { value: "convert", label: "Photo Converter help" },
  { value: "bug", label: "Bug report" },
  { value: "feedback", label: "Feature request" },
];

const CONTACT_METHODS = [
  {
    icon: Mail,
    label: "Email",
    value: "mujiburrahman.dev@gmail.com",
    href: "mailto:mujiburrahman.dev@gmail.com",
    note: "Replies within 1 business day.",
  },
  {
    icon: MessageCircle,
    label: "WhatsApp",
    value: "+92 348 1974606",
    href: "https://wa.me/923481974606",
    note: "Usually the fastest way to reach us.",
  },
  {
    icon: Phone,
    label: "Phone",
    value: "+92 348 1974606",
    href: "tel:+923481974606",
    note: "Mon–Fri, 9:00–18:00 local time.",
  },
];

const inputClass =
  "h-11 rounded-xl border-outline-variant/50 bg-surface-container-high/50 px-4 text-sm focus-visible:ring-primary-container/40";

const LABEL_CLASS = "mb-1.5 block font-display text-[13px] font-semibold tracking-[0.02em]";

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className={LABEL_CLASS}>
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </span>
      {children}
    </label>
  );
}

export function ContactPage() {
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [subject, setSubject] = React.useState("general");
  const [message, setMessage] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [sent, setSent] = React.useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (name.trim().length < 2) {
      setError("Please enter your name.");
      return;
    }
    if (!EMAIL_RE.test(email.trim())) {
      setError("Enter a valid email address.");
      return;
    }
    if (!PHONE_RE.test(phone.trim())) {
      setError("Enter a valid phone or WhatsApp number.");
      return;
    }
    const digits = phoneDigits(phone);
    if (digits.length < 7 || digits.length > 15) {
      setError("Enter a valid phone or WhatsApp number (7–15 digits).");
      return;
    }
    if (message.trim().length < 10) {
      setError("Please write a short message (at least 10 characters).");
      return;
    }
    setSubmitting(true);
    try {
      await submitContact({ name, email, phone, subject, message });
      setSubmitting(false);
      setSent(true);
      toast.success("Message sent!");
    } catch (err) {
      setSubmitting(false);
      const msg = err instanceof Error ? err.message : "Failed to send message. Please try again.";
      setError(msg);
      toast.error(msg);
    }
  };

  const reset = () => {
    setName("");
    setEmail("");
    setPhone("");
    setSubject("general");
    setMessage("");
    setError(null);
    setSent(false);
  };

  return (
    <div className="mx-auto max-w-[1280px] px-4 py-8 sm:px-6 md:py-10">
      <div className="mb-8 max-w-2xl">
        <h1 className="font-display text-3xl font-semibold leading-tight tracking-[-0.01em] text-balance sm:text-[32px] md:text-4xl">
          Contact Us
        </h1>
        <p className="mt-2 text-on-surface-variant">
          Questions, feedback, or a problem with a tool? We&apos;d love to hear from you.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Form */}
        <div className="lg:col-span-7">
          <div className="glass-panel rounded-[32px] p-6 sm:p-8">
            {sent ? (
              <div className="flex flex-col items-center py-10 text-center">
                <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                  <CheckCircle2 className="h-8 w-8 text-primary" />
                </span>
                <h2 className="font-display text-2xl font-semibold">Message sent!</h2>
                <p className="mt-2 max-w-sm text-sm text-on-surface-variant">
                  Thanks for reaching out{name ? `, ${name.trim().split(" ")[0]}` : ""}. We&apos;ll
                  reply to <span className="font-semibold text-primary">{email}</span> shortly.
                </p>
                <Button onClick={reset} className="mt-7 gap-2 rounded-xl px-7">
                  <Send className="h-4 w-4" />
                  Send another message
                </Button>
              </div>
            ) : (
              <>
                <h2 className="font-display text-xl font-semibold">Send us a message</h2>
                <p className="mt-1.5 text-sm text-on-surface-variant">
                  All fields marked <span className="text-destructive">*</span> are required.
                </p>

                <form onSubmit={onSubmit} className="mt-6 space-y-5">
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <Field label="Name" required>
                      <Input
                        id="contact-name"
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Jane Doe"
                        autoComplete="name"
                        className={inputClass}
                        required
                      />
                    </Field>
                    <Field label="Email" required>
                      <Input
                        id="contact-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        autoComplete="email"
                        className={inputClass}
                        required
                      />
                    </Field>
                  </div>

                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <Field label="Phone / WhatsApp" required>
                      <Input
                        id="contact-phone"
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+92 348 1974606"
                        autoComplete="tel"
                        inputMode="tel"
                        className={inputClass}
                        required
                      />
                    </Field>
                    <Field label="Subject">
                      <Select value={subject} onValueChange={setSubject}>
                        <SelectTrigger className={cn(inputClass, "bg-surface-container-high/50")}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SUBJECTS.map((s) => (
                            <SelectItem key={s.value} value={s.value}>
                              {s.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                  </div>

                  <Field label="Message" required>
                    <textarea
                      id="contact-message"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Tell us what's on your mind…"
                      rows={6}
                      className="w-full resize-none rounded-xl border border-outline-variant/50 bg-surface-container-high/50 px-4 py-3 text-sm ring-offset-background transition-all placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-container/40 focus-visible:ring-offset-2"
                      required
                      minLength={10}
                    />
                  </Field>

                  {error && (
                    <div
                      role="alert"
                      className="rounded-xl border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive"
                    >
                      {error}
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={submitting}
                    size="lg"
                    className="w-full gap-2 rounded-xl py-4 sm:w-auto sm:px-10"
                  >
                    <Send className="h-4 w-4" />
                    {submitting ? "Sending…" : "Send Message"}
                  </Button>
                </form>
              </>
            )}
          </div>
        </div>

        {/* Contact methods */}
        <div className="lg:col-span-5">
          <div className="glass-panel rounded-[32px] p-6 sm:p-7">
            <h2 className="font-display text-lg font-semibold">Other ways to reach us</h2>
            <ul className="mt-4 divide-y divide-outline-variant/20">
              {CONTACT_METHODS.map((method) => (
                <li key={method.label} className="flex items-start gap-3 py-4 first:pt-0">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <method.icon className="h-4 w-4 text-primary" />
                  </span>
                  <div className="min-w-0">
                    <p className="font-mono text-[10px] uppercase tracking-widest text-on-surface-variant">
                      {method.label}
                    </p>
                    <a
                      href={method.href}
                      className="mt-0.5 block break-words font-display text-[15px] font-semibold text-foreground transition-colors hover:text-primary"
                    >
                      {method.value}
                    </a>
                    <p className="mt-0.5 text-xs text-on-surface-variant">{method.note}</p>
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-4 flex items-center gap-2 border-t border-outline-variant/20 pt-4 font-mono text-xs text-on-surface-variant">
              <Clock className="h-3.5 w-3.5 shrink-0 text-primary" />
              Typical reply time: under 24 hours
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

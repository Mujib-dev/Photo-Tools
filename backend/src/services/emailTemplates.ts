import { config } from "../config.js";

/**
 * Branded HTML email templates with a plain-text fallback. Everything is
 * inlined (no external CSS or images) so the messages render consistently
 * across mail clients, including ones that strip <style> blocks or block
 * remote images. User-supplied values are HTML-escaped before interpolation.
 */

const BRAND = "PicTools";
const TAGLINE = "Simple tools for photos, PDFs and media";

const ACCENT = "#2563eb";
const ACCENT_DARK = "#004ac6";
const INK = "#191b23";
const MUTED = "#434655";
const BORDER = "#e1e2ed";
const CANVAS = "#f4f5fb";

export interface EmailTemplate {
  subject: string;
  text: string;
  html: string;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Collapse whitespace so untrusted text cannot inject mail headers. */
function singleLine(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

function button(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 4px;">
    <tr>
      <td align="center" bgcolor="${ACCENT}" style="border-radius:8px;">
        <a href="${escapeHtml(href)}" target="_blank" style="display:inline-block;padding:13px 28px;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">${escapeHtml(label)}</a>
      </td>
    </tr>
  </table>`;
}

function paragraph(html: string): string {
  return `<p style="margin:0 0 16px;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:24px;color:${MUTED};">${html}</p>`;
}

function htmlLayout({ heading, blocks }: { heading: string; blocks: string[] }): string {
  const year = new Date().getFullYear();
  const home = config.publicAppUrl;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="color-scheme" content="light" />
<meta name="x-apple-disable-message-reformatting" />
<title>${escapeHtml(heading)}</title>
</head>
<body style="margin:0;padding:0;background-color:${CANVAS};">
<span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;">${escapeHtml(heading)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${CANVAS};padding:32px 16px;">
  <tr>
    <td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
        <tr>
          <td style="padding:0 4px 20px;">
            <a href="${escapeHtml(home)}" style="font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:20px;font-weight:700;letter-spacing:-0.02em;color:${ACCENT_DARK};text-decoration:none;">${BRAND}</a>
          </td>
        </tr>
        <tr>
          <td style="background-color:#ffffff;border:1px solid ${BORDER};border-radius:14px;padding:32px;">
            <h1 style="margin:0 0 18px;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:22px;line-height:30px;color:${INK};">${escapeHtml(heading)}</h1>
            ${blocks.join("\n")}
          </td>
        </tr>
        <tr>
          <td style="padding:22px 4px 0;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;line-height:20px;color:#737686;">
            ${TAGLINE}<br />
            <a href="${escapeHtml(home)}" style="color:${ACCENT_DARK};text-decoration:none;">${escapeHtml(home)}</a><br />
            &copy; ${year} ${BRAND}. All rights reserved.
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

/** Password-reset email with a call-to-action button and a copyable link. */
export function passwordResetEmail({ link, ttlMinutes }: { link: string; ttlMinutes: number }): EmailTemplate {
  const minutes = Math.max(1, Math.round(ttlMinutes));
  const safeLink = escapeHtml(link);
  return {
    subject: `Reset your ${BRAND} password`,
    text: [
      `We received a request to reset your ${BRAND} password.`,
      "",
      "Choose a new password using the link below:",
      link,
      "",
      `This link expires in ${minutes} minutes. If you did not request this, you can safely ignore this email.`,
    ].join("\n"),
    html: htmlLayout({
      heading: "Reset your password",
      blocks: [
        paragraph(`We received a request to reset your ${BRAND} password.`),
        button(link, "Choose a new password"),
        paragraph(`This link expires in ${minutes} minutes. If you did not request this, you can safely ignore this email.`),
        paragraph(`<span style="font-size:13px;color:#737686;">Button not working? Copy and paste this address into your browser:</span><br /><a href="${safeLink}" style="color:${ACCENT_DARK};word-break:break-all;">${safeLink}</a>`),
      ],
    }),
  };
}

/** Reminder of the login email for accounts registered with a phone number. */
export function loginEmailReminder({ email }: { email: string }): EmailTemplate {
  const safeEmail = escapeHtml(email);
  return {
    subject: `Your ${BRAND} login email`,
    text: [
      `Your ${BRAND} login email is ${email}.`,
      "",
      `Return to ${config.publicAppUrl} to sign in.`,
    ].join("\n"),
    html: htmlLayout({
      heading: "Your login email",
      blocks: [
        paragraph("You asked to be reminded of the email address you use to sign in."),
        paragraph(`<strong style="color:${INK};">${safeEmail}</strong>`),
        paragraph("If you did not request this, you can safely ignore this email."),
      ],
    }),
  };
}

/** Internal notification of a contact-form submission from the public site. */export function contactNotification(input: {
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  submittedAt: string;
}): EmailTemplate {
  const rows: [string, string][] = [
    ["Name", input.name],
    ["Email", input.email],
    ["Phone", input.phone],
    ["Subject", input.subject],
    ["Received", input.submittedAt],
  ];
  const rowHtml = rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:6px 16px 6px 0;font-size:13px;color:#737686;white-space:nowrap;vertical-align:top;">${escapeHtml(label)}</td><td style="padding:6px 0;font-size:14px;color:${INK};">${escapeHtml(value)}</td></tr>`,
    )
    .join("\n");
  const replyAddress = input.email;
  const text = [
    `New ${BRAND} contact message`,
    "",
    ...rows.map(([label, value]) => `${label}: ${value}`),
    "",
    input.message,
  ].join("\n");
  return {
    subject: `New contact message — ${singleLine(input.subject) || "general"}`,
    text,
    html: htmlLayout({
      heading: "New contact message",
      blocks: [
        `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">${rowHtml}</table>`,
        paragraph(`<span style="font-size:13px;color:#737686;">Message</span><br />${escapeHtml(input.message).replace(/\n/g, "<br />")}`),
        button(`mailto:${encodeURIComponent(replyAddress)}`, `Reply to ${input.name}`),
      ],
    }),
  };
}

function statRow(rows: [string, string][]): string {
  const cells = rows
    .map(
      ([label, value]) =>
        `<td style="padding:12px 10px;text-align:center;border:1px solid ${BORDER};border-radius:10px;background:#fafbff;">
          <div style="font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:20px;font-weight:700;color:${INK};line-height:26px;">${escapeHtml(value)}</div>
          <div style="font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:11px;color:#737686;text-transform:uppercase;letter-spacing:0.05em;">${escapeHtml(label)}</div>
        </td>`,
    )
    .join("\n");
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 18px;border-collapse:separate;border-spacing:6px 0;">
    <tr>${cells}</tr>
  </table>`;
}

/** Weekly usage + credits summary sent to active accounts. */
export function usageDigestEmail(input: {
  recipientName: string;
  periodLabel: string;
  jobs: number;
  completed: number;
  topTool: string | null;
  creditsUsed: number;
  balance: number;
  planLabel: string;
  referralCount: number;
  referralLink: string;
  referralBonus: number;
}): EmailTemplate {
  const greeting = input.recipientName || "there";
  const statRows: [string, string][] = [
    ["Jobs run", String(input.jobs)],
    ["Completed", String(input.completed)],
    ["Credits used", String(input.creditsUsed)],
    ["Balance", String(input.balance)],
  ];
  const lines = [
    `Here is your ${BRAND} activity for ${input.periodLabel}.`,
    "",
    `Jobs run: ${input.jobs}`,
    `Completed: ${input.completed}`,
    `Top tool: ${input.topTool ?? "—"}`,
    `Credits used: ${input.creditsUsed}`,
    `Credits balance: ${input.balance} (${input.planLabel} plan)`,
    "",
    `Invited friends so far: ${input.referralCount}`,
    `Share your invite link to both earn ${input.referralBonus} credits:`,
    input.referralLink,
    "",
    `Open ${config.publicAppUrl} to keep going.`,
  ];
  return {
    subject: `Your ${BRAND} week in review — ${input.jobs} job${input.jobs === 1 ? "" : "s"}`,
    text: lines.join("\n"),
    html: htmlLayout({
      heading: "Your week in review",
      blocks: [
        paragraph(`Hi ${escapeHtml(greeting)}, here is your ${BRAND} activity for <strong style="color:${INK};">${escapeHtml(input.periodLabel)}</strong>.`),
        statRow(statRows),
        paragraph(
          input.topTool
            ? `Your most-used tool was <strong style="color:${INK};">${escapeHtml(input.topTool)}</strong>.`
            : "Run any tool and it will show up here next week.",
        ),
        paragraph(`You are on the <strong style="color:${INK};">${escapeHtml(input.planLabel)}</strong> plan with <strong style="color:${INK};">${input.balance}</strong> credits left. New credits arrive automatically every month.`),
        button(config.publicAppUrl, "Open PicTools"),
        paragraph(
          input.referralCount > 0
            ? `You have invited ${input.referralCount} friend${input.referralCount === 1 ? "" : "s"} so far — keep sharing your invite link for bonus credits:<br /><a href="${escapeHtml(input.referralLink)}" style="color:${ACCENT_DARK};word-break:break-all;">${escapeHtml(input.referralLink)}</a>`
            : `Know someone who would like these tools? Share your invite link and you both earn bonus credits:<br /><a href="${escapeHtml(input.referralLink)}" style="color:${ACCENT_DARK};word-break:break-all;">${escapeHtml(input.referralLink)}</a>`,
        ),
      ],
    }),
  };
}

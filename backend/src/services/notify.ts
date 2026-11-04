import nodemailer, { type Transporter } from "nodemailer";

import { config } from "../config.js";
import { logger } from "../utils/logger.js";

/**
 * Outbound delivery for account-recovery messages. Email uses SMTP; SMS and
 * WhatsApp use Twilio. Every channel degrades gracefully: when the relevant
 * credentials are absent the message is logged instead of sent, so the stack
 * runs end-to-end without a mail or messaging provider.
 */

let transporter: Transporter | null = null;

function mailTransport(): Transporter | null {
  if (!config.smtpHost) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpSecure,
      auth:
        config.smtpUser && config.smtpPass
          ? { user: config.smtpUser, pass: config.smtpPass }
          : undefined,
    });
  }
  return transporter;
}

export function emailEnabled(): boolean {
  return Boolean(config.smtpHost);
}

export function smsEnabled(): boolean {
  return Boolean(config.twilioAccountSid && config.twilioAuthToken && config.smsFromNumber);
}

export function whatsappEnabled(): boolean {
  return Boolean(
    config.twilioAccountSid && config.twilioAuthToken && config.whatsappFromNumber,
  );
}

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/** Send an email. Returns false when SMTP is not configured (message logged). */
export async function sendEmail(message: EmailMessage): Promise<boolean> {
  const transport = mailTransport();
  if (!transport) {
    logger.info("Email (not sent — SMTP not configured)", {
      to: message.to,
      subject: message.subject,
    });
    return false;
  }
  await transport.sendMail({ from: config.contactFromEmail, ...message });
  return true;
}

async function sendTwilio(
  to: string,
  from: string,
  body: string,
  channel: string,
): Promise<boolean> {
  const sid = config.twilioAccountSid;
  const token = config.twilioAuthToken;
  if (!sid || !token || !from) {
    logger.info(`${channel} (not sent — Twilio not configured)`, { to });
    return false;
  }
  const params = new URLSearchParams({ To: to, From: from, Body: body });
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    },
  );
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Twilio ${channel} failed (${res.status}): ${detail.slice(0, 200)}`);
  }
  return true;
}

/** Send an SMS. Returns false when Twilio is not configured (message logged). */
export async function sendSms(to: string, body: string): Promise<boolean> {
  return sendTwilio(to, config.smsFromNumber ?? "", body, "SMS");
}

/** Send a WhatsApp message. Returns false when Twilio is not configured. */
export async function sendWhatsApp(to: string, body: string): Promise<boolean> {
  const from = config.whatsappFromNumber;
  return sendTwilio(
    `whatsapp:${to}`,
    from ? (from.startsWith("whatsapp:") ? from : `whatsapp:${from}`) : "",
    body,
    "WhatsApp",
  );
}

import test from "node:test";
import assert from "node:assert/strict";

import {
  contactNotification,
  escapeHtml,
  loginEmailReminder,
  passwordResetEmail,
} from "../src/services/emailTemplates.js";

test("escapeHtml neutralises markup and quotes", () => {
  assert.equal(
    escapeHtml(`<a href="x">&'<`),
    "&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;",
  );
});

test("password reset email includes the link, expiry and a text fallback", () => {
  const link = "https://app.test/reset-password?token=abc123";
  const mail = passwordResetEmail({ link, ttlMinutes: 30 });
  assert.match(mail.subject, /password/i);
  assert.ok(mail.text.includes(link));
  assert.ok(mail.text.includes("30 minutes"));
  assert.ok(mail.html.includes(link));
});

test("password reset email escapes the link when embedding it in html", () => {
  const mail = passwordResetEmail({ link: 'https://x.test/?a=1&b="2"', ttlMinutes: 5 });
  assert.ok(mail.html.includes("a=1&amp;b=&quot;2&quot;"));
});

test("login reminder email names the login address", () => {
  const mail = loginEmailReminder({ email: "user@example.com" });
  assert.ok(mail.text.includes("user@example.com"));
  assert.ok(mail.html.includes("user@example.com"));
});

test("contact notification escapes user content and flattens the subject", () => {
  const mail = contactNotification({
    name: "Ada <script>",
    email: "ada@example.com",
    phone: "+15550001111",
    subject: "Hello\r\nBcc: evil@example.com",
    message: "<b>bold</b>\nsecond line",
    submittedAt: "2026-01-01T00:00:00.000Z",
  });
  assert.ok(!mail.subject.includes("\n") && !mail.subject.includes("\r"));
  assert.ok(!mail.html.includes("<script>"));
  assert.ok(mail.html.includes("&lt;script&gt;"));
  assert.ok(mail.html.includes("&lt;b&gt;bold&lt;/b&gt;"));
  assert.ok(mail.html.includes("second line"));
});

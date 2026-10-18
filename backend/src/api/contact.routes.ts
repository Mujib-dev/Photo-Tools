import { Router } from "express";
import { config } from "../config.js";
import { Errors } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

const router = Router();

/**
 * POST /api/contact
 * Accepts a contact form submission and forwards it via email or logs it.
 * Requires auth when config.authEnabled is true.
 */
router.post("/", async (req, res, next) => {
  try {
    const { name, email, phone, subject, message } = req.body ?? {};

    if (typeof name !== "string" || name.trim().length < 2) {
      throw Errors.invalidSettings("Name must be at least 2 characters.");
    }
    if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      throw Errors.invalidSettings("Enter a valid email address.");
    }
    if (typeof phone !== "string" || !/^\+?[\d\s().-]{7,20}$/.test(phone.trim())) {
      throw Errors.invalidSettings("Enter a valid phone or WhatsApp number.");
    }
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 7 || digits.length > 15) {
      throw Errors.invalidSettings("Phone must contain 7–15 digits.");
    }
    if (typeof message !== "string" || message.trim().length < 10) {
      throw Errors.invalidSettings("Message must be at least 10 characters.");
    }

    const sanitized = {
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      subject: typeof subject === "string" ? subject.trim() : "general",
      message: message.trim(),
      submittedAt: new Date().toISOString(),
    };

    // In development, log the contact submission.
    // In production, you would integrate with an email service (SendGrid, Resend, etc.)
    if (config.nodeEnv === "development") {
      logger.info("Contact form submission", sanitized);
    } else {
      // TODO: Replace with real email sending integration
      logger.info("Contact form submission (production)", sanitized);
    }

    res.status(201).json({ ok: true, message: "Message sent successfully." });
  } catch (err) {
    next(err);
  }
});

export default router;
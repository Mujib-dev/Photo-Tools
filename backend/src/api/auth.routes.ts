import { Router, type Request, type Response } from "express";
import { randomBytes, randomInt } from "node:crypto";

import { config } from "../config.js";
import { hashPassword, verifyPassword } from "../auth/password.js";
import { hashSessionToken } from "../auth/session.js";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../auth/jwt.js";
import { toPublicUser, type AuthStore, type PublicUser, type UserRecord } from "../auth/AuthStore.js";
import { verifyGoogleIdToken } from "../auth/google.js";
import { getSessionToken, parseCookies, resolveAuth } from "../middleware/requireAuth.js";
import { authRateLimit } from "../middleware/authRateLimit.js";
import { assertStrongPassword } from "../security/passwordPolicy.js";
import { sendEmail, sendSms, sendWhatsApp } from "../services/notify.js";
import { applyReferral } from "../services/credits.js";
import { loginEmailReminder, passwordResetEmail } from "../services/emailTemplates.js";
import { AppError, Errors } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_MAX_LENGTH = 254;
const FULL_NAME_RE = /^[\p{L}\p{M}][\p{L}\p{M}' .-]*$/u;
const FULL_NAME_MAX_LENGTH = 100;
const PHONE_RE = /^\+?\d{7,15}$/;
const AVATAR_MAX_BYTES = 512 * 1024;
const AVATAR_RE = /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/;

/**
 * Hash verified against when the account does not exist, so login spends the
 * same scrypt time for unknown and known emails (no user-enumeration oracle).
 */
const DUMMY_PASSWORD_HASH = hashPassword("photo-tools-timing-equalizer");

function accessCookieOptions(): Record<string, unknown> {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: config.nodeEnv === "production",
    path: "/",
    maxAge: config.accessTokenTtlMs,
  };
}

function refreshCookieOptions(): Record<string, unknown> {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: config.nodeEnv === "production",
    path: "/",
    maxAge: config.refreshTokenTtlMs,
  };
}

function normalizeEmail(raw: unknown): string {
  if (typeof raw !== "string" || raw.trim().length > EMAIL_MAX_LENGTH || !EMAIL_RE.test(raw.trim())) {
    throw new AppError(400, "Enter a valid email address.");
  }
  return raw.trim().toLowerCase();
}

function normalizeFullName(raw: unknown): string | null {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== "string") throw new AppError(400, "Enter your full name.");
  const value = raw.trim().replace(/\s+/g, " ");
  if (!value) return null;
  if (value.length < 2 || value.length > FULL_NAME_MAX_LENGTH || !FULL_NAME_RE.test(value)) {
    throw new AppError(400, "Enter a valid full name (2–100 letters).");
  }
  return value;
}

function normalizePhone(raw: unknown): string | null {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== "string") throw new AppError(400, "Enter a valid phone number.");
  const value = raw.trim().replace(/[\s().-]/g, "");
  if (!value) return null;
  if (!PHONE_RE.test(value)) {
    throw new AppError(400, "Enter a valid phone number (7–15 digits, optional +).");
  }
  return value;
}

function validateCredentials(body: unknown, { enforcePolicy = true } = {}): { email: string; password: string } {
  const { email, password } = (body ?? {}) as { email?: unknown; password?: unknown };
  const normalizedEmail = normalizeEmail(email);
  if (enforcePolicy) {
    // Full strength policy on registration.
    assertStrongPassword(password, normalizedEmail);
  } else {
    // On login only require that a password was supplied; the policy may have
    // been tightened since the account was created.
    if (typeof password !== "string" || password.length === 0) {
      throw new AppError(400, "Enter your password.");
    }
    if (password.length > config.passwordMaxLength) {
      throw new AppError(400, "Enter your password.");
    }
  }
  return { email: normalizedEmail, password: password as string };
}

/** Validate an avatar data URL (or null to remove it). */
function parseAvatar(raw: unknown): string | null {
  if (raw === null) return null;
  if (typeof raw !== "string" || !AVATAR_RE.test(raw)) {
    throw new AppError(400, "Upload a PNG, JPEG or WebP image.");
  }
  const encoded = raw.slice(raw.indexOf(",") + 1);
  if (Buffer.from(encoded, "base64").byteLength > AVATAR_MAX_BYTES) {
    throw new AppError(413, "Your profile photo must be smaller than 512 KB.");
  }
  return raw;
}

const RECOVERY_CHANNELS = new Set(["email", "sms", "whatsapp"]);

/** Accept either an email address or a phone number as a recovery identifier. */
function parseRecoveryIdentifier(raw: unknown): { kind: "email" | "phone"; value: string } {
  if (typeof raw !== "string" || !raw.trim()) {
    throw new AppError(400, "Enter your email or phone number.");
  }
  const value = raw.trim();
  if (value.includes("@")) return { kind: "email", value: normalizeEmail(value) };
  const phone = normalizePhone(value);
  if (!phone) throw new AppError(400, "Enter a valid email or phone number.");
  return { kind: "phone", value: phone };
}

function generateRecoveryCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain || !local) return email;
  return `${local.slice(0, 1)}${"*".repeat(Math.max(1, local.length - 1))}@${domain}`;
}

function maskPhone(phone: string): string {
  return phone.length <= 4 ? phone : `${"*".repeat(phone.length - 4)}${phone.slice(-4)}`;
}

function refreshTokenFrom(req: Request): { token: string; source: "body" | "cookie" } | null {
  const body = (req.body ?? {}) as { refreshToken?: unknown };
  if (typeof body.refreshToken === "string" && body.refreshToken.trim()) {
    return { token: body.refreshToken.trim(), source: "body" };
  }
  const cookie = parseCookies(req.headers.cookie)[config.refreshCookieName];
  if (cookie) return { token: cookie, source: "cookie" };
  return null;
}

interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export function authRoutes(authStore: AuthStore): Router {
  const router = Router();

  // Auth responses carry tokens/identity and must never be cached.
  router.use((_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Pragma", "no-cache");
    next();
  });

  // Throttle credential endpoints: per-IP+email and per-IP attempt caps.
  router.use(
    ["/login", "/register", "/token/login", "/token/register", "/recover", "/recover/verify", "/recover/email", "/reset-password", "/google", "/token/google"],
    authRateLimit,
  );

  /**
   * Mint an access + refresh token pair. Only the hash of the refresh token
   * is stored, so a database leak cannot be replayed against the API.
   */
  const issueTokens = async (user: PublicUser): Promise<IssuedTokens> => {
    const access = signAccessToken(user, config.accessTokenTtlMs);
    const refresh = signRefreshToken(user.id, config.refreshTokenTtlMs);
    await authStore.createRefreshToken(hashSessionToken(refresh.token), user.id, refresh.expiresAt);
    return { accessToken: access.token, refreshToken: refresh.token, expiresAt: access.expiresAt };
  };

  const setTokenCookies = (res: Response, tokens: IssuedTokens): void => {
    res.cookie(config.accessCookieName, tokens.accessToken, accessCookieOptions());
    res.cookie(config.refreshCookieName, tokens.refreshToken, refreshCookieOptions());
    // Drop any pre-JWT session cookie so exactly one credential is in play.
    res.clearCookie(config.sessionCookieName, { path: "/" });
  };

  const register = async (body: unknown): Promise<PublicUser> => {
    const { email, password } = validateCredentials(body);
    const input = (body ?? {}) as {
      fullName?: unknown;
      phone?: unknown;
      acceptedTerms?: unknown;
      referralCode?: unknown;
    };
    if (input.acceptedTerms !== true) {
      throw new AppError(400, "You must accept the Terms of Service and Privacy Policy to create an account.");
    }
    const fullName = normalizeFullName(input.fullName);
    const phone = normalizePhone(input.phone);
    const referralCode = typeof input.referralCode === "string" ? input.referralCode : null;
    const existingUser = await authStore.getUserByEmail(email);
    if (existingUser) {
      if (existingUser.status === "banned" || existingUser.status === "suspended") {
        throw new AppError(
          403,
          `This email address has been ${existingUser.status}${existingUser.banReason ? `: ${existingUser.banReason}` : "."}`,
        );
      }
      throw new AppError(409, "This email address is already registered. Please sign in instead.");
    }
    let user;
    try {
      user = await authStore.createUser(
        email,
        hashPassword(password),
        "user",
        fullName,
        phone,
        Date.now(),
      );
    } catch (err) {
      if (err instanceof Error && err.message === "EMAIL_EXISTS") {
        throw new AppError(409, "This email address is already registered. Please sign in instead.");
      }
      throw err;
    }
    // Referral bonus: both sides are credited. Unknown codes are ignored so a
    // typo never blocks sign-up (and gives no oracle for probing codes).
    await applyReferral(authStore, user, referralCode).catch(() => undefined);
    return toPublicUser(user);
  };

  const login = async (body: unknown): Promise<PublicUser> => {
    const { email, password } = validateCredentials(body, { enforcePolicy: false });
    const user = await authStore.getUserByEmail(email);
    // Always run the KDF: unknown emails verify against a throwaway hash so the
    // response time does not reveal whether the account exists.
    const passwordOk = verifyPassword(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);
    if (!user || !passwordOk) {
      throw new AppError(401, "Incorrect email or password.");
    }
    if (user.status === "banned" || user.status === "suspended") {
      throw new AppError(
        403,
        `This account has been ${user.status}${user.banReason ? `: ${user.banReason}` : "."}`,
      );
    }
    return toPublicUser(user);
  };

  router.post("/register", async (req: Request, res: Response, next) => {
    try {
      const user = await register(req.body);
      const tokens = await issueTokens(user);
      setTokenCookies(res, tokens);
      res.status(201).json({ user, expiresAt: tokens.expiresAt });
    } catch (err) {
      next(err);
    }
  });

  router.post("/login", async (req: Request, res: Response, next) => {
    try {
      const user = await login(req.body);
      const tokens = await issueTokens(user);
      setTokenCookies(res, tokens);
      res.json({ user, expiresAt: tokens.expiresAt });
    } catch (err) {
      next(err);
    }
  });

  // Token variants for native clients (the Expo app) that have no cookie jar.
  // They return both tokens in the body: the short-lived access token is
  // replayed via X-Access-Token, the refresh token is kept in the keychain
  // and exchanged at /auth/refresh when the access token expires.

  router.post("/token/register", async (req: Request, res: Response, next) => {
    try {
      const user = await register(req.body);
      const tokens = await issueTokens(user);
      res.status(201).json({ user, ...tokens });
    } catch (err) {
      next(err);
    }
  });

  router.post("/token/login", async (req: Request, res: Response, next) => {
    try {
      const user = await login(req.body);
      const tokens = await issueTokens(user);
      res.json({ user, ...tokens });
    } catch (err) {
      next(err);
    }
  });

  // Exchange a refresh token for a fresh access token. The refresh token is
  // rotated (old one revoked) on every use; browsers present it as an
  // httpOnly cookie, native clients in the request body.
  router.post("/refresh", async (req: Request, res: Response, next) => {
    try {
      const presented = refreshTokenFrom(req);
      if (!presented) throw Errors.unauthorized();
      const claims = verifyRefreshToken(presented.token);
      if (!claims) throw Errors.unauthorized();

      const tokenHash = hashSessionToken(presented.token);
      const user = await authStore.getRefreshTokenUser(tokenHash);
      if (!user) {
        // The signature is valid but the token is unknown to the store: it was
        // already rotated (replay) or revoked. Treat re-use as token theft and
        // invalidate the user's whole session family.
        if (config.refreshReuseRevokesFamily) {
          await authStore.deleteRefreshTokensForUser(claims.sub);
          await authStore.deleteSessionsForUser(claims.sub);
          logger.warn("Refresh token re-use detected — revoked all sessions for user", {
            userId: claims.sub,
            ip: req.ip,
          });
        }
        throw Errors.unauthorized();
      }
      if (user.status === "banned" || user.status === "suspended") {
        throw new AppError(
          403,
          `This account has been ${user.status}${user.banReason ? `: ${user.banReason}` : "."}`,
        );
      }
      await authStore.deleteRefreshToken(tokenHash);

      const tokens = await issueTokens(user);
      if (presented.source === "cookie") {
        setTokenCookies(res, tokens);
        res.json({ user: toPublicUser(user), expiresAt: tokens.expiresAt });
      } else {
        res.json({ user: toPublicUser(user), ...tokens });
      }
    } catch (err) {
      next(err);
    }
  });

  router.post("/logout", async (req: Request, res: Response, next) => {
    try {
      // Revoke the refresh token (cookie or body) so it cannot be replayed.
      const presented = refreshTokenFrom(req);
      if (presented) await authStore.deleteRefreshToken(hashSessionToken(presented.token));
      // Revoke a legacy session too, for sign-ins predating the JWT rollout.
      const legacy = getSessionToken(req);
      if (legacy) await authStore.deleteSession(hashSessionToken(legacy));

      res.clearCookie(config.accessCookieName, { path: "/" });
      res.clearCookie(config.refreshCookieName, { path: "/" });
      res.clearCookie(config.sessionCookieName, { path: "/" });
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  router.get("/me", async (req: Request, res: Response, next) => {
    try {
      const resolved = await resolveAuth(req, authStore);
      if (!resolved) throw Errors.unauthorized();
      res.json({ user: resolved.user, expiresAt: resolved.expiresAt });
    } catch (err) {
      next(err);
    }
  });

  /** Set or clear the signed-in user's profile photo. */
  router.put("/me/avatar", async (req: Request, res: Response, next) => {
    try {
      const resolved = await resolveAuth(req, authStore);
      if (!resolved) throw Errors.unauthorized();
      const { avatar } = (req.body ?? {}) as { avatar?: unknown };
      if (avatar === undefined) throw new AppError(400, "Choose a profile photo.");
      await authStore.setUserAvatar(resolved.user.id, parseAvatar(avatar));
      const updated = await authStore.getUserById(resolved.user.id);
      if (!updated) throw Errors.unauthorized();
      res.json({ user: toPublicUser(updated) });
    } catch (err) {
      next(err);
    }
  });

  /**
   * Update the signed-in user's own email and/or password. Both changes
   * require the current password, so a stolen access token cannot take over
   * the account. A password change revokes every other session, while the
   * caller receives a fresh token pair and stays signed in.
   */
  router.patch("/me", async (req: Request, res: Response, next) => {
    try {
      const resolved = await resolveAuth(req, authStore);
      if (!resolved) throw Errors.unauthorized();
      const user = await authStore.getUserById(resolved.user.id);
      if (!user) throw Errors.unauthorized();

      const { currentPassword, email, newPassword } = (req.body ?? {}) as {
        currentPassword?: unknown;
        email?: unknown;
        newPassword?: unknown;
      };
      if (typeof currentPassword !== "string" || currentPassword.length === 0) {
        throw new AppError(400, "Enter your current password.");
      }
      if (!verifyPassword(currentPassword, user.passwordHash)) {
        throw new AppError(400, "Your current password is incorrect.");
      }
      if (email === undefined && newPassword === undefined) {
        throw new AppError(400, "Choose a new email or password.");
      }

      let nextEmail = user.email;
      if (email !== undefined) {
        nextEmail = normalizeEmail(email);
        if (nextEmail !== user.email) {
          try {
            await authStore.setUserEmail(user.id, nextEmail);
          } catch (err) {
            if (err instanceof Error && err.message === "EMAIL_EXISTS") {
              throw new AppError(409, "An account with this email already exists.");
            }
            throw err;
          }
        }
      }

      if (newPassword !== undefined) {
        assertStrongPassword(newPassword, nextEmail);
        await authStore.setUserPasswordHash(user.id, hashPassword(newPassword));
        // Other devices must sign in again with the new password.
        await authStore.deleteRefreshTokensForUser(user.id);
        await authStore.deleteSessionsForUser(user.id);
      }

      const updated = await authStore.getUserById(user.id);
      if (!updated) throw Errors.unauthorized();
      const publicUser = toPublicUser(updated);
      // Rotate the caller's refresh token so the previous one cannot be replayed.
      const presented = refreshTokenFrom(req);
      if (presented) await authStore.deleteRefreshToken(hashSessionToken(presented.token));
      const tokens = await issueTokens(publicUser);
      setTokenCookies(res, tokens);
      res.json({ user: publicUser, expiresAt: tokens.expiresAt });
    } catch (err) {
      next(err);
    }
  });

  // --- account recovery ---------------------------------------------------

  /**
   * Start a password reset. Works with an email address or a phone number and
   * a delivery channel. The response is identical whether or not an account
   * exists, so it cannot be used to enumerate users.
   */
  router.post("/recover", async (req: Request, res: Response, next) => {
    try {
      const { identifier, channel } = (req.body ?? {}) as { identifier?: unknown; channel?: unknown };
      const id = parseRecoveryIdentifier(identifier);
      const ch = typeof channel === "string" ? channel.toLowerCase() : "email";
      if (!RECOVERY_CHANNELS.has(ch)) throw new AppError(400, "Choose how to receive your reset code.");

      const accounts =
        id.kind === "email"
          ? [await authStore.getUserByEmail(id.value)].filter((u): u is UserRecord => Boolean(u))
          : await authStore.listUsersByPhone(id.value);
      const expiresAt = Date.now() + (ch === "email" ? config.passwordResetTtlMs : config.recoveryCodeTtlMs);
      let destination: string | null = null;

      for (const user of accounts) {
        try {
          if (ch === "email") {
            const token = randomBytes(32).toString("hex");
            await authStore.createPasswordReset(hashSessionToken(token), user.id, expiresAt);
            const link = `${config.publicAppUrl}/reset-password?token=${token}`;
            await sendEmail({
              to: user.email,
              ...passwordResetEmail({ link, ttlMinutes: config.passwordResetTtlMs / 60000 }),
            });
            destination = maskEmail(user.email);
          } else {
            const to = id.kind === "phone" ? id.value : user.phone;
            if (!to) continue;
            const code = generateRecoveryCode();
            await authStore.createPasswordReset(hashSessionToken(code), user.id, expiresAt);
            const body = `Your PicTools password reset code is ${code}. It expires in ${Math.round(config.recoveryCodeTtlMs / 60000)} minutes.`;
            if (ch === "sms") await sendSms(to, body);
            else await sendWhatsApp(to, body);
            destination = maskPhone(to);
          }
        } catch (err) {
          logger.error("Recovery delivery failed", {
            channel: ch,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      res.json({ ok: true, channel: ch, destination });
    } catch (err) {
      next(err);
    }
  });

  /** Exchange a code received by SMS/WhatsApp for a short-lived reset token. */
  router.post("/recover/verify", async (req: Request, res: Response, next) => {
    try {
      const { code } = (req.body ?? {}) as { code?: unknown };
      const value = typeof code === "string" ? code.trim() : "";
      if (!/^\d{4,8}$/.test(value)) throw Errors.passwordResetInvalid();
      const tokenHash = hashSessionToken(value);
      const user = await authStore.getPasswordResetUser(tokenHash);
      if (!user) throw Errors.passwordResetInvalid();
      await authStore.deletePasswordReset(tokenHash);
      const token = randomBytes(32).toString("hex");
      await authStore.createPasswordReset(
        hashSessionToken(token),
        user.id,
        Date.now() + config.passwordResetTtlMs,
      );
      res.json({ ok: true, resetToken: token });
    } catch (err) {
      next(err);
    }
  });

  /** Complete a reset with the emailed token (or a token from /recover/verify). */
  router.post("/reset-password", async (req: Request, res: Response, next) => {
    try {
      const { token, password } = (req.body ?? {}) as { token?: unknown; password?: unknown };
      if (typeof token !== "string" || !token.trim()) throw Errors.passwordResetTokenRequired();
      const tokenHash = hashSessionToken(token.trim());
      const user = await authStore.getPasswordResetUser(tokenHash);
      if (!user) throw Errors.passwordResetInvalid();
      assertStrongPassword(password, user.email);
      await authStore.setUserPasswordHash(user.id, hashPassword(password));
      await authStore.deleteRefreshTokensForUser(user.id);
      await authStore.deleteSessionsForUser(user.id);
      await authStore.deletePasswordResetsForUser(user.id);
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  /** Remind a user of their login email by matching the phone they registered with. */
  router.post("/recover/email", async (req: Request, res: Response, next) => {
    try {
      const { phone } = (req.body ?? {}) as { phone?: unknown };
      const normalized = normalizePhone(phone);
      if (!normalized) throw new AppError(400, "Enter the phone number you registered with.");
      const accounts = await authStore.listUsersByPhone(normalized);
      for (const user of accounts) {
        try {
          await sendEmail({
            to: user.email,
            ...loginEmailReminder({ email: user.email }),
          });
        } catch (err) {
          logger.error("Login-email reminder failed", {
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  // --- Google sign-in -----------------------------------------------------

  /**
   * Verify a Google ID token and return the matching account, creating one on
   * first sign-in. Shared by the cookie and token endpoints.
   */
  const authenticateWithGoogle = async (body: unknown): Promise<PublicUser> => {
    if (config.googleClientIds.length === 0) {
      throw new AppError(503, "Google sign-in is not configured on this server.");
    }
    const { credential } = (body ?? {}) as { credential?: unknown };
    if (typeof credential !== "string" || !credential.trim()) {
      throw new AppError(400, "Missing Google credential.");
    }
    const claims = await verifyGoogleIdToken(credential.trim());
    const email = claims.email.trim().toLowerCase();
    let user = await authStore.getUserByEmail(email);
    if (!user) {
      try {
        user = await authStore.createUser(
          email,
          // Google accounts have no local password; store a random hash so the
          // password path simply never matches until the user sets one.
          hashPassword(randomBytes(24).toString("hex")),
          "user",
          claims.name?.trim() || null,
          null,
          null,
        );
      } catch (err) {
        if (err instanceof Error && err.message === "EMAIL_EXISTS") {
          user = await authStore.getUserByEmail(email);
        }
        if (!user) throw err;
      }
    }
    if (user.status === "banned" || user.status === "suspended") {
      throw new AppError(
        403,
        `This account has been ${user.status}${user.banReason ? `: ${user.banReason}` : "."}`,
      );
    }
    return toPublicUser(user);
  };

  /** Exchange a Google ID token (GIS credential) for a cookie session (web). */
  router.post("/google", async (req: Request, res: Response, next) => {
    try {
      const user = await authenticateWithGoogle(req.body);
      const tokens = await issueTokens(user);
      setTokenCookies(res, tokens);
      res.json({ user, expiresAt: tokens.expiresAt });
    } catch (err) {
      next(err);
    }
  });

  /** Token variant for native clients that have no cookie jar (the Expo app). */
  router.post("/token/google", async (req: Request, res: Response, next) => {
    try {
      const user = await authenticateWithGoogle(req.body);
      const tokens = await issueTokens(user);
      res.json({ user, ...tokens });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

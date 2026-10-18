import { Router, type Request, type Response } from "express";

import { config } from "../config.js";
import { hashPassword, verifyPassword } from "../auth/password.js";
import { hashSessionToken } from "../auth/session.js";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../auth/jwt.js";
import { toPublicUser, type AuthStore, type PublicUser } from "../auth/AuthStore.js";
import { getSessionToken, parseCookies, resolveAuth } from "../middleware/requireAuth.js";
import { authRateLimit } from "../middleware/authRateLimit.js";
import { AppError, Errors } from "../utils/errors.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

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

function validateCredentials(body: unknown): { email: string; password: string } {
  const { email, password } = (body ?? {}) as { email?: unknown; password?: unknown };
  if (typeof email !== "string" || !EMAIL_RE.test(email.trim())) {
    throw new AppError(400, "Enter a valid email address.");
  }
  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
    throw new AppError(400, `Your password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  }
  return { email: email.trim().toLowerCase(), password };
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

  // Throttle credential endpoints: per-IP+email and per-IP attempt caps.
  router.use(["/login", "/register", "/token/login", "/token/register"], authRateLimit);

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

  const register = async (body: unknown): Promise<{ id: string; email: string }> => {
    const { email, password } = validateCredentials(body);
    let user;
    try {
      user = await authStore.createUser(email, hashPassword(password));
    } catch (err) {
      if (err instanceof Error && err.message === "EMAIL_EXISTS") {
        throw Errors.invalidSettings("An account with this email already exists.");
      }
      throw err;
    }
    return toPublicUser(user);
  };

  const login = async (body: unknown): Promise<{ id: string; email: string }> => {
    const { email, password } = validateCredentials(body);
    const user = await authStore.getUserByEmail(email);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      throw new AppError(401, "Incorrect email or password.");
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
      if (!user) throw Errors.unauthorized();
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

  return router;
}

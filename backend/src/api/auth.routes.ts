import { Router, type Request, type Response } from "express";

import { config } from "../config.js";
import { hashPassword, verifyPassword } from "../auth/password.js";
import { generateSessionToken, hashSessionToken } from "../auth/session.js";
import { toPublicUser, type AuthStore } from "../auth/AuthStore.js";
import { getSessionToken } from "../middleware/requireAuth.js";
import { AppError, Errors } from "../utils/errors.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

function cookieOptions(): Record<string, unknown> {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: config.nodeEnv === "production",
    path: "/",
    maxAge: config.sessionTtlMs,
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

export function authRoutes(authStore: AuthStore): Router {
  const router = Router();

  /** Create a session, returning the raw token (only the hash is stored). */
  const startSession = async (userId: string): Promise<string> => {
    const token = generateSessionToken();
    await authStore.createSession(userId, hashSessionToken(token), Date.now() + config.sessionTtlMs);
    return token;
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
      const token = await startSession(user.id);
      res.cookie(config.sessionCookieName, token, cookieOptions());
      res.status(201).json({ user });
    } catch (err) {
      next(err);
    }
  });

  router.post("/login", async (req: Request, res: Response, next) => {
    try {
      const user = await login(req.body);
      const token = await startSession(user.id);
      res.cookie(config.sessionCookieName, token, cookieOptions());
      res.json({ user });
    } catch (err) {
      next(err);
    }
  });

  // Token variants for native clients (the Expo app) that have no cookie jar.
  // They return the session token in the body so it can be persisted in the
  // device keychain and replayed via the X-Session-Token header.

  router.post("/token/register", async (req: Request, res: Response, next) => {
    try {
      const user = await register(req.body);
      const token = await startSession(user.id);
      res.status(201).json({ user, token });
    } catch (err) {
      next(err);
    }
  });

  router.post("/token/login", async (req: Request, res: Response, next) => {
    try {
      const user = await login(req.body);
      const token = await startSession(user.id);
      res.json({ user, token });
    } catch (err) {
      next(err);
    }
  });

  router.post("/logout", async (req: Request, res: Response, next) => {
    try {
      const token = getSessionToken(req);
      if (token) await authStore.deleteSession(hashSessionToken(token));
      res.clearCookie(config.sessionCookieName, { path: "/" });
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  router.get("/me", async (req: Request, res: Response, next) => {
    try {
      const token = getSessionToken(req);
      if (!token) throw Errors.unauthorized();
      const user = await authStore.getUserBySession(hashSessionToken(token));
      if (!user) throw Errors.unauthorized();
      res.json({ user: toPublicUser(user) });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

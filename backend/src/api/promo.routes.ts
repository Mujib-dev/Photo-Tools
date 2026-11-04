import { Router, type Request, type Response } from "express";

import type { AuthStore, UserRecord } from "../auth/AuthStore.js";
import { previewPromo, redeemPromo } from "../services/promo.js";
import { AppError, Errors } from "../utils/errors.js";

/**
 * Promo code redemption for the signed-in account.
 *
 * `POST /redeem` grants the code's benefit (credits, or a tier upgrade).
 * `POST /validate` previews it without granting anything, so the UI can show
 * what a code will do before the account commits.
 *
 * Discount codes are applied to the Stripe checkout session instead — they
 * are validated here but redeemed by the billing flow.
 */

const CODE_MAX_LENGTH = 32;

function requireUser(req: Request, authStore: AuthStore): Promise<UserRecord> {
  return (async () => {
    const userId = req.authUser?.id;
    if (!userId) throw Errors.unauthorized();
    const user = await authStore.getUserById(userId);
    if (!user) throw Errors.unauthorized();
    return user;
  })();
}

function readCode(body: unknown): string {
  const raw = (body as { code?: unknown } | null)?.code;
  if (typeof raw !== "string" || raw.trim().length === 0) {
    throw new AppError(400, "Enter a promo code.");
  }
  if (raw.trim().length > CODE_MAX_LENGTH) {
    throw new AppError(400, "That promo code is too long.");
  }
  return raw.trim();
}

/** The public shape of a promo code (no internal bookkeeping). */
function publicPromo(promo: {
  code: string;
  description: string;
  kind: string;
  credits: number;
  plan: string | null;
  planDays: number;
  percentOff: number;
  expiresAt: number | null;
  maxRedemptions: number | null;
}) {
  return {
    code: promo.code,
    description: promo.description,
    kind: promo.kind,
    credits: promo.credits,
    plan: promo.plan,
    planDays: promo.planDays,
    percentOff: promo.percentOff,
    expiresAt: promo.expiresAt,
    maxRedemptions: promo.maxRedemptions,
  };
}

export function promoRoutes(authStore: AuthStore): Router {
  const router = Router();

  /** Preview a code: what it grants, or why it can't be used. */
  router.post("/validate", async (req: Request, res: Response, next) => {
    try {
      const user = await requireUser(req, authStore);
      const code = readCode(req.body);
      const result = await previewPromo(authStore, user, code);
      res.json({
        valid: result.rejection === null,
        promo: publicPromo(result.promo),
        redemption: result.redemption,
        message: result.rejection,
      });
    } catch (err) {
      next(err);
    }
  });

  /** Redeem a code: grant the credits or the tier upgrade. */
  router.post("/redeem", async (req: Request, res: Response, next) => {
    try {
      const user = await requireUser(req, authStore);
      const code = readCode(req.body);
      const outcome = await redeemPromo(authStore, user, code);
      res.json({ ok: true, ...outcome });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

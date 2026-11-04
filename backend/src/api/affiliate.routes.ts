import { Router, type Request, type Response } from "express";
import {
  getOrCreateAffiliate,
  listUserPayouts,
  recordAffiliateClick,
  requestAffiliatePayout,
  updateAffiliatePayoutSettings,
} from "../services/affiliateStore.js";
import { AppError } from "../utils/errors.js";

export function affiliateRoutes(): Router {
  const router = Router();

  // Public click tracker (no auth required)
  router.post("/track-click", (req: Request, res: Response) => {
    const { code } = req.body as { code?: string };
    if (code && typeof code === "string") {
      recordAffiliateClick(code);
    }
    res.json({ ok: true });
  });

  router.get("/", (req: Request, res: Response) => {
    const user = req.authUser;
    if (!user) throw new AppError(401, "Sign in required.");
    const defaultCode = (user as any).referralCode || `REF_${user.id.slice(0, 6).toUpperCase()}`;
    const profile = getOrCreateAffiliate(user.id, user.email, defaultCode);
    const payouts = listUserPayouts(user.id);
    res.json({ profile, payouts });
  });

  router.patch("/payout-settings", (req: Request, res: Response) => {
    const user = req.authUser;
    if (!user) throw new AppError(401, "Sign in required.");
    const { method, details } = req.body as {
      method?: "paypal" | "stripe" | "bank" | "crypto";
      details?: string;
    };
    if (!method || !details || typeof details !== "string" || !details.trim()) {
      throw new AppError(400, "Payout method and destination details are required.");
    }
    const profile = updateAffiliatePayoutSettings(user.id, method, details);
    res.json({ profile });
  });

  router.post("/payout", (req: Request, res: Response) => {
    const user = req.authUser;
    if (!user) throw new AppError(401, "Sign in required.");
    try {
      const payout = requestAffiliatePayout(user.id);
      res.status(201).json({ payout });
    } catch (err: unknown) {
      throw new AppError(400, err instanceof Error ? err.message : String(err));
    }
  });

  return router;
}

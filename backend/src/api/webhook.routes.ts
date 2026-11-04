import { Router, type Request, type Response } from "express";
import {
  createWebhook,
  deleteWebhook,
  getWebhookLogs,
  listUserWebhooks,
  sendWebhookPing,
  toggleWebhook,
} from "../services/webhookStore.js";
import { AppError } from "../utils/errors.js";

export function webhookRoutes(): Router {
  const router = Router();

  router.get("/", (req: Request, res: Response) => {
    const user = req.authUser;
    if (!user) throw new AppError(401, "Sign in required.");
    const webhooks = listUserWebhooks(user.id);
    const logs = getWebhookLogs(user.id, 20);
    res.json({ webhooks, logs });
  });

  router.post("/", (req: Request, res: Response) => {
    const user = req.authUser;
    if (!user) throw new AppError(401, "Sign in required.");
    const { url, events } = req.body as { url?: string; events?: string[] };
    if (!url || typeof url !== "string" || !url.startsWith("http")) {
      throw new AppError(400, "A valid HTTPS or HTTP webhook destination URL is required.");
    }
    const endpoint = createWebhook({
      userId: user.id,
      url: url.trim(),
      events: Array.isArray(events) ? events : ["job.completed", "job.failed"],
    });
    res.status(201).json({ webhook: endpoint });
  });

  router.delete("/:id", (req: Request, res: Response) => {
    const user = req.authUser;
    if (!user) throw new AppError(401, "Sign in required.");
    const ok = deleteWebhook(user.id, req.params.id);
    if (!ok) throw new AppError(404, "Webhook endpoint not found.");
    res.json({ ok: true });
  });

  router.patch("/:id", (req: Request, res: Response) => {
    const user = req.authUser;
    if (!user) throw new AppError(401, "Sign in required.");
    const { active } = req.body as { active?: boolean };
    const ep = toggleWebhook(user.id, req.params.id, Boolean(active));
    if (!ep) throw new AppError(404, "Webhook endpoint not found.");
    res.json({ webhook: ep });
  });

  router.post("/:id/test", async (req: Request, res: Response) => {
    const user = req.authUser;
    if (!user) throw new AppError(401, "Sign in required.");
    const webhooks = listUserWebhooks(user.id);
    const ep = webhooks.find((w) => w.id === req.params.id);
    if (!ep) throw new AppError(404, "Webhook endpoint not found.");

    const log = await sendWebhookPing(ep, "ping", {
      message: "Test ping from PicTools Webhook Engine",
      userId: user.id,
      environment: process.env.NODE_ENV ?? "development",
    });
    res.json({ ok: log.success, log });
  });

  return router;
}

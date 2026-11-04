import { Router, type Request, type Response } from "express";
import {
  addTicketResponse,
  createTicket,
  getTicket,
  listUserTickets,
} from "../services/ticketStore.js";
import { isAdminRole } from "../auth/AuthStore.js";
import { AppError } from "../utils/errors.js";

export function ticketRoutes(): Router {
  const router = Router();

  router.get("/", (req: Request, res: Response) => {
    const user = req.authUser;
    if (!user) throw new AppError(401, "Sign in required.");
    const tickets = listUserTickets(user.id);
    res.json({ tickets });
  });

  router.post("/", (req: Request, res: Response) => {
    const user = req.authUser;
    if (!user) throw new AppError(401, "Sign in required.");
    const { subject, message, jobId, priority, category } = req.body as {
      subject?: string;
      message?: string;
      jobId?: string;
      priority?: "low" | "medium" | "high";
      category?: "bug" | "billing" | "feature" | "other";
    };

    if (!subject || typeof subject !== "string" || !subject.trim()) {
      throw new AppError(400, "Subject is required.");
    }
    if (!message || typeof message !== "string" || !message.trim()) {
      throw new AppError(400, "Message description is required.");
    }

    const ticket = createTicket({
      userId: user.id,
      userEmail: user.email,
      subject,
      message,
      jobId,
      priority,
      category,
    });
    res.status(201).json({ ticket });
  });

  router.get("/:id", (req: Request, res: Response) => {
    const user = req.authUser;
    if (!user) throw new AppError(401, "Sign in required.");
    const ticket = getTicket(req.params.id);
    if (!ticket || (ticket.userId !== user.id && !isAdminRole(user.role))) {
      throw new AppError(404, "Ticket not found.");
    }
    res.json({ ticket });
  });

  router.post("/:id/reply", (req: Request, res: Response) => {
    const user = req.authUser;
    if (!user) throw new AppError(401, "Sign in required.");
    const ticket = getTicket(req.params.id);
    if (!ticket || (ticket.userId !== user.id && !isAdminRole(user.role))) {
      throw new AppError(404, "Ticket not found.");
    }
    const { message } = req.body as { message?: string };
    if (!message || typeof message !== "string" || !message.trim()) {
      throw new AppError(400, "Reply message cannot be empty.");
    }

    const updated = addTicketResponse({
      ticketId: ticket.id,
      author: isAdminRole(user.role) ? "admin" : "user",
      authorEmail: user.email,
      message,
    });
    res.json({ ticket: updated });
  });

  return router;
}

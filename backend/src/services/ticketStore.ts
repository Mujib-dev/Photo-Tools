import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";

export interface TicketResponse {
  id: string;
  author: "user" | "admin";
  authorEmail: string;
  message: string;
  createdAt: number;
}

export interface SupportTicket {
  id: string;
  userId: string;
  userEmail: string;
  jobId?: string | null;
  subject: string;
  message: string;
  status: "open" | "in_progress" | "resolved";
  priority: "low" | "medium" | "high";
  category: "bug" | "billing" | "feature" | "other";
  responses: TicketResponse[];
  createdAt: number;
  updatedAt: number;
}

const dataFile = path.join(path.dirname(config.authDbPath), "support_tickets.json");

let tickets: SupportTicket[] = [];

try {
  if (fs.existsSync(dataFile)) {
    const raw = fs.readFileSync(dataFile, "utf8");
    tickets = JSON.parse(raw) as SupportTicket[];
    if (!Array.isArray(tickets)) tickets = [];
  }
} catch (err) {
  logger.warn("Failed to load support tickets store; initializing empty", { err: String(err) });
}

function persist(): void {
  try {
    const dir = path.dirname(dataFile);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(dataFile, JSON.stringify(tickets, null, 2), "utf8");
  } catch (err) {
    logger.error("Failed to persist support tickets store", { err: String(err) });
  }
}

export function createTicket(input: {
  userId: string;
  userEmail: string;
  subject: string;
  message: string;
  jobId?: string | null;
  priority?: "low" | "medium" | "high";
  category?: "bug" | "billing" | "feature" | "other";
}): SupportTicket {
  const now = Date.now();
  const ticket: SupportTicket = {
    id: `tkt_${crypto.randomUUID().slice(0, 8)}`,
    userId: input.userId,
    userEmail: input.userEmail,
    subject: input.subject.trim(),
    message: input.message.trim(),
    jobId: input.jobId?.trim() || null,
    status: "open",
    priority: input.priority ?? "medium",
    category: input.category ?? "bug",
    responses: [],
    createdAt: now,
    updatedAt: now,
  };
  tickets.unshift(ticket);
  persist();
  return ticket;
}

export function listUserTickets(userId: string): SupportTicket[] {
  return tickets.filter((t) => t.userId === userId);
}

export function listAllTickets(filters?: {
  status?: string;
  priority?: string;
  category?: string;
  search?: string;
}): SupportTicket[] {
  let result = [...tickets];
  if (filters?.status) {
    result = result.filter((t) => t.status === filters.status);
  }
  if (filters?.priority) {
    result = result.filter((t) => t.priority === filters.priority);
  }
  if (filters?.category) {
    result = result.filter((t) => t.category === filters.category);
  }
  if (filters?.search) {
    const q = filters.search.toLowerCase();
    result = result.filter(
      (t) =>
        t.subject.toLowerCase().includes(q) ||
        t.userEmail.toLowerCase().includes(q) ||
        t.id.toLowerCase().includes(q) ||
        (t.jobId && t.jobId.toLowerCase().includes(q)),
    );
  }
  return result;
}

export function getTicket(id: string): SupportTicket | null {
  return tickets.find((t) => t.id === id) ?? null;
}

export function addTicketResponse(input: {
  ticketId: string;
  author: "user" | "admin";
  authorEmail: string;
  message: string;
  newStatus?: "open" | "in_progress" | "resolved";
}): SupportTicket | null {
  const ticket = tickets.find((t) => t.id === input.ticketId);
  if (!ticket) return null;

  const response: TicketResponse = {
    id: crypto.randomUUID(),
    author: input.author,
    authorEmail: input.authorEmail,
    message: input.message.trim(),
    createdAt: Date.now(),
  };

  ticket.responses.push(response);
  ticket.updatedAt = Date.now();
  if (input.newStatus) {
    ticket.status = input.newStatus;
  } else if (input.author === "admin" && ticket.status === "open") {
    ticket.status = "in_progress";
  }
  persist();
  return ticket;
}

export function updateTicketStatus(
  id: string,
  patch: { status?: "open" | "in_progress" | "resolved"; priority?: "low" | "medium" | "high" },
): SupportTicket | null {
  const ticket = tickets.find((t) => t.id === id);
  if (!ticket) return null;
  if (patch.status) ticket.status = patch.status;
  if (patch.priority) ticket.priority = patch.priority;
  ticket.updatedAt = Date.now();
  persist();
  return ticket;
}

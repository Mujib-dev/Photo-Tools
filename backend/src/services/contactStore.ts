import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { config } from "../config.js";
import { logger } from "../utils/logger.js";

/**
 * Durable store of contact-form submissions so the admin console can
 * review, mark as read, and manage customer inquiries.
 */
export interface ContactSubmission {
  id: string;
  at: number;
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  status: "unread" | "read";
}

const MAX_ENTRIES = 500;
const submissions: ContactSubmission[] = [];
let initialized = false;

function getStoreFilePath(): string {
  const dir = path.dirname(config.authDbPath);
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  } catch {}
  return path.join(dir, "contact_submissions.json");
}

function loadPersistedContacts(): void {
  if (initialized) return;
  initialized = true;
  try {
    const file = getStoreFilePath();
    if (!fs.existsSync(file)) return;
    const content = fs.readFileSync(file, "utf8");
    const parsed = JSON.parse(content) as ContactSubmission[];
    if (Array.isArray(parsed)) {
      submissions.splice(
        0,
        submissions.length,
        ...parsed.map((item) => ({ ...item, status: item.status ?? "unread" })),
      );
    }
  } catch (err) {
    logger.warn("Could not load persisted contact submissions", { error: String(err) });
  }
}

function saveContacts(): void {
  try {
    const file = getStoreFilePath();
    fs.writeFileSync(file, JSON.stringify(submissions.slice(0, MAX_ENTRIES), null, 2), "utf8");
  } catch (err) {
    logger.warn("Could not save contact submissions to disk", { error: String(err) });
  }
}

export function recordContact(
  input: Omit<ContactSubmission, "id" | "at" | "status"> & { status?: "unread" | "read" },
): ContactSubmission {
  loadPersistedContacts();
  const entry: ContactSubmission = {
    id: randomUUID(),
    at: Date.now(),
    status: input.status ?? "unread",
    ...input,
  };
  submissions.unshift(entry);
  if (submissions.length > MAX_ENTRIES) submissions.length = MAX_ENTRIES;
  saveContacts();
  return entry;
}

export function listContacts(limit = 200): ContactSubmission[] {
  loadPersistedContacts();
  return submissions.slice(0, Math.max(0, Math.trunc(limit)));
}

export function updateContactStatus(id: string, status: "unread" | "read"): boolean {
  loadPersistedContacts();
  const item = submissions.find((entry) => entry.id === id);
  if (!item) return false;
  item.status = status;
  saveContacts();
  return true;
}

export function deleteContact(id: string): boolean {
  loadPersistedContacts();
  const index = submissions.findIndex((entry) => entry.id === id);
  if (index < 0) return false;
  submissions.splice(index, 1);
  saveContacts();
  return true;
}

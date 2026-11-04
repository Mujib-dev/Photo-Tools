import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { config } from "../config.js";
import { logger } from "../utils/logger.js";

/**
 * Durable, append-only audit trail of privileged (admin) actions.
 * Persisted to disk across server restarts and mirrored in-memory for instant lookups.
 */
export interface AuditEntry {
  id: string;
  at: number;
  actorId: string;
  actorEmail: string;
  action: string;
  target: string | null;
  detail: string | null;
  ip: string | null;
}

const MAX_ENTRIES = 1000;
const entries: AuditEntry[] = [];
let initialized = false;

function getLogFilePath(): string {
  const dir = path.dirname(config.authDbPath);
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  } catch {}
  return path.join(dir, "admin_audit_logs.jsonl");
}

function loadPersistedLogs(): void {
  if (initialized) return;
  initialized = true;
  try {
    const file = getLogFilePath();
    if (!fs.existsSync(file)) return;
    const content = fs.readFileSync(file, "utf8");
    const lines = content.split("\n").filter((l) => l.trim().length > 0);
    // Take the last MAX_ENTRIES lines
    const parsed: AuditEntry[] = [];
    for (let i = lines.length - 1; i >= 0 && parsed.length < MAX_ENTRIES; i--) {
      try {
        const item = JSON.parse(lines[i]) as AuditEntry;
        if (item && item.id && item.action) parsed.push(item);
      } catch {}
    }
    entries.splice(0, entries.length, ...parsed);
  } catch (err) {
    logger.warn("Could not load persisted audit logs", { error: String(err) });
  }
}

export type AuditInput = Omit<AuditEntry, "id" | "at">;

export function recordAudit(input: AuditInput): AuditEntry {
  loadPersistedLogs();
  const entry: AuditEntry = { id: randomUUID(), at: Date.now(), ...input };
  entries.unshift(entry);
  if (entries.length > MAX_ENTRIES) entries.length = MAX_ENTRIES;

  // Append to durable audit log file
  try {
    const file = getLogFilePath();
    fs.appendFileSync(file, JSON.stringify(entry) + "\n", "utf8");
  } catch (err) {
    logger.warn("Could not write to audit log file", { error: String(err) });
  }

  logger.info("Admin action", {
    action: entry.action,
    actor: entry.actorEmail,
    target: entry.target,
    ip: entry.ip,
  });
  return entry;
}

export function listAudit(limit = 200): AuditEntry[] {
  loadPersistedLogs();
  return entries.slice(0, Math.max(0, Math.trunc(limit)));
}

/** Test-only helper. */
export function clearAudit(): void {
  entries.length = 0;
  initialized = true;
}

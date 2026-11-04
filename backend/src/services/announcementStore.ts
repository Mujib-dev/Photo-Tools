import fs from "node:fs";
import path from "node:path";

import { config } from "../config.js";
import { logger } from "../utils/logger.js";

export interface SiteAnnouncement {
  active: boolean;
  message: string;
  link: string | null;
  tone: "info" | "warning" | "sale";
  updatedAt: number;
}

const DEFAULT_ANNOUNCEMENT: SiteAnnouncement = {
  active: false,
  message: "",
  link: null,
  tone: "info",
  updatedAt: Date.now(),
};

let current: SiteAnnouncement = { ...DEFAULT_ANNOUNCEMENT };
let initialized = false;

function getStoreFilePath(): string {
  const dir = path.dirname(config.authDbPath);
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  } catch {}
  return path.join(dir, "site_announcement.json");
}

function loadAnnouncement(): void {
  if (initialized) return;
  initialized = true;
  try {
    const file = getStoreFilePath();
    if (!fs.existsSync(file)) return;
    const content = fs.readFileSync(file, "utf8");
    const parsed = JSON.parse(content) as Partial<SiteAnnouncement>;
    if (parsed && typeof parsed.message === "string") {
      current = {
        active: Boolean(parsed.active),
        message: parsed.message,
        link: parsed.link ?? null,
        tone: parsed.tone === "warning" || parsed.tone === "sale" ? parsed.tone : "info",
        updatedAt: parsed.updatedAt ?? Date.now(),
      };
    }
  } catch (err) {
    logger.warn("Could not load site announcement", { error: String(err) });
  }
}

function saveAnnouncement(): void {
  try {
    const file = getStoreFilePath();
    fs.writeFileSync(file, JSON.stringify(current, null, 2), "utf8");
  } catch (err) {
    logger.warn("Could not save site announcement", { error: String(err) });
  }
}

export function getAnnouncement(): SiteAnnouncement {
  loadAnnouncement();
  return { ...current };
}

export function updateAnnouncement(patch: Partial<SiteAnnouncement>): SiteAnnouncement {
  loadAnnouncement();
  current = {
    ...current,
    ...patch,
    updatedAt: Date.now(),
  };
  saveAnnouncement();
  return { ...current };
}

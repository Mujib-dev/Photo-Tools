import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";

export interface WebhookEndpoint {
  id: string;
  userId: string;
  url: string;
  events: string[];
  secret: string;
  active: boolean;
  createdAt: number;
}

export interface WebhookDeliveryLog {
  id: string;
  endpointId: string;
  userId: string;
  event: string;
  status: number;
  durationMs: number;
  timestamp: number;
  success: boolean;
  responsePreview?: string;
}

interface WebhookData {
  endpoints: WebhookEndpoint[];
  logs: WebhookDeliveryLog[];
}

const dataFile = path.join(path.dirname(config.authDbPath), "webhooks_store.json");

let state: WebhookData = {
  endpoints: [],
  logs: [],
};

try {
  if (fs.existsSync(dataFile)) {
    const raw = fs.readFileSync(dataFile, "utf8");
    state = JSON.parse(raw) as WebhookData;
    if (!Array.isArray(state.endpoints)) state.endpoints = [];
    if (!Array.isArray(state.logs)) state.logs = [];
  }
} catch (err) {
  logger.warn("Failed to load webhooks store; initializing empty", { err: String(err) });
}

function persist(): void {
  try {
    const dir = path.dirname(dataFile);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    // Keep max 500 recent logs
    if (state.logs.length > 500) {
      state.logs = state.logs.slice(-500);
    }
    fs.writeFileSync(dataFile, JSON.stringify(state, null, 2), "utf8");
  } catch (err) {
    logger.error("Failed to persist webhooks store", { err: String(err) });
  }
}

export function listUserWebhooks(userId: string): WebhookEndpoint[] {
  return state.endpoints.filter((e) => e.userId === userId);
}

export function createWebhook(input: {
  userId: string;
  url: string;
  events: string[];
}): WebhookEndpoint {
  const secret = `whsec_${crypto.randomBytes(24).toString("hex")}`;
  const endpoint: WebhookEndpoint = {
    id: crypto.randomUUID(),
    userId: input.userId,
    url: input.url,
    events: input.events.length > 0 ? input.events : ["job.completed", "job.failed"],
    secret,
    active: true,
    createdAt: Date.now(),
  };
  state.endpoints.push(endpoint);
  persist();
  return endpoint;
}

export function deleteWebhook(userId: string, id: string): boolean {
  const idx = state.endpoints.findIndex((e) => e.id === id && e.userId === userId);
  if (idx === -1) return false;
  state.endpoints.splice(idx, 1);
  persist();
  return true;
}

export function toggleWebhook(userId: string, id: string, active: boolean): WebhookEndpoint | null {
  const ep = state.endpoints.find((e) => e.id === id && e.userId === userId);
  if (!ep) return null;
  ep.active = active;
  persist();
  return ep;
}

export function getWebhookLogs(userId: string, limit = 50): WebhookDeliveryLog[] {
  return state.logs
    .filter((l) => l.userId === userId)
    .slice(-limit)
    .reverse();
}

export async function sendWebhookPing(endpoint: WebhookEndpoint, event = "ping", payload: Record<string, unknown> = {}): Promise<WebhookDeliveryLog> {
  const startTime = Date.now();
  const body = JSON.stringify({
    id: `evt_${crypto.randomUUID()}`,
    event,
    createdAt: Date.now(),
    data: payload,
  });

  const timestamp = Math.floor(Date.now() / 1000);
  const hmac = crypto.createHmac("sha256", endpoint.secret);
  hmac.update(`${timestamp}.${body}`);
  const signature = `t=${timestamp},v1=${hmac.digest("hex")}`;

  let status = 0;
  let success = false;
  let responsePreview = "";

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(endpoint.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "PicTools-Webhooks/2.0",
        "X-PicTools-Signature": signature,
      },
      body,
      signal: controller.signal,
    });
    clearTimeout(timer);
    status = res.status;
    success = res.ok;
    responsePreview = (await res.text()).slice(0, 200);
  } catch (err: unknown) {
    status = 504;
    success = false;
    responsePreview = err instanceof Error ? err.message : String(err);
  }

  const durationMs = Date.now() - startTime;
  const log: WebhookDeliveryLog = {
    id: crypto.randomUUID(),
    endpointId: endpoint.id,
    userId: endpoint.userId,
    event,
    status,
    durationMs,
    timestamp: Date.now(),
    success,
    responsePreview,
  };

  state.logs.push(log);
  persist();
  return log;
}

export function triggerUserWebhooks(userId: string, event: string, data: Record<string, unknown>): void {
  const endpoints = state.endpoints.filter((e) => e.userId === userId && e.active && e.events.includes(event));
  for (const ep of endpoints) {
    void sendWebhookPing(ep, event, data);
  }
}

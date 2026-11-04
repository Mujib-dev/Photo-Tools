import { errorFrom, request as authRequest } from "./auth";
import type { PromoKind } from "./promo";
import type {
  AdminActivityItem,
  AdminAuditEntry,
  AdminConfigSnapshot,
  AdminContactEntry,
  AdminJobAnalytics,
  AdminJobRecord,
  AdminOverview,
  AdminUserRecord,
  AdminRevenueMetrics,
  AffiliateProfile,
  DiagnosticResult,
  PayoutRequest,
  SiteAnnouncement,
  SupportTicket,
  AdminPermission,
  UserPlan,
  UserRole,
  UserStatus,
} from "./types";

/**
 * Client for the admin console. Every call goes through the BFF proxy, which
 * carries the session cookie; the backend rejects non-administrators with 403.
 */

let activeSudoToken: string | null = null;
let sudoExpiresAt = 0;

export function setSudoToken(token: string, expiresAt: number): void {
  activeSudoToken = token;
  sudoExpiresAt = expiresAt;
}

export function getSudoToken(): string | null {
  if (activeSudoToken && Date.now() < sudoExpiresAt) {
    return activeSudoToken;
  }
  activeSudoToken = null;
  return null;
}

export function clearSudoToken(): void {
  activeSudoToken = null;
  sudoExpiresAt = 0;
}

export function hasActiveSudo(): boolean {
  return Boolean(getSudoToken());
}

export async function requestSudo(password: string): Promise<string> {
  const res = await request("/sudo", jsonInit("POST", { password }));
  const data = (await res.json()) as { ok: boolean; sudoToken: string; expiresAt: number };
  setSudoToken(data.sudoToken, data.expiresAt);
  return data.sudoToken;
}

export const adminKeys = {
  all: ["admin"] as const,
  overview: ["admin", "overview"] as const,
  users: (filters?: { search?: string; role?: string; plan?: string; status?: string }) =>
    ["admin", "users", filters] as const,
  jobsRoot: ["admin", "jobs"] as const,
  jobs: (state: string = "all") => [...adminKeys.jobsRoot, state] as const,
  contacts: ["admin", "contacts"] as const,
  promos: ["admin", "promos"] as const,
  audit: ["admin", "audit"] as const,
  config: ["admin", "config"] as const,
  activity: ["admin", "activity"] as const,
  analytics: (days: number) => ["admin", "analytics", days] as const,
  announcement: ["admin", "announcement"] as const,
  diagnostics: ["admin", "diagnostics"] as const,
};

async function request(path: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  const sudo = getSudoToken();
  if (sudo) {
    headers.set("X-Admin-Sudo", sudo);
  }
  const res = await authRequest(`/api/backend/admin${path}`, {
    ...init,
    headers,
  });
  if (!res.ok) throw await errorFrom(res);
  return res;
}

function jsonInit(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

export async function getOverview(): Promise<AdminOverview> {
  const res = await request("/overview");
  return (await res.json()) as AdminOverview;
}

export async function getAnalytics(days = 30): Promise<AdminJobAnalytics> {
  const res = await request(`/analytics?days=${days}`);
  return (await res.json()) as AdminJobAnalytics;
}

export async function listUsers(filters?: {
  search?: string;
  role?: string;
  plan?: string;
  status?: string;
}): Promise<AdminUserRecord[]> {
  const params = new URLSearchParams();
  if (filters?.search) params.set("search", filters.search);
  if (filters?.role && filters.role !== "all") params.set("role", filters.role);
  if (filters?.plan && filters.plan !== "all") params.set("plan", filters.plan);
  if (filters?.status && filters.status !== "all") params.set("status", filters.status);

  const query = params.toString() ? `?${params.toString()}` : "";
  const res = await request(`/users${query}`);
  const body = (await res.json()) as { users: AdminUserRecord[] };
  return body.users;
}

export async function createUser(
  email: string,
  password: string,
  role: UserRole,
  permissions?: AdminPermission[],
): Promise<AdminUserRecord> {
  const res = await request("/users", jsonInit("POST", { email, password, role, permissions }));
  const body = (await res.json()) as { user: AdminUserRecord };
  return body.user;
}

export async function updateUser(
  id: string,
  patch: {
    role?: UserRole;
    permissions?: AdminPermission[];
    password?: string;
    status?: UserStatus;
    banReason?: string | null;
  },
): Promise<AdminUserRecord | null> {
  const res = await request(`/users/${encodeURIComponent(id)}`, jsonInit("PATCH", patch));
  const body = (await res.json()) as { user: AdminUserRecord | null };
  return body.user;
}

export async function impersonateUser(
  id: string,
): Promise<{ ok: boolean; accessToken: string; expiresAt: number; user: AdminUserRecord }> {
  const res = await request(`/users/${encodeURIComponent(id)}/impersonate`, { method: "POST" });
  return (await res.json()) as { ok: boolean; accessToken: string; expiresAt: number; user: AdminUserRecord };
}

export async function revokeUser(id: string): Promise<void> {
  await request(`/users/${encodeURIComponent(id)}/revoke`, { method: "POST" });
}

export async function deleteUser(id: string): Promise<void> {
  await request(`/users/${encodeURIComponent(id)}`, { method: "DELETE" });
}

/**
 * Grant (positive) or take back (negative) credits. A negative adjustment
 * never pushes the balance below zero.
 */
export async function adjustCredits(id: string, amount: number): Promise<AdminUserRecord | null> {
  const res = await request(
    `/users/${encodeURIComponent(id)}/credits`,
    jsonInit("POST", { amount }),
  );
  const body = (await res.json()) as { user: AdminUserRecord | null };
  return body.user;
}

/** Move an account between the free, pro and business plans. */
export async function changePlan(id: string, plan: UserPlan): Promise<AdminUserRecord | null> {
  const res = await request(
    `/users/${encodeURIComponent(id)}/plan`,
    jsonInit("POST", { plan }),
  );
  const body = (await res.json()) as { user: AdminUserRecord | null };
  return body.user;
}

/** Run the weekly usage digest immediately instead of waiting for the cron. */
export async function runDigests(): Promise<{ sent: number; due: number; skipped: number }> {
  const res = await request("/digests/run", { method: "POST" });
  return (await res.json()) as { sent: number; due: number; skipped: number };
}

/** Delete expired jobs and expired sessions right now. */
export async function runSweep(): Promise<{ ok: boolean; prunedJobs: number }> {
  const res = await request("/maintenance/sweep", { method: "POST" });
  return (await res.json()) as { ok: boolean; prunedJobs: number };
}

export async function listJobs(limit = 100, state?: string): Promise<AdminJobRecord[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (state) params.set("state", state);
  const res = await request(`/jobs?${params.toString()}`);
  const body = (await res.json()) as { jobs: AdminJobRecord[] };
  return body.jobs;
}

export async function deleteJob(id: string): Promise<void> {
  await request(`/jobs/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function retryJob(id: string): Promise<{ ok: boolean; job: AdminJobRecord }> {
  const res = await request(`/jobs/${encodeURIComponent(id)}/retry`, { method: "POST" });
  return (await res.json()) as { ok: boolean; job: AdminJobRecord };
}

export async function runTempCleanup(): Promise<{ ok: boolean; removedCount: number; freedBytes: number }> {
  const res = await request("/maintenance/temp-cleanup", { method: "POST" });
  return (await res.json()) as { ok: boolean; removedCount: number; freedBytes: number };
}

export async function getAnnouncement(): Promise<SiteAnnouncement> {
  const res = await request("/announcement");
  const body = (await res.json()) as { announcement: SiteAnnouncement };
  return body.announcement;
}

export async function updateAnnouncement(patch: Partial<SiteAnnouncement>): Promise<SiteAnnouncement> {
  const res = await request("/announcement", jsonInit("POST", patch));
  const body = (await res.json()) as { announcement: SiteAnnouncement };
  return body.announcement;
}

export async function runDiagnostics(): Promise<{ results: DiagnosticResult[]; testedAt: number }> {
  const res = await request("/diagnostics/run", { method: "POST" });
  return (await res.json()) as { results: DiagnosticResult[]; testedAt: number };
}

export async function updateContactStatus(id: string, status: "unread" | "read"): Promise<void> {
  await request(`/contact/${encodeURIComponent(id)}`, jsonInit("PATCH", { status }));
}

export async function getConfig(): Promise<AdminConfigSnapshot> {
  const res = await request("/config");
  const body = (await res.json()) as { config: AdminConfigSnapshot };
  return body.config;
}

export async function getActivity(limit = 50): Promise<AdminActivityItem[]> {
  const res = await request(`/activity?limit=${limit}`);
  const body = (await res.json()) as { items: AdminActivityItem[] };
  return body.items;
}

export async function listAudit(limit = 200): Promise<AdminAuditEntry[]> {
  const res = await request(`/audit?limit=${limit}`);
  const body = (await res.json()) as { entries: AdminAuditEntry[] };
  return body.entries;
}

export async function listContacts(limit = 200): Promise<AdminContactEntry[]> {
  const res = await request(`/contact?limit=${limit}`);
  const body = (await res.json()) as { submissions: AdminContactEntry[] };
  return body.submissions;
}

export async function deleteContact(id: string): Promise<void> {
  await request(`/contact/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function getRevenueMetrics(): Promise<AdminRevenueMetrics> {
  const res = await request("/revenue");
  const body = (await res.json()) as { revenue: AdminRevenueMetrics };
  return body.revenue;
}

export async function listAdminTickets(filters?: {
  status?: string;
  priority?: string;
  category?: string;
  search?: string;
}): Promise<SupportTicket[]> {
  const p = new URLSearchParams();
  if (filters?.status) p.set("status", filters.status);
  if (filters?.priority) p.set("priority", filters.priority);
  if (filters?.category) p.set("category", filters.category);
  if (filters?.search) p.set("search", filters.search);
  const res = await request(`/tickets?${p.toString()}`);
  const body = (await res.json()) as { tickets: SupportTicket[] };
  return body.tickets;
}

export async function updateAdminTicket(
  id: string,
  patch: { status?: "open" | "in_progress" | "resolved"; priority?: "low" | "medium" | "high" },
): Promise<SupportTicket> {
  const res = await request(`/tickets/${encodeURIComponent(id)}`, jsonInit("PATCH", patch));
  const body = (await res.json()) as { ticket: SupportTicket };
  return body.ticket;
}

export async function replyAdminTicket(
  id: string,
  message: string,
  status?: "open" | "in_progress" | "resolved",
): Promise<SupportTicket> {
  const res = await request(`/tickets/${encodeURIComponent(id)}/reply`, jsonInit("POST", { message, status }));
  const body = (await res.json()) as { ticket: SupportTicket };
  return body.ticket;
}

export async function listAdminAffiliates(): Promise<AffiliateProfile[]> {
  const res = await request("/affiliates");
  const body = (await res.json()) as { affiliates: AffiliateProfile[] };
  return body.affiliates;
}

export async function listAdminPayouts(): Promise<PayoutRequest[]> {
  const res = await request("/affiliates/payouts");
  const body = (await res.json()) as { payouts: PayoutRequest[] };
  return body.payouts;
}

export async function processAdminPayout(
  id: string,
  status: "paid" | "rejected",
  notes?: string,
): Promise<PayoutRequest> {
  const res = await request(`/affiliates/payouts/${encodeURIComponent(id)}`, jsonInit("PATCH", { status, notes }));
  const body = (await res.json()) as { payout: PayoutRequest };
  return body.payout;
}

// --- promo codes ---------------------------------------------------------

export interface AdminPromoRecord {
  id: string;
  code: string;
  description: string;
  kind: PromoKind;
  credits: number;
  plan: UserPlan | null;
  planDays: number;
  percentOff: number;
  maxRedemptions: number | null;
  maxPerUser: number;
  redeemedCount: number;
  expiresAt: number | null;
  active: boolean;
  createdAt: number;
}

export interface AdminPromoRedemption {
  id: string;
  promoId: string;
  code: string;
  userId: string;
  creditsGranted: number;
  createdAt: number;
}

export async function listPromos(): Promise<AdminPromoRecord[]> {
  const res = await request("/promos");
  const body = (await res.json()) as { promos: AdminPromoRecord[] };
  return body.promos;
}

export async function createPromo(input: {
  code: string;
  description?: string;
  kind: PromoKind;
  credits?: number;
  plan?: UserPlan | null;
  planDays?: number;
  percentOff?: number;
  maxRedemptions?: number | null;
  maxPerUser?: number;
  expiresAt?: number | null;
}): Promise<AdminPromoRecord> {
  const res = await request("/promos", jsonInit("POST", input));
  const body = (await res.json()) as { promo: AdminPromoRecord };
  return body.promo;
}

export async function updatePromo(
  id: string,
  patch: Partial<{
    description: string;
    active: boolean;
    maxPerUser: number;
    maxRedemptions: number | null;
    expiresAt: number | null;
    kind: PromoKind;
    credits: number;
    plan: UserPlan | null;
    planDays: number;
    percentOff: number;
  }>,
): Promise<AdminPromoRecord | null> {
  const res = await request(`/promos/${encodeURIComponent(id)}`, jsonInit("PATCH", patch));
  const body = (await res.json()) as { promo: AdminPromoRecord | null };
  return body.promo;
}

export async function deletePromo(id: string): Promise<void> {
  await request(`/promos/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function listPromoRedemptions(id: string): Promise<AdminPromoRedemption[]> {
  const res = await request(`/promos/${encodeURIComponent(id)}/redemptions`);
  const body = (await res.json()) as { redemptions: AdminPromoRedemption[] };
  return body.redemptions;
}

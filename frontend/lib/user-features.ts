import { request } from "./auth";
import type {
  AffiliateProfile,
  PayoutRequest,
  SupportTicket,
  TeamWorkspace,
  WebhookDeliveryLog,
  WebhookEndpoint,
} from "./types";

function jsonInit(method: "POST" | "PATCH" | "PUT", body: unknown): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

// --- Webhooks -------------------------------------------------------------

export async function listUserWebhooks(): Promise<{ webhooks: WebhookEndpoint[]; logs: WebhookDeliveryLog[] }> {
  const res = await request("/webhooks");
  return (await res.json()) as { webhooks: WebhookEndpoint[]; logs: WebhookDeliveryLog[] };
}

export async function createUserWebhook(input: { url: string; events: string[] }): Promise<WebhookEndpoint> {
  const res = await request("/webhooks", jsonInit("POST", input));
  const data = (await res.json()) as { webhook: WebhookEndpoint };
  return data.webhook;
}

export async function deleteUserWebhook(id: string): Promise<void> {
  await request(`/webhooks/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function toggleUserWebhook(id: string, active: boolean): Promise<WebhookEndpoint> {
  const res = await request(`/webhooks/${encodeURIComponent(id)}`, jsonInit("PATCH", { active }));
  const data = (await res.json()) as { webhook: WebhookEndpoint };
  return data.webhook;
}

export async function testUserWebhook(id: string): Promise<{ ok: boolean; log: WebhookDeliveryLog }> {
  const res = await request(`/webhooks/${encodeURIComponent(id)}/test`, { method: "POST" });
  return (await res.json()) as { ok: boolean; log: WebhookDeliveryLog };
}

// --- Support Tickets ------------------------------------------------------

export async function listMyTickets(): Promise<SupportTicket[]> {
  const res = await request("/support/tickets");
  const data = (await res.json()) as { tickets: SupportTicket[] };
  return data.tickets;
}

export async function createSupportTicket(input: {
  subject: string;
  message: string;
  jobId?: string;
  priority?: "low" | "medium" | "high";
  category?: "bug" | "billing" | "feature" | "other";
}): Promise<SupportTicket> {
  const res = await request("/support/tickets", jsonInit("POST", input));
  const data = (await res.json()) as { ticket: SupportTicket };
  return data.ticket;
}

export async function replySupportTicket(id: string, message: string): Promise<SupportTicket> {
  const res = await request(`/support/tickets/${encodeURIComponent(id)}/reply`, jsonInit("POST", { message }));
  const data = (await res.json()) as { ticket: SupportTicket };
  return data.ticket;
}

// --- Affiliate Program ----------------------------------------------------

export async function getAffiliateProfile(): Promise<{ profile: AffiliateProfile; payouts: PayoutRequest[] }> {
  const res = await request("/affiliate");
  return (await res.json()) as { profile: AffiliateProfile; payouts: PayoutRequest[] };
}

export async function updatePayoutSettings(input: {
  method: "paypal" | "stripe" | "bank" | "crypto";
  details: string;
}): Promise<AffiliateProfile> {
  const res = await request("/affiliate/payout-settings", jsonInit("PATCH", input));
  const data = (await res.json()) as { profile: AffiliateProfile };
  return data.profile;
}

export async function requestAffiliatePayout(): Promise<PayoutRequest> {
  const res = await request("/affiliate/payout", { method: "POST" });
  const data = (await res.json()) as { payout: PayoutRequest };
  return data.payout;
}

// --- Team Workspaces ------------------------------------------------------

export async function getMyTeam(): Promise<TeamWorkspace | null> {
  const res = await request("/teams");
  const data = (await res.json()) as { team: TeamWorkspace | null };
  return data.team;
}

export async function createTeam(name: string): Promise<TeamWorkspace> {
  const res = await request("/teams", jsonInit("POST", { name }));
  const data = (await res.json()) as { team: TeamWorkspace };
  return data.team;
}

export async function inviteTeamMember(email: string, role: "editor" | "viewer"): Promise<{ id: string; email: string; token: string }> {
  const res = await request("/teams/invite", jsonInit("POST", { email, role }));
  const data = (await res.json()) as { invite: { id: string; email: string; token: string } };
  return data.invite;
}

export async function acceptTeamInvitation(token: string): Promise<TeamWorkspace> {
  const res = await request("/teams/accept-invite", jsonInit("POST", { token }));
  const data = (await res.json()) as { team: TeamWorkspace };
  return data.team;
}

export async function removeTeamMember(memberId: string): Promise<void> {
  await request(`/teams/members/${encodeURIComponent(memberId)}`, { method: "DELETE" });
}

export async function updateTeamSettings(patch: {
  name?: string;
  sharedCredits?: boolean;
  monthlyCreditCapPerMember?: number | null;
}): Promise<TeamWorkspace> {
  const res = await request("/teams/settings", jsonInit("PATCH", patch));
  const data = (await res.json()) as { team: TeamWorkspace };
  return data.team;
}

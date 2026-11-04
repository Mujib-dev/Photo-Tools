import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";

export interface AffiliateProfile {
  userId: string;
  userEmail: string;
  code: string;
  clicks: number;
  signups: number;
  paidConversions: number;
  commissionRatePercent: number; // e.g. 25%
  totalEarnedCents: number;
  paidOutCents: number;
  pendingBalanceCents: number;
  payoutMethod: "paypal" | "stripe" | "bank" | "crypto";
  payoutDetails: string;
  createdAt: number;
}

export interface PayoutRequest {
  id: string;
  userId: string;
  userEmail: string;
  amountCents: number;
  method: string;
  details: string;
  status: "pending" | "paid" | "rejected";
  requestedAt: number;
  processedAt?: number;
  notes?: string;
}

interface AffiliateState {
  affiliates: AffiliateProfile[];
  payouts: PayoutRequest[];
}

const dataFile = path.join(path.dirname(config.authDbPath), "affiliates_store.json");

let state: AffiliateState = {
  affiliates: [],
  payouts: [],
};

try {
  if (fs.existsSync(dataFile)) {
    const raw = fs.readFileSync(dataFile, "utf8");
    state = JSON.parse(raw) as AffiliateState;
    if (!Array.isArray(state.affiliates)) state.affiliates = [];
    if (!Array.isArray(state.payouts)) state.payouts = [];
  }
} catch (err) {
  logger.warn("Failed to load affiliates store; initializing empty", { err: String(err) });
}

function persist(): void {
  try {
    const dir = path.dirname(dataFile);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(dataFile, JSON.stringify(state, null, 2), "utf8");
  } catch (err) {
    logger.error("Failed to persist affiliates store", { err: String(err) });
  }
}

export function getOrCreateAffiliate(userId: string, userEmail: string, defaultCode: string): AffiliateProfile {
  let profile = state.affiliates.find((a) => a.userId === userId);
  if (!profile) {
    profile = {
      userId,
      userEmail,
      code: defaultCode,
      clicks: 0,
      signups: 0,
      paidConversions: 0,
      commissionRatePercent: 25,
      totalEarnedCents: 0,
      paidOutCents: 0,
      pendingBalanceCents: 0,
      payoutMethod: "paypal",
      payoutDetails: userEmail,
      createdAt: Date.now(),
    };
    state.affiliates.push(profile);
    persist();
  }
  return profile;
}

export function updateAffiliatePayoutSettings(
  userId: string,
  method: "paypal" | "stripe" | "bank" | "crypto",
  details: string,
): AffiliateProfile | null {
  const profile = state.affiliates.find((a) => a.userId === userId);
  if (!profile) return null;
  profile.payoutMethod = method;
  profile.payoutDetails = details.trim();
  persist();
  return profile;
}

export function recordAffiliateClick(code: string): void {
  const profile = state.affiliates.find((a) => a.code.toUpperCase() === code.toUpperCase());
  if (profile) {
    profile.clicks += 1;
    persist();
  }
}

export function recordAffiliateSignup(code: string): void {
  const profile = state.affiliates.find((a) => a.code.toUpperCase() === code.toUpperCase());
  if (profile) {
    profile.signups += 1;
    persist();
  }
}

export function recordAffiliateCommission(code: string, purchaseAmountCents: number): void {
  const profile = state.affiliates.find((a) => a.code.toUpperCase() === code.toUpperCase());
  if (profile) {
    profile.paidConversions += 1;
    const earned = Math.round((purchaseAmountCents * profile.commissionRatePercent) / 100);
    profile.totalEarnedCents += earned;
    profile.pendingBalanceCents += earned;
    persist();
  }
}

export function requestAffiliatePayout(userId: string): PayoutRequest {
  const profile = state.affiliates.find((a) => a.userId === userId);
  if (!profile) throw new Error("Affiliate account not found.");
  if (profile.pendingBalanceCents < 2000) {
    throw new Error("Minimum payout threshold is $20.00 (2,000 cents).");
  }

  const req: PayoutRequest = {
    id: `pay_${crypto.randomUUID().slice(0, 8)}`,
    userId,
    userEmail: profile.userEmail,
    amountCents: profile.pendingBalanceCents,
    method: profile.payoutMethod,
    details: profile.payoutDetails,
    status: "pending",
    requestedAt: Date.now(),
  };

  profile.pendingBalanceCents = 0;
  state.payouts.unshift(req);
  persist();
  return req;
}

export function listAllAffiliates(): AffiliateProfile[] {
  return state.affiliates;
}

export function listAllPayoutRequests(): PayoutRequest[] {
  return state.payouts;
}

export function listUserPayouts(userId: string): PayoutRequest[] {
  return state.payouts.filter((p) => p.userId === userId);
}

export function updatePayoutRequestStatus(id: string, status: "paid" | "rejected", notes?: string): PayoutRequest | null {
  const payout = state.payouts.find((p) => p.id === id);
  if (!payout) return null;
  payout.status = status;
  payout.processedAt = Date.now();
  if (notes) payout.notes = notes;

  const profile = state.affiliates.find((a) => a.userId === payout.userId);
  if (profile) {
    if (status === "paid") {
      profile.paidOutCents += payout.amountCents;
    } else if (status === "rejected") {
      // Refund balance back to pending
      profile.pendingBalanceCents += payout.amountCents;
    }
  }

  persist();
  return payout;
}

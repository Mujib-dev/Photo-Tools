import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";

export interface TeamMember {
  userId: string;
  email: string;
  fullName: string | null;
  role: "owner" | "editor" | "viewer";
  creditsConsumed: number;
  joinedAt: number;
}

export interface TeamInvite {
  id: string;
  email: string;
  role: "editor" | "viewer";
  token: string;
  createdAt: number;
  expiresAt: number;
}

export interface TeamWorkspace {
  id: string;
  name: string;
  ownerId: string;
  sharedCredits: boolean;
  monthlyCreditCapPerMember: number | null;
  members: TeamMember[];
  invites: TeamInvite[];
  createdAt: number;
}

const dataFile = path.join(path.dirname(config.authDbPath), "teams_store.json");

let teams: TeamWorkspace[] = [];

try {
  if (fs.existsSync(dataFile)) {
    const raw = fs.readFileSync(dataFile, "utf8");
    teams = JSON.parse(raw) as TeamWorkspace[];
    if (!Array.isArray(teams)) teams = [];
  }
} catch (err) {
  logger.warn("Failed to load teams store; initializing empty", { err: String(err) });
}

function persist(): void {
  try {
    const dir = path.dirname(dataFile);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(dataFile, JSON.stringify(teams, null, 2), "utf8");
  } catch (err) {
    logger.error("Failed to persist teams store", { err: String(err) });
  }
}

export function getTeamForUser(userId: string): TeamWorkspace | null {
  return teams.find((t) => t.ownerId === userId || t.members.some((m) => m.userId === userId)) ?? null;
}

export function createTeamWorkspace(input: {
  ownerId: string;
  ownerEmail: string;
  ownerName: string | null;
  name: string;
}): TeamWorkspace {
  const existing = getTeamForUser(input.ownerId);
  if (existing) return existing;

  const team: TeamWorkspace = {
    id: `team_${crypto.randomUUID().slice(0, 8)}`,
    name: input.name.trim() || "My Team Workspace",
    ownerId: input.ownerId,
    sharedCredits: true,
    monthlyCreditCapPerMember: null,
    members: [
      {
        userId: input.ownerId,
        email: input.ownerEmail,
        fullName: input.ownerName,
        role: "owner",
        creditsConsumed: 0,
        joinedAt: Date.now(),
      },
    ],
    invites: [],
    createdAt: Date.now(),
  };

  teams.push(team);
  persist();
  return team;
}

export function inviteTeamMember(
  teamId: string,
  requesterId: string,
  email: string,
  role: "editor" | "viewer" = "editor",
): TeamInvite {
  const team = teams.find((t) => t.id === teamId);
  if (!team) throw new Error("Team not found.");
  const caller = team.members.find((m) => m.userId === requesterId);
  if (!caller || caller.role !== "owner") throw new Error("Only team owners can invite members.");

  const normalizedEmail = email.toLowerCase().trim();
  if (team.members.some((m) => m.email.toLowerCase() === normalizedEmail)) {
    throw new Error("User is already a member of this team.");
  }

  const existingInvite = team.invites.find((i) => i.email.toLowerCase() === normalizedEmail);
  if (existingInvite) {
    return existingInvite;
  }

  const invite: TeamInvite = {
    id: crypto.randomUUID(),
    email: normalizedEmail,
    role,
    token: `tminv_${crypto.randomBytes(16).toString("hex")}`,
    createdAt: Date.now(),
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
  };

  team.invites.push(invite);
  persist();
  return invite;
}

export function acceptTeamInvite(
  token: string,
  user: { id: string; email: string; fullName: string | null },
): TeamWorkspace {
  const team = teams.find((t) => t.invites.some((i) => i.token === token));
  if (!team) throw new Error("Invalid or expired invitation link.");
  const inviteIdx = team.invites.findIndex((i) => i.token === token);
  const invite = team.invites[inviteIdx];
  if (Date.now() > invite.expiresAt) {
    team.invites.splice(inviteIdx, 1);
    persist();
    throw new Error("This invitation has expired.");
  }

  team.invites.splice(inviteIdx, 1);
  if (!team.members.some((m) => m.userId === user.id)) {
    team.members.push({
      userId: user.id,
      email: user.email,
      fullName: user.fullName,
      role: invite.role,
      creditsConsumed: 0,
      joinedAt: Date.now(),
    });
  }
  persist();
  return team;
}

export function removeTeamMember(teamId: string, requesterId: string, targetUserId: string): boolean {
  const team = teams.find((t) => t.id === teamId);
  if (!team) return false;
  if (team.ownerId !== requesterId && requesterId !== targetUserId) {
    throw new Error("Unauthorized to remove member.");
  }
  if (targetUserId === team.ownerId) {
    throw new Error("Cannot remove the team owner.");
  }

  const idx = team.members.findIndex((m) => m.userId === targetUserId);
  if (idx === -1) return false;
  team.members.splice(idx, 1);
  persist();
  return true;
}

export function updateTeamSettings(
  teamId: string,
  requesterId: string,
  patch: { name?: string; sharedCredits?: boolean; monthlyCreditCapPerMember?: number | null },
): TeamWorkspace {
  const team = teams.find((t) => t.id === teamId);
  if (!team) throw new Error("Team not found.");
  if (team.ownerId !== requesterId) throw new Error("Only the team owner can edit settings.");

  if (typeof patch.name === "string" && patch.name.trim()) team.name = patch.name.trim();
  if (typeof patch.sharedCredits === "boolean") team.sharedCredits = patch.sharedCredits;
  if (patch.monthlyCreditCapPerMember !== undefined) team.monthlyCreditCapPerMember = patch.monthlyCreditCapPerMember;

  persist();
  return team;
}

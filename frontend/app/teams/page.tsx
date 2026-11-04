"use client";

import * as React from "react";
import {
  CheckCircle2,
  Copy,
  Crown,
  Link as LinkIcon,
  Mail,
  Plus,
  RefreshCw,
  Shield,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  createTeam,
  getMyTeam,
  inviteTeamMember,
  removeTeamMember,
  updateTeamSettings,
} from "@/lib/user-features";
import type { TeamWorkspace } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function TeamsPage() {
  const [team, setTeam] = React.useState<TeamWorkspace | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Creation & Invite state
  const [newTeamName, setNewTeamName] = React.useState("");
  const [inviteEmail, setInviteEmail] = React.useState("");
  const [inviteRole, setInviteRole] = React.useState<"editor" | "viewer">("editor");
  const [showInviteModal, setShowInviteModal] = React.useState(false);
  const [generatedInvite, setGeneratedInvite] = React.useState<{ id: string; email: string; token: string } | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getMyTeam();
      setTeam(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load team workspace.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamName.trim()) return;
    try {
      const created = await createTeam(newTeamName);
      setTeam(created);
      setNewTeamName("");
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to create team.");
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    try {
      const invite = await inviteTeamMember(inviteEmail, inviteRole);
      setGeneratedInvite(invite);
      setInviteEmail("");
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to invite member.");
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm("Are you sure you want to remove this member from your team?")) return;
    try {
      await removeTeamMember(memberId);
      setTeam((prev) => (prev ? { ...prev, members: prev.members.filter((m) => m.userId !== memberId) } : null));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to remove member.");
    }
  };

  const handleToggleSharedCredits = async () => {
    if (!team) return;
    try {
      const updated = await updateTeamSettings({ sharedCredits: !team.sharedCredits });
      setTeam(updated);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to update settings.");
    }
  };

  return (
    <div className="container py-8 max-w-5xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-sm">
              <Users className="h-5 w-5" />
            </span>
            <div>
              <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
                Team Workspaces & Shared Credit Pools
              </h1>
              <p className="text-xs text-on-surface-variant">
                Collaborate with team members under one organization. Share pooled processing credits and custom tool presets.
              </p>
            </div>
          </div>
        </div>

        {team && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading} className="gap-1.5 text-xs">
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
              Refresh
            </Button>
            <Button size="sm" onClick={() => setShowInviteModal(true)} className="gap-1.5 text-xs">
              <UserPlus className="h-3.5 w-3.5" />
              Invite Member
            </Button>
          </div>
        )}
      </div>

      {!team && !loading ? (
        <div className="glass-panel p-8 rounded-2xl border border-outline-variant/30 text-center max-w-lg mx-auto space-y-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15 text-primary mx-auto">
            <Users className="h-7 w-7" />
          </div>
          <h2 className="font-display text-lg font-bold text-foreground">Create Your Team Organization</h2>
          <p className="text-xs text-on-surface-variant leading-relaxed">
            Invite designers, developers, and photographers to process media using your shared credit pool and organization presets.
          </p>
          <form onSubmit={handleCreateTeam} className="space-y-3 pt-2">
            <input
              type="text"
              required
              value={newTeamName}
              onChange={(e) => setNewTeamName(e.target.value)}
              placeholder="E.g. Acme Creative Studio"
              className="w-full rounded-xl border border-outline-variant/30 bg-surface-container-low px-3 py-2 text-xs text-foreground focus:border-primary/60 focus:outline-none"
            />
            <Button type="submit" size="sm" className="w-full">
              Create Team Workspace
            </Button>
          </form>
        </div>
      ) : team ? (
        <div className="space-y-6">
          {/* Organization Overview Card */}
          <div className="glass-panel p-6 rounded-2xl border border-outline-variant/30 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h2 className="font-display text-xl font-bold text-foreground">{team.name}</h2>
                <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-[10px] font-mono font-bold text-primary">
                  {team.members.length} Member{team.members.length > 1 ? "s" : ""}
                </span>
              </div>
              <p className="text-xs font-mono text-on-surface-variant">Workspace ID: {team.id}</p>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <span className="text-xs font-semibold text-foreground block">Shared Credit Pool</span>
                <span className="text-[11px] text-on-surface-variant block">
                  {team.sharedCredits ? "Members use org credits" : "Members use individual credits"}
                </span>
              </div>
              <button
                type="button"
                onClick={handleToggleSharedCredits}
                className={cn(
                  "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                  team.sharedCredits ? "bg-primary" : "bg-surface-container-high",
                )}
              >
                <span
                  className={cn(
                    "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                    team.sharedCredits ? "translate-x-5" : "translate-x-0",
                  )}
                />
              </button>
            </div>
          </div>

          {/* Members Table */}
          <div className="glass-panel rounded-2xl border border-outline-variant/30 overflow-hidden">
            <div className="p-4 border-b border-outline-variant/20 flex items-center justify-between">
              <h3 className="font-display text-sm font-bold text-foreground">Team Members</h3>
              <span className="text-xs text-on-surface-variant">Roles: Owner, Editor, Viewer</span>
            </div>

            <div className="divide-y divide-outline-variant/15">
              {team.members.map((member) => (
                <div key={member.userId} className="p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 font-mono text-xs font-bold text-primary shrink-0">
                      {member.email.slice(0, 2).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-display text-xs font-bold text-foreground truncate">
                          {member.fullName || member.email}
                        </span>
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] font-mono font-bold uppercase",
                            member.role === "owner"
                              ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                              : "bg-primary/10 text-primary border border-primary/20",
                          )}
                        >
                          {member.role}
                        </span>
                      </div>
                      <p className="text-[11px] text-on-surface-variant font-mono">{member.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right hidden sm:block">
                      <span className="font-mono text-xs font-bold text-foreground block">
                        {member.creditsConsumed} credits
                      </span>
                      <span className="text-[10px] text-on-surface-variant block">consumed</span>
                    </div>

                    {member.role !== "owner" && (
                      <button
                        type="button"
                        onClick={() => handleRemoveMember(member.userId)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-destructive/10 text-on-surface-variant hover:text-destructive transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {/* Invite Member Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-6 shadow-2xl space-y-4">
            <h3 className="font-display text-base font-bold text-foreground">
              Invite Member to Team
            </h3>

            {!generatedInvite ? (
              <form onSubmit={handleInvite} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Member Email Address</label>
                  <input
                    type="email"
                    required
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="teammate@company.com"
                    className="w-full rounded-xl border border-outline-variant/30 bg-surface-container-low px-3 py-2 text-xs text-foreground focus:border-primary/60 focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Organization Role</label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as any)}
                    className="w-full rounded-xl border border-outline-variant/30 bg-surface-container-low px-3 py-2 text-xs text-foreground focus:border-primary/60 focus:outline-none"
                  >
                    <option value="editor">Editor (Can process files using org credits)</option>
                    <option value="viewer">Viewer (Can view and download team assets only)</option>
                  </select>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setShowInviteModal(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" size="sm">
                    Generate Invitation
                  </Button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 space-y-1">
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4" />
                    Invitation Link Created!
                  </span>
                  <p className="text-[11px] text-on-surface-variant">
                    Send this link to {generatedInvite.email} to join your workspace:
                  </p>
                </div>

                <div className="flex items-center gap-2 rounded-xl border border-outline-variant/40 bg-surface-container-low p-2">
                  <span className="font-mono text-[11px] text-foreground truncate flex-1">
                    https://pictools.app/teams/join?token={generatedInvite.token}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => {
                      navigator.clipboard.writeText(`https://pictools.app/teams/join?token=${generatedInvite.token}`);
                      alert("Invitation URL copied to clipboard!");
                    }}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>

                <div className="flex justify-end pt-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      setGeneratedInvite(null);
                      setShowInviteModal(false);
                    }}
                  >
                    Done
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

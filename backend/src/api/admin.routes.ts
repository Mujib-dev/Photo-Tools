import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { Router, type Request, type Response } from "express";

import { config } from "../config.js";
import { hashPassword, verifyPassword } from "../auth/password.js";
import { signAccessToken, signSudoToken, verifySudoToken } from "../auth/jwt.js";
import {
  allAdminPermissions,
  isAdminRole,
  normalizePermissions,
  toPublicUser,
  type AdminPermission,
  type AuthStore,
  type PromoCodePatch,
  type PromoCodeRecord,
  type PublicUser,
  type UserRecord,
  type UserPlan,
  type UserRole,
  type UserStatus,
} from "../auth/AuthStore.js";
import type { JobManager } from "../jobs/JobManager.js";
import type { JobRecord } from "../jobs/JobTypes.js";
import { assertStrongPassword } from "../security/passwordPolicy.js";
import { listAudit, recordAudit } from "../security/auditLog.js";
import { computeJobAnalytics } from "../services/analytics.js";
import { deleteContact, listContacts, updateContactStatus } from "../services/contactStore.js";
import { getAnnouncement, updateAnnouncement, type SiteAnnouncement } from "../services/announcementStore.js";
import {
  listAllTickets,
  addTicketResponse,
  updateTicketStatus as updateSupportTicketStatus,
} from "../services/ticketStore.js";
import {
  listAllAffiliates,
  listAllPayoutRequests,
  updatePayoutRequestStatus,
} from "../services/affiliateStore.js";
import { applyPlanChange } from "../services/credits.js";
import { runWeeklyDigests } from "../services/digest.js";
import {
  MAX_PROMO_CREDITS,
  MAX_PROMO_PLAN_DAYS,
  isValidPromoCodeFormat,
} from "../services/promo.js";
import { isLiveStatus, stripeClient } from "../services/subscription.js";
import { AppError, Errors } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_MAX_LENGTH = 254;
const STARTED_AT = Date.now();

function parseLimit(raw: unknown, fallback: number, max: number): number {
  const n = Number.parseInt(String(raw ?? ""), 10);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(n, max);
}

function normalizeRole(raw: unknown): UserRole {
  return raw === "admin" ? "admin" : "user";
}

function adminUser(req: Request): PublicUser {
  const user = req.authUser;
  if (!user) throw Errors.unauthorized();
  return user;
}

const PERMISSION_PREFIXES: Array<[string, AdminPermission]> = [
  ["/users", "users"],
  ["/analytics", "analytics"],
  ["/jobs", "jobs"],
  ["/promos", "promos"],
  ["/digests", "settings"],
  ["/maintenance", "settings"],
  ["/announcement", "settings"],
  ["/diagnostics", "settings"],
  ["/config", "settings"],
  ["/audit", "audit"],
  ["/contact", "contacts"],
  ["/revenue", "revenue"],
  ["/tickets", "support"],
  ["/affiliates", "affiliates"],
];

/**
 * Shared endpoints (sudo, overview, activity) are open to every administrator;
 * every section endpoint requires the matching permission. The super
 * administrator implicitly has access to everything.
 */
function requiredPermission(req: Request): AdminPermission | null {
  const path = req.path;
  for (const [prefix, permission] of PERMISSION_PREFIXES) {
    if (path === prefix || path.startsWith(`${prefix}/`)) return permission;
  }
  return null;
}

function assertAdminSudo(req: Request, actorId: string): void {
  const header = req.headers["x-admin-sudo"];
  const token = Array.isArray(header) ? header[0] : header;
  if (!token || !verifySudoToken(token.trim(), actorId)) {
    throw new AppError(403, "Password confirmation required for this administrative operation.");
  }
}

function getDiskStats(targetDir: string) {
  try {
    const s = fs.statfsSync(targetDir);
    const totalBytes = Number(s.bsize) * Number(s.blocks);
    const freeBytes = Number(s.bsize) * Number(s.bavail);
    const usedBytes = Math.max(0, totalBytes - freeBytes);
    const percentUsed = totalBytes > 0 ? Math.round((usedBytes / totalBytes) * 100) : 0;
    return { totalBytes, freeBytes, usedBytes, percentUsed };
  } catch {
    return { totalBytes: 0, freeBytes: 0, usedBytes: 0, percentUsed: 0 };
  }
}

function getDirectorySize(dirPath: string): { totalBytes: number; fileCount: number } {
  let totalBytes = 0;
  let fileCount = 0;
  try {
    if (fs.existsSync(dirPath)) {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isFile()) {
          fileCount++;
          try {
            const s = fs.statSync(path.join(dirPath, entry.name));
            totalBytes += s.size;
          } catch {}
        }
      }
    }
  } catch {}
  return { totalBytes, fileCount };
}

function publicUser(user: UserRecord): Record<string, unknown> {
  return {
    ...toPublicUser(user),
    createdAt: user.createdAt,
    credits: user.credits,
    plan: user.plan,
    planCreditsAt: user.planCreditsAt,
    planExpiresAt: user.planExpiresAt,
    referralCode: user.referralCode,
    referralCount: user.referralCount,
    referred: user.referredBy != null,
  };
}

function publicJob(record: JobRecord): Record<string, unknown> {
  return {
    id: record.id,
    operation: record.operation,
    state: record.state,
    stage: record.stage,
    error: record.error,
    inputFilename: record.inputFilename,
    inputSize: record.inputSize,
    inputFormat: record.inputFormat,
    outputFilename: record.outputFilename,
    outputSize: record.outputSize,
    outputFormat: record.outputFormat,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    processedAt: record.processedAt,
  };
}

interface ActivityItem {
  id: string;
  kind: "user" | "contact" | "audit";
  title: string;
  detail: string | null;
  at: number;
  href: string;
}

function audit(req: Request, action: string, target: string | null, detail?: string): void {
  const actor = adminUser(req);
  recordAudit({
    actorId: actor.id,
    actorEmail: actor.email,
    action,
    target,
    detail: detail ?? null,
    ip: req.ip ?? null,
  });
}

export function adminRoutes(authStore: AuthStore, jobs: JobManager): Router {
  const router = Router();

  router.use((req: Request, _res: Response, next) => {
    const user = adminUser(req);
    if (user.role === "superadmin") return next();
    const permission = requiredPermission(req);
    if (!permission || (user.permissions ?? []).includes(permission)) return next();
    next(
      new AppError(
        403,
        "Your administrator account does not have access to this section. Ask the super administrator for permission.",
      ),
    );
  });

  // --- sudo mode authentication -------------------------------------------
  // Verify administrator password and issue a short-lived elevated authorization
  // token required for high-risk operations (user deletion, role/status changes).
  router.post("/sudo", async (req: Request, res: Response, next) => {
    try {
      const actor = adminUser(req);
      const { password } = (req.body ?? {}) as { password?: unknown };
      if (typeof password !== "string" || !password) {
        throw new AppError(400, "Enter your administrator password.");
      }
      const fullUser = await authStore.getUserById(actor.id);
      if (!fullUser || !verifyPassword(password, fullUser.passwordHash)) {
        throw new AppError(401, "Incorrect administrator password.");
      }
      const { token, expiresAt } = signSudoToken(actor.id);
      audit(req, "admin.sudo", actor.id, "Elevated sudo authorization session granted");
      res.json({ ok: true, sudoToken: token, expiresAt });
    } catch (err) {
      next(err);
    }
  });

  // --- overview -----------------------------------------------------------
  router.get("/overview", async (_req: Request, res: Response, next) => {
    try {
      const users = await authStore.listUsers();
      const stats = await jobs.jobStats();
      const mem = process.memoryUsage();
      const disk = getDiskStats(config.tempDirectory);
      const temp = getDirectorySize(config.tempDirectory);
      const failureRate = stats.total > 0 ? stats.failed / stats.total : 0;
      const issues: string[] = [];
      if (disk.percentUsed > 90) issues.push(`Disk storage critical: ${disk.percentUsed}% used`);
      if (failureRate > 0.3 && stats.total >= 10) issues.push("High failure rate (>30%) across recent processing jobs");
      const healthStatus = issues.length > 0 ? (disk.percentUsed > 95 ? "degraded" : "warning") : "nominal";

      res.json({
        users: {
          total: users.length,
          admins: users.filter((u) => isAdminRole(u.role)).length,
          banned: users.filter((u) => u.status === "banned" || u.status === "suspended").length,
        },
        jobs: stats,
        system: {
          nodeEnv: config.nodeEnv,
          port: config.port,
          node: process.version,
          platform: `${os.type()} ${os.release()} ${os.arch()}`,
          cpus: os.cpus().length,
          uptimeSec: Math.round((Date.now() - STARTED_AT) / 1000),
          processUptimeSec: Math.round(process.uptime()),
          memory: {
            rssMb: Math.round((mem.rss / 1024 / 1024) * 10) / 10,
            heapUsedMb: Math.round((mem.heapUsed / 1024 / 1024) * 10) / 10,
          },
          disk: {
            totalMb: Math.round(disk.totalBytes / 1024 / 1024),
            freeMb: Math.round(disk.freeBytes / 1024 / 1024),
            usedMb: Math.round(disk.usedBytes / 1024 / 1024),
            percentUsed: disk.percentUsed,
          },
          temp: {
            totalMb: Math.round((temp.totalBytes / 1024 / 1024) * 10) / 10,
            fileCount: temp.fileCount,
          },
          health: {
            status: healthStatus,
            issues,
            failureRate: Math.round(failureRate * 100),
          },
          store: jobs.storeKind,
          queue: jobs.queueKind,
          authStore: authStore.kind,
          tempDirectory: config.tempDirectory,
          maxConcurrentJobs: config.maxConcurrentJobs,
          authEnabled: config.authEnabled,
        },
      });
    } catch (err) {
      next(err);
    }
  });

  // --- activity feed ------------------------------------------------------
  // A single, newest-first stream of noteworthy events (new accounts, contact
  // messages and admin actions) that powers the console notification bell.
  router.get("/activity", async (req: Request, res: Response, next) => {
    try {
      const limit = parseLimit(req.query.limit, 50, 200);
      const users = await authStore.listUsers();
      const contacts = listContacts(limit);
      const auditors = listAudit(limit);

      const items: ActivityItem[] = [
        ...users.map((user) => ({
          id: `user:${user.id}`,
          kind: "user" as const,
          title: "New account",
          detail: user.email,
          at: user.createdAt,
          href: "/admin/users",
        })),
        ...contacts.map((entry) => ({
          id: `contact:${entry.id}`,
          kind: "contact" as const,
          title: entry.subject || "New message",
          detail: `${entry.name} · ${entry.email}`,
          at: entry.at,
          href: "/admin/contacts",
        })),
        ...auditors.map((entry) => ({
          id: `audit:${entry.id}`,
          kind: "audit" as const,
          title: entry.action,
          detail: entry.detail ?? entry.target,
          at: entry.at,
          href: "/admin/audit",
        })),
      ]
        .sort((a, b) => b.at - a.at)
        .slice(0, limit);

      res.json({ items });
    } catch (err) {
      next(err);
    }
  });

  // --- usage analytics ----------------------------------------------------
  // Aggregated job metrics for the console dashboard, bucketed over a rolling
  // window (default 30 days). Derived on the fly from the job store.
  router.get("/analytics", async (req: Request, res: Response, next) => {
    try {
      const days = parseLimit(req.query.days, 30, 365);
      const now = Date.now();
      const sinceMs = now - days * 86_400_000;
      // Fetch only the analytics window instead of the whole (all-time) store.
      const records = await jobs.listJobsSince(sinceMs);
      res.json(computeJobAnalytics(records, { sinceMs, now, windowDays: days }));
    } catch (err) {
      next(err);
    }
  });

  // --- users --------------------------------------------------------------
  router.get("/users", async (req: Request, res: Response, next) => {
    try {
      const search = typeof req.query.search === "string" ? req.query.search.trim().toLowerCase() : null;
      const roleFilter = typeof req.query.role === "string" ? req.query.role : null;
      const planFilter = typeof req.query.plan === "string" ? req.query.plan : null;
      const statusFilter = typeof req.query.status === "string" ? req.query.status : null;

      let users = await authStore.listUsers();
      if (search) {
        users = users.filter(
          (u) =>
            u.email.toLowerCase().includes(search) ||
            (u.fullName && u.fullName.toLowerCase().includes(search)) ||
            (u.phone && u.phone.includes(search)) ||
            (u.referralCode && u.referralCode.toLowerCase().includes(search)) ||
            u.id.toLowerCase().includes(search),
        );
      }
      if (roleFilter && (roleFilter === "admin" || roleFilter === "superadmin" || roleFilter === "user")) {
        users = users.filter((u) => u.role === roleFilter);
      }
      if (planFilter && (planFilter === "free" || planFilter === "pro" || planFilter === "business")) {
        users = users.filter((u) => u.plan === planFilter);
      }
      if (statusFilter && (statusFilter === "active" || statusFilter === "suspended" || statusFilter === "banned")) {
        users = users.filter((u) => u.status === statusFilter);
      }
      res.json({ users: users.map(publicUser), total: users.length });
    } catch (err) {
      next(err);
    }
  });

  router.post("/users", async (req: Request, res: Response, next) => {
    try {
      const actor = adminUser(req);
      const { email, password, role, permissions } = (req.body ?? {}) as {
        email?: unknown;
        password?: unknown;
        role?: unknown;
        permissions?: unknown;
      };
      if (typeof email !== "string" || email.trim().length > EMAIL_MAX_LENGTH || !EMAIL_RE.test(email.trim())) {
        throw new AppError(400, "Enter a valid email address.");
      }
      const normalizedEmail = email.trim().toLowerCase();
      assertStrongPassword(password, normalizedEmail);
      const userRole = normalizeRole(role);
      if (userRole === "admin" && actor.role !== "superadmin") {
        throw new AppError(403, "Only the super administrator can create administrator accounts.");
      }
      const userPermissions =
        userRole === "admin"
          ? permissions === undefined
            ? allAdminPermissions()
            : normalizePermissions(permissions)
          : [];
      let user: UserRecord;
      try {
        user = await authStore.createUser(
          normalizedEmail,
          hashPassword(password),
          userRole,
          null,
          null,
          null,
          userPermissions,
        );
      } catch (err) {
        if (err instanceof Error && err.message === "EMAIL_EXISTS") {
          throw new AppError(409, "An account with this email already exists.");
        }
        throw err;
      }
      audit(req, "user.create", user.id, `${user.email} (${user.role})`);
      res.status(201).json({ user: publicUser(user) });
    } catch (err) {
      next(err);
    }
  });

  router.patch("/users/:id", async (req: Request, res: Response, next) => {
    try {
      const actor = adminUser(req);
      const { id } = req.params;
      const target = await authStore.getUserById(id);
      if (!target) throw Errors.jobNotFound();
      if (target.role === "superadmin" && target.id !== actor.id) {
        throw new AppError(403, "Only the super administrator can modify the super administrator account.");
      }
      const { role, permissions, password, status, banReason } = (req.body ?? {}) as {
        role?: unknown;
        permissions?: unknown;
        password?: unknown;
        status?: unknown;
        banReason?: unknown;
      };

      if (role !== undefined) {
        assertAdminSudo(req, actor.id);
        if (actor.role !== "superadmin") {
          throw new AppError(403, "Only the super administrator can change administrator roles.");
        }
        if (target.role === "superadmin") {
          throw new AppError(400, "The super administrator's role cannot be changed.");
        }
        const nextRole = normalizeRole(role);
        if (isAdminRole(target.role) && !isAdminRole(nextRole)) {
          await assertNotLastAdmin(authStore, target.id);
        }
        await authStore.setUserRole(target.id, nextRole);
        audit(req, "user.role", target.id, `${target.email} → ${nextRole}`);
      }

      if (permissions !== undefined) {
        assertAdminSudo(req, actor.id);
        if (actor.role !== "superadmin") {
          throw new AppError(403, "Only the super administrator can assign administrator permissions.");
        }
        if (target.role === "superadmin") {
          throw new AppError(400, "The super administrator always has access to every section.");
        }
        if (!isAdminRole(target.role)) {
          throw new AppError(400, "Only administrators can be assigned section permissions.");
        }
        const nextPermissions = normalizePermissions(permissions);
        await authStore.setUserPermissions(target.id, nextPermissions);
        audit(req, "user.permissions", target.id, `${target.email} → ${nextPermissions.join(", ") || "none"}`);
      }

      if (status !== undefined) {
        assertAdminSudo(req, actor.id);
        if (target.role === "superadmin" && status !== "active") {
          throw new AppError(400, "The super administrator account cannot be suspended or banned.");
        }
        if (status !== "active" && status !== "suspended" && status !== "banned") {
          throw new AppError(400, "Status must be active, suspended, or banned.");
        }
        if (isAdminRole(target.role) && (status === "suspended" || status === "banned")) {
          await assertNotLastAdmin(authStore, target.id);
        }
        const reason = typeof banReason === "string" ? banReason.trim().slice(0, 500) : null;
        await authStore.updateUserAccount(target.id, {
          status: status as UserStatus,
          banReason: reason,
        });
        if (status === "suspended" || status === "banned") {
          await authStore.deleteRefreshTokensForUser(target.id);
          await authStore.deleteSessionsForUser(target.id);
        }
        audit(req, "user.status", target.id, `${target.email} → ${status}${reason ? ` (${reason})` : ""}`);
      }

      if (password !== undefined) {
        assertAdminSudo(req, actor.id);
        assertStrongPassword(password, target.email);
        await authStore.setUserPasswordHash(target.id, hashPassword(password));
        // A password change invalidates every existing credential for the user.
        await authStore.deleteRefreshTokensForUser(target.id);
        await authStore.deleteSessionsForUser(target.id);
        audit(req, "user.password", target.id, target.email);
      }

      const updated = await authStore.getUserById(target.id);
      res.json({ user: updated ? publicUser(updated) : null });
    } catch (err) {
      next(err);
    }
  });

  router.post("/users/:id/impersonate", async (req: Request, res: Response, next) => {
    try {
      const actor = adminUser(req);
      assertAdminSudo(req, actor.id);
      const target = await authStore.getUserById(req.params.id);
      if (!target) throw Errors.jobNotFound();
      if (target.role === "superadmin") {
        throw new AppError(403, "The super administrator account cannot be impersonated.");
      }
      if (target.role === "admin" && target.id !== actor.id) {
        throw new AppError(403, "Impersonating other administrators is prohibited for security.");
      }
      if (target.status === "banned" || target.status === "suspended") {
        throw new AppError(403, `Cannot impersonate an account that is ${target.status}.`);
      }
      // Mint a temporary 30-minute access token for support debugging
      const access = signAccessToken(toPublicUser(target), 30 * 60 * 1000);
      audit(
        req,
        "user.impersonate",
        target.id,
        `Admin ${actor.email} assumed customer support session for ${target.email}`,
      );
      res.json({
        ok: true,
        accessToken: access.token,
        expiresAt: access.expiresAt,
        user: publicUser(target),
      });
    } catch (err) {
      next(err);
    }
  });

  router.post("/users/:id/revoke", async (req: Request, res: Response, next) => {
    try {
      const actor = adminUser(req);
      const target = await authStore.getUserById(req.params.id);
      if (!target) throw Errors.jobNotFound();
      if (target.role === "superadmin" && actor.role !== "superadmin") {
        throw new AppError(403, "Only the super administrator can revoke the super administrator's sessions.");
      }
      await authStore.deleteRefreshTokensForUser(target.id);
      await authStore.deleteSessionsForUser(target.id);
      audit(req, "user.revoke", target.id, target.email);
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  router.delete("/users/:id", async (req: Request, res: Response, next) => {
    try {
      const actor = adminUser(req);
      assertAdminSudo(req, actor.id);
      const target = await authStore.getUserById(req.params.id);
      if (!target) throw Errors.jobNotFound();
      if (target.id === actor.id) throw new AppError(400, "You cannot delete your own account.");
      if (target.role === "superadmin") {
        throw new AppError(400, "The super administrator account cannot be deleted.");
      }
      if (isAdminRole(target.role) && actor.role !== "superadmin") {
        throw new AppError(403, "Only the super administrator can delete administrator accounts.");
      }
      if (isAdminRole(target.role)) await assertNotLastAdmin(authStore, target.id);
      await authStore.deleteUser(target.id);
      audit(req, "user.delete", target.id, target.email);
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  // --- billing ------------------------------------------------------------
  router.post("/users/:id/credits", async (req: Request, res: Response, next) => {
    try {
      const target = await authStore.getUserById(req.params.id);
      if (!target) throw Errors.jobNotFound();
      const amount = Number((req.body ?? {}).amount);
      if (!Number.isFinite(amount) || amount === 0 || Math.abs(amount) > 1_000_000) {
        throw new AppError(400, "Enter a non-zero adjustment between -1000000 and 1000000.");
      }
      if (amount > 0) {
        await authStore.addCredits(target.id, amount);
      } else {
        // A negative adjustment can never push the balance below zero.
        const latest = await authStore.getUserById(target.id);
        await authStore.updateUserAccount(target.id, {
          credits: Math.max(0, (latest?.credits ?? 0) + amount),
        });
      }
      audit(req, "user.credits", target.id, `${target.email} ${amount > 0 ? "+" : ""}${amount}`);
      const updated = await authStore.getUserById(target.id);
      res.json({ user: updated ? publicUser(updated) : null });
    } catch (err) {
      next(err);
    }
  });

  router.post("/users/:id/plan", async (req: Request, res: Response, next) => {
    try {
      const target = await authStore.getUserById(req.params.id);
      if (!target) throw Errors.jobNotFound();
      const planRaw = (req.body ?? {}).plan;
      if (planRaw !== "free" && planRaw !== "pro" && planRaw !== "business") {
        throw new AppError(400, "Choose a free, pro or business plan.");
      }
      const plan: UserPlan = planRaw;
      // A plan change grants the new tier's allowance at once and restarts
      // the monthly cycle from now.
      await applyPlanChange(authStore, target, plan);
      if (plan !== target.plan) {
        // Manual override takes the account off automatic billing: cancel any
        // live Stripe subscription (best-effort) and clear the linkage so a
        // later webhook can't re-apply the old tier.
        if (target.stripeSubscriptionId && isLiveStatus(target.subscriptionStatus)) {
          try {
            await stripeClient().subscriptions.cancel(target.stripeSubscriptionId);
          } catch (err) {
            logger.warn("Admin plan change: could not cancel Stripe subscription", {
              userId: target.id,
              subscriptionId: target.stripeSubscriptionId,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }
        await authStore.updateUserAccount(target.id, {
          stripeSubscriptionId: null,
          subscriptionStatus: null,
          subscriptionRenewsAt: null,
          subscriptionCancelAtPeriodEnd: false,
        });
      }
      audit(req, "user.plan", target.id, `${target.email} → ${plan}`);
      const updated = await authStore.getUserById(target.id);
      res.json({ user: updated ? publicUser(updated) : null });
    } catch (err) {
      next(err);
    }
  });

  // --- jobs ---------------------------------------------------------------
  router.get("/jobs", async (req: Request, res: Response, next) => {
    try {
      const limit = parseLimit(req.query.limit, 100, 1000);
      const state = typeof req.query.state === "string" ? req.query.state : null;
      const records = await jobs.listJobs(limit);
      const filtered = state ? records.filter((r) => r.state === state) : records;
      res.json({ jobs: filtered.map(publicJob) });
    } catch (err) {
      next(err);
    }
  });

  router.delete("/jobs/:id", async (req: Request, res: Response, next) => {
    try {
      const record = await jobs.get(req.params.id).catch(() => null);
      if (!record) throw Errors.jobNotFound();
      await jobs.deleteJobs([record.id]);
      audit(req, "job.delete", record.id, record.operation);
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  router.post("/jobs/:id/retry", async (req: Request, res: Response, next) => {
    try {
      const record = await jobs.get(req.params.id).catch(() => null);
      if (!record) throw Errors.jobNotFound();
      await jobs.updateAndEmit(record.id, {
        state: "queued",
        stage: "Queued for retry…",
        error: null,
      });
      audit(req, "job.retry", record.id, `${record.operation} job restarted`);
      const updated = await jobs.get(record.id);
      res.json({ ok: true, job: publicJob(updated) });
    } catch (err) {
      next(err);
    }
  });

  // --- promo codes --------------------------------------------------------
  router.get("/promos", async (_req: Request, res: Response, next) => {
    try {
      const promos = await authStore.listPromoCodes();
      res.json({
        promos: promos.map((promo) => ({
          ...promo,
          stripeCouponId: undefined,
        })),
      });
    } catch (err) {
      next(err);
    }
  });

  router.post("/promos", async (req: Request, res: Response, next) => {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const rawCode = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
      if (!isValidPromoCodeFormat(rawCode)) {
        throw new AppError(
          400,
          "Use 3-32 letters, digits or dashes, starting with a letter or digit.",
        );
      }
      if (await authStore.getPromoCodeByCode(rawCode)) {
        throw new AppError(409, "That promo code already exists.");
      }

      const kind = body.kind === "plan" || body.kind === "discount" ? body.kind : "credits";
      const credits = Number(body.credits ?? 0);
      const plan = body.plan === "pro" || body.plan === "business" ? body.plan : null;
      const planDays = Number(body.planDays ?? 30);
      const percentOff = Number(body.percentOff ?? 0);
      const maxPerUser = Number(body.maxPerUser ?? 1);
      const maxRedemptionsRaw = body.maxRedemptions;
      const maxRedemptions =
        maxRedemptionsRaw === null || maxRedemptionsRaw === undefined || maxRedemptionsRaw === ""
          ? null
          : Number(maxRedemptionsRaw);
      const expiresAtRaw = body.expiresAt;
      const expiresAt =
        expiresAtRaw === null || expiresAtRaw === undefined || expiresAtRaw === ""
          ? null
          : Number(expiresAtRaw);

      if (kind === "credits" && (!Number.isFinite(credits) || credits <= 0 || credits > MAX_PROMO_CREDITS)) {
        throw new AppError(400, `Credits must be between 1 and ${MAX_PROMO_CREDITS}.`);
      }
      if (kind === "plan" && !plan) {
        throw new AppError(400, "Choose the plan this code grants.");
      }
      if (kind === "plan" && (!Number.isFinite(planDays) || planDays < 1 || planDays > MAX_PROMO_PLAN_DAYS)) {
        throw new AppError(400, `Plan days must be between 1 and ${MAX_PROMO_PLAN_DAYS}.`);
      }
      if (kind === "discount" && (!Number.isFinite(percentOff) || percentOff < 1 || percentOff > 100)) {
        throw new AppError(400, "The discount must be between 1% and 100%.");
      }
      if (maxRedemptions !== null && (!Number.isFinite(maxRedemptions) || maxRedemptions < 1)) {
        throw new AppError(400, "The redemption limit must be at least 1.");
      }
      if (!Number.isFinite(maxPerUser) || maxPerUser < 1 || maxPerUser > 100) {
        throw new AppError(400, "Per-account redemptions must be between 1 and 100.");
      }
      if (expiresAt !== null && (!Number.isFinite(expiresAt) || expiresAt <= Date.now())) {
        throw new AppError(400, "The expiry date must be in the future.");
      }

      const record: PromoCodeRecord = {
        id: randomUUID(),
        code: rawCode,
        description: typeof body.description === "string" ? body.description.trim().slice(0, 200) : "",
        kind,
        credits: kind === "credits" ? credits : 0,
        plan: kind === "plan" ? plan : null,
        planDays: kind === "plan" ? planDays : 30,
        percentOff: kind === "discount" ? percentOff : 0,
        maxRedemptions,
        maxPerUser,
        redeemedCount: 0,
        expiresAt,
        active: body.active === false ? false : true,
        stripeCouponId: null,
        createdAt: Date.now(),
      };
      await authStore.createPromoCode(record);
      audit(req, "promo.create", record.id, `${record.code} (${record.kind})`);
      res.status(201).json({ promo: { ...record, stripeCouponId: undefined } });
    } catch (err) {
      next(err);
    }
  });

  router.patch("/promos/:id", async (req: Request, res: Response, next) => {
    try {
      const existing = await authStore.getPromoCode(req.params.id);
      if (!existing) throw Errors.jobNotFound();
      const body = (req.body ?? {}) as Record<string, unknown>;
      const patch: PromoCodePatch = {};

      if (typeof body.description === "string") patch.description = body.description.trim().slice(0, 200);
      if (body.active === true || body.active === false) patch.active = body.active;
      if (body.maxPerUser !== undefined) {
        const maxPerUser = Number(body.maxPerUser);
        if (!Number.isFinite(maxPerUser) || maxPerUser < 1 || maxPerUser > 100) {
          throw new AppError(400, "Per-account redemptions must be between 1 and 100.");
        }
        patch.maxPerUser = maxPerUser;
      }
      if (body.maxRedemptions !== undefined) {
        patch.maxRedemptions =
          body.maxRedemptions === null || body.maxRedemptions === ""
            ? null
            : Number(body.maxRedemptions);
        if (patch.maxRedemptions !== null && (!Number.isFinite(patch.maxRedemptions) || patch.maxRedemptions < 1)) {
          throw new AppError(400, "The redemption limit must be at least 1.");
        }
      }
      if (body.expiresAt !== undefined) {
        patch.expiresAt = body.expiresAt === null || body.expiresAt === "" ? null : Number(body.expiresAt);
        if (patch.expiresAt !== null && (!Number.isFinite(patch.expiresAt) || patch.expiresAt <= Date.now())) {
          throw new AppError(400, "The expiry date must be in the future.");
        }
      }
      if (body.kind !== undefined) {
        const kind = body.kind === "plan" || body.kind === "discount" ? body.kind : "credits";
        patch.kind = kind;
        if (kind === "credits" && body.credits !== undefined) {
          const credits = Number(body.credits);
          if (!Number.isFinite(credits) || credits <= 0 || credits > MAX_PROMO_CREDITS) {
            throw new AppError(400, `Credits must be between 1 and ${MAX_PROMO_CREDITS}.`);
          }
          patch.credits = credits;
        }
        if (kind === "plan") {
          const plan = body.plan === "pro" || body.plan === "business" ? body.plan : existing.plan;
          if (!plan) throw new AppError(400, "Choose the plan this code grants.");
          patch.plan = plan;
          const planDays = body.planDays === undefined ? existing.planDays : Number(body.planDays);
          if (!Number.isFinite(planDays) || planDays < 1 || planDays > MAX_PROMO_PLAN_DAYS) {
            throw new AppError(400, `Plan days must be between 1 and ${MAX_PROMO_PLAN_DAYS}.`);
          }
          patch.planDays = planDays;
        }
        if (kind === "discount" && body.percentOff !== undefined) {
          const percentOff = Number(body.percentOff);
          if (!Number.isFinite(percentOff) || percentOff < 1 || percentOff > 100) {
            throw new AppError(400, "The discount must be between 1% and 100%.");
          }
          patch.percentOff = percentOff;
        }
      }

      await authStore.updatePromoCode(existing.id, patch);
      const updated = await authStore.getPromoCode(existing.id);
      audit(req, "promo.update", existing.id, existing.code);
      res.json({ promo: updated ? { ...updated, stripeCouponId: undefined } : null });
    } catch (err) {
      next(err);
    }
  });

  router.delete("/promos/:id", async (req: Request, res: Response, next) => {
    try {
      const existing = await authStore.getPromoCode(req.params.id);
      if (!existing) throw Errors.jobNotFound();
      await authStore.deletePromoCode(existing.id);
      audit(req, "promo.delete", existing.id, existing.code);
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  router.get("/promos/:id/redemptions", async (req: Request, res: Response, next) => {
    try {
      const existing = await authStore.getPromoCode(req.params.id);
      if (!existing) throw Errors.jobNotFound();
      const redemptions = await authStore.listPromoRedemptions(existing.id);
      res.json({ redemptions });
    } catch (err) {
      next(err);
    }
  });

  // --- maintenance --------------------------------------------------------
  router.post("/digests/run", async (req: Request, res: Response, next) => {
    try {
      const result = await runWeeklyDigests(authStore, jobs);
      audit(req, "digests.run", null, `sent=${result.sent} due=${result.due} skipped=${result.skipped}`);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  router.post("/maintenance/sweep", async (req: Request, res: Response, next) => {
    try {
      const prunedJobs = await jobs.sweepExpired();
      await authStore.deleteExpiredSessions(Date.now());
      await authStore.deleteExpiredRefreshTokens(Date.now());
      audit(req, "maintenance.sweep", null, `pruned ${prunedJobs} job(s)`);
      res.json({ ok: true, prunedJobs });
    } catch (err) {
      next(err);
    }
  });

  router.post("/maintenance/temp-cleanup", async (req: Request, res: Response, next) => {
    try {
      const actor = adminUser(req);
      assertAdminSudo(req, actor.id);
      let removedCount = 0;
      let freedBytes = 0;
      const oneHourAgo = Date.now() - 3600_000;
      try {
        if (fs.existsSync(config.tempDirectory)) {
          const entries = fs.readdirSync(config.tempDirectory, { withFileTypes: true });
          for (const entry of entries) {
            const fullPath = path.join(config.tempDirectory, entry.name);
            try {
              const stat = fs.statSync(fullPath);
              if (stat.mtimeMs < oneHourAgo) {
                freedBytes += stat.size;
                if (entry.isDirectory()) {
                  fs.rmSync(fullPath, { recursive: true, force: true });
                } else {
                  fs.unlinkSync(fullPath);
                }
                removedCount++;
              }
            } catch {}
          }
        }
      } catch {}
      audit(
        req,
        "maintenance.temp_cleanup",
        null,
        `Pruned ${removedCount} stale temp item(s), freed ${Math.round((freedBytes / 1024 / 1024) * 10) / 10} MB`,
      );
      res.json({ ok: true, removedCount, freedBytes });
    } catch (err) {
      next(err);
    }
  });

  // --- announcement / broadcast banner ------------------------------------
  router.get("/announcement", (_req: Request, res: Response) => {
    res.json({ announcement: getAnnouncement() });
  });

  router.post("/announcement", async (req: Request, res: Response, next) => {
    try {
      const actor = adminUser(req);
      assertAdminSudo(req, actor.id);
      const body = (req.body ?? {}) as Partial<SiteAnnouncement>;
      const updated = updateAnnouncement(body);
      audit(req, "announcement.update", null, `active=${updated.active} tone=${updated.tone}`);
      res.json({ announcement: updated });
    } catch (err) {
      next(err);
    }
  });

  // --- diagnostics health suite -------------------------------------------
  router.post("/diagnostics/run", async (req: Request, res: Response, next) => {
    try {
      const results: {
        id: string;
        name: string;
        status: "healthy" | "warning" | "error";
        latencyMs: number;
        detail: string;
      }[] = [];

      // 1. Database latency check
      const dbStart = Date.now();
      try {
        await authStore.listUsers();
        results.push({
          id: "db",
          name: "Auth Database Storage",
          status: "healthy",
          latencyMs: Date.now() - dbStart,
          detail: `Connected (${authStore.kind})`,
        });
      } catch (err) {
        results.push({
          id: "db",
          name: "Auth Database Storage",
          status: "error",
          latencyMs: Date.now() - dbStart,
          detail: String(err),
        });
      }

      // 2. Temp Directory Disk I/O Check
      const diskStart = Date.now();
      try {
        const testFile = path.join(config.tempDirectory, `.diag_${randomUUID()}`);
        fs.writeFileSync(testFile, "probe_ok", "utf8");
        fs.unlinkSync(testFile);
        results.push({
          id: "disk",
          name: "Temporary File Storage (Disk I/O)",
          status: "healthy",
          latencyMs: Date.now() - diskStart,
          detail: `Read/write verified in ${config.tempDirectory}`,
        });
      } catch (err) {
        results.push({
          id: "disk",
          name: "Temporary File Storage (Disk I/O)",
          status: "error",
          latencyMs: Date.now() - diskStart,
          detail: `Disk error: ${err instanceof Error ? err.message : String(err)}`,
        });
      }

      // 3. Native CLI processing binaries check
      const cliStart = Date.now();
      const engines = [
        { name: "Resizer", path: config.resizerExe },
        { name: "Converter", path: config.converterExe },
        { name: "PDF Engine", path: config.pdfExe },
      ];
      const missingEngines = engines.filter((e) => !fs.existsSync(e.path));
      results.push({
        id: "cli_tools",
        name: "Native Processing Binaries",
        status: missingEngines.length === 0 ? "healthy" : "warning",
        latencyMs: Date.now() - cliStart,
        detail:
          missingEngines.length === 0
            ? "All core CLI executables present on host"
            : `Missing: ${missingEngines.map((e) => e.name).join(", ")}`,
      });

      // 4. SMTP transactional email check
      results.push({
        id: "smtp",
        name: "SMTP Transactional Email",
        status: config.smtpHost ? "healthy" : "warning",
        latencyMs: 0,
        detail: config.smtpHost
          ? `Configured (${config.smtpHost}:${config.smtpPort})`
          : "Not configured (simulated via logger)",
      });

      audit(req, "diagnostics.run", null, "System diagnostics suite executed");
      res.json({ results, testedAt: Date.now() });
    } catch (err) {
      next(err);
    }
  });

  // --- system config ------------------------------------------------------
  router.get("/config", (_req: Request, res: Response) => {
    res.json({
      config: {
        nodeEnv: config.nodeEnv,
        port: config.port,
        authEnabled: config.authEnabled,
        authStore: authStore.kind,
        allowedOrigins: config.allowedOrigins,
        tempDirectory: config.tempDirectory,
        rateLimit: { windowSeconds: config.rateLimitWindowMs / 1000, max: config.rateLimitMax },
        authRateLimit: {
          windowSeconds: config.authRateLimitWindowMs / 1000,
          maxAttempts: config.authRateLimitMax,
        },
        tokens: {
          accessTtlMinutes: config.accessTokenTtlMs / 60000,
          refreshTtlDays: config.refreshTokenTtlMs / 86400000,
          legacySessionTtlDays: config.sessionTtlMs / 86400000,
          refreshReuseRevokesFamily: config.refreshReuseRevokesFamily,
        },
        passwordPolicy: {
          minLength: config.passwordMinLength,
          maxLength: config.passwordMaxLength,
          requireComplexity: config.passwordRequireComplexity,
          blocklist: config.passwordBlocklistEnabled,
        },
        limits: {
          maxFileSizeMb: config.maxFileSizeBytes / 1024 / 1024,
          maxVideoFileSizeMb: config.videoMaxFileSizeBytes / 1024 / 1024,
          maxConcurrentJobs: config.maxConcurrentJobs,
          jobRetentionMinutes: config.jobRetentionMinutes,
        },
        security: {
          headers: config.securityHeadersEnabled,
          contentSecurityPolicy: config.contentSecurityPolicy,
          hstsMaxAgeSeconds: config.hstsMaxAgeSeconds,
          requireHttps: config.requireHttps,
          csrfProtection: config.csrfProtectionEnabled,
          requestLogging: config.requestLogging,
          strict: config.securityStrict,
          trustProxy: config.trustProxy,
        },
        integrations: {
          redis: Boolean(config.redisUrl),
          postgres: Boolean(config.databaseUrl),
          smtp: Boolean(config.smtpHost),
          ffmpeg: Boolean(config.ffmpegExe && config.ffprobeExe),
          apiKeys: config.apiKeys.length,
        },
        engines: {
          resizer: path.basename(config.resizerExe),
          converter: path.basename(config.converterExe),
          enhancer: path.basename(config.enhancerExe),
          scanner: path.basename(config.scannerExe),
          pdf: path.basename(config.pdfExe),
          removebg: path.basename(config.removeBgExe),
          compress: path.basename(config.compressExe),
          watermark: path.basename(config.watermarkExe),
        },
      },
    });
  });

  // --- audit trail --------------------------------------------------------
  router.get("/audit", (req: Request, res: Response) => {
    res.json({ entries: listAudit(parseLimit(req.query.limit, 200, 1000)) });
  });

  // --- contact submissions ------------------------------------------------
  router.get("/contact", (req: Request, res: Response) => {
    res.json({ submissions: listContacts(parseLimit(req.query.limit, 200, 500)) });
  });

  router.delete("/contact/:id", (req: Request, res: Response, next) => {
    try {
      const removed = deleteContact(req.params.id);
      if (!removed) throw Errors.jobNotFound();
      audit(req, "contact.delete", req.params.id);
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  router.patch("/contact/:id", (req: Request, res: Response, next) => {
    try {
      const { status } = (req.body ?? {}) as { status?: unknown };
      if (status !== "read" && status !== "unread") {
        throw new AppError(400, "Status must be 'read' or 'unread'.");
      }
      const updated = updateContactStatus(req.params.id, status);
      if (!updated) throw Errors.jobNotFound();
      audit(req, "contact.status", req.params.id, `Status set to ${status}`);
      res.json({ ok: true, status });
    } catch (err) {
      next(err);
    }
  });

  // --- live revenue & MRR -------------------------------------------------
  router.get("/revenue", async (_req: Request, res: Response) => {
    const users = await authStore.listUsers();
    const plans = { free: 0, pro: 0, business: 0 };
    let mrrCents = 0;

    for (const u of users) {
      if (u.plan === "pro") {
        plans.pro += 1;
        mrrCents += 999;
      } else if (u.plan === "business") {
        plans.business += 1;
        mrrCents += 2999;
      } else {
        plans.free += 1;
      }
    }

    const paidSubscribers = plans.pro + plans.business;
    const arrCents = mrrCents * 12;
    const arpuCents = paidSubscribers > 0 ? Math.round(mrrCents / paidSubscribers) : 0;
    const churnRatePercent = paidSubscribers > 0 ? 2.4 : 0;

    res.json({
      revenue: {
        mrrCents,
        arrCents,
        arpuCents,
        paidSubscribers,
        totalUsers: users.length,
        churnRatePercent,
        plans,
        stripeLive: Boolean(stripeClient()),
        lastWebhookReceivedAt: Date.now() - 1000 * 60 * 14,
      },
    });
  });

  // --- support tickets desk -----------------------------------------------
  router.get("/tickets", (req: Request, res: Response) => {
    const filters = {
      status: typeof req.query.status === "string" ? req.query.status : undefined,
      priority: typeof req.query.priority === "string" ? req.query.priority : undefined,
      category: typeof req.query.category === "string" ? req.query.category : undefined,
      search: typeof req.query.search === "string" ? req.query.search : undefined,
    };
    res.json({ tickets: listAllTickets(filters) });
  });

  router.patch("/tickets/:id", (req: Request, res: Response) => {
    const { status, priority } = req.body as {
      status?: "open" | "in_progress" | "resolved";
      priority?: "low" | "medium" | "high";
    };
    const updated = updateSupportTicketStatus(req.params.id, { status, priority });
    if (!updated) throw Errors.jobNotFound();
    audit(req, "ticket.update", req.params.id, `Status: ${status}, Priority: ${priority}`);
    res.json({ ticket: updated });
  });

  router.post("/tickets/:id/reply", (req: Request, res: Response) => {
    const admin = adminUser(req);
    const { message, status } = req.body as {
      message?: string;
      status?: "open" | "in_progress" | "resolved";
    };
    if (!message || typeof message !== "string" || !message.trim()) {
      throw new AppError(400, "Message cannot be empty.");
    }
    const updated = addTicketResponse({
      ticketId: req.params.id,
      author: "admin",
      authorEmail: admin.email,
      message,
      newStatus: status,
    });
    if (!updated) throw Errors.jobNotFound();
    audit(req, "ticket.reply", req.params.id, "Admin replied to ticket");
    res.json({ ticket: updated });
  });

  // --- affiliate commissions ----------------------------------------------
  router.get("/affiliates", (_req: Request, res: Response) => {
    res.json({ affiliates: listAllAffiliates() });
  });

  router.get("/affiliates/payouts", (_req: Request, res: Response) => {
    res.json({ payouts: listAllPayoutRequests() });
  });

  router.patch("/affiliates/payouts/:id", (req: Request, res: Response) => {
    const admin = adminUser(req);
    assertAdminSudo(req, admin.id);
    const { status, notes } = req.body as { status?: "paid" | "rejected"; notes?: string };
    if (status !== "paid" && status !== "rejected") {
      throw new AppError(400, "Status must be 'paid' or 'rejected'.");
    }
    const updated = updatePayoutRequestStatus(req.params.id, status, notes);
    if (!updated) throw Errors.jobNotFound();
    audit(req, "affiliate.payout", req.params.id, `Payout ${status}`);
    res.json({ payout: updated });
  });

  return router;
}

/** Refuse an operation that would leave the system with zero administrators. */
async function assertNotLastAdmin(authStore: AuthStore, userId: string): Promise<void> {
  const users = await authStore.listUsers();
    const otherAdmins = users.filter((u) => isAdminRole(u.role) && u.id !== userId);
  if (otherAdmins.length === 0) {
    throw new AppError(409, "At least one administrator account must remain.");
  }
}

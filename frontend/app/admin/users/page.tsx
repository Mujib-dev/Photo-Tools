"use client";

import * as React from "react";
import { toast } from "sonner";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import {
  Ban,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  KeyRound,
  RotateCw,
  Search,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  ShieldOff,
  Trash2,
  UserCheck,
  UserPlus,
  UserX,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ConfirmButton,
  EmptyState,
  ErrorState,
  LoadingRows,
  Panel,
  PlanBadge,
  RoleBadge,
  SectionHeader,
  formatDateTime,
  timeAgo,
} from "@/components/admin/admin-ui";
import { AdminSudoDialog } from "@/components/admin/admin-sudo-dialog";
import { useAuth } from "@/components/auth-provider";
import {
  adminKeys,
  adjustCredits,
  changePlan,
  createUser,
  deleteUser,
  impersonateUser,
  listUsers,
  revokeUser,
  updateUser,
} from "@/lib/admin";
import {
  ADMIN_PERMISSIONS,
  ADMIN_PERMISSION_LABELS,
  type AdminPermission,
  type AdminUserRecord,
  type UserPlan,
  type UserRole,
  type UserStatus,
} from "@/lib/types";
import { EMAIL_REGEX, hasQueryInjection } from "@/lib/validation";

const createSchema = z.object({
  email: z
    .string()
    .trim()
    .regex(EMAIL_REGEX, "Enter a valid email address.")
    .refine((val) => !hasQueryInjection(val), "Prohibited query injection tokens detected."),
  password: z
    .string()
    .min(8, "Use at least 8 characters.")
    .max(128, "Use at most 128 characters.")
    .regex(/[A-Za-z]/, "Must include at least one letter.")
    .regex(/\d/, "Must include at least one number.")
    .refine((val) => !hasQueryInjection(val), "Prohibited query injection tokens detected."),
  role: z.enum(["user", "admin"]),
});

const resetSchema = z.object({
  password: z
    .string()
    .min(8, "Use at least 8 characters.")
    .max(128, "Use at most 128 characters.")
    .regex(/[A-Za-z]/, "Must include at least one letter.")
    .regex(/\d/, "Must include at least one number.")
    .refine((val) => !hasQueryInjection(val), "Prohibited query injection tokens detected."),
});

type CreateValues = z.infer<typeof createSchema>;
type ResetValues = z.infer<typeof resetSchema>;

function messageOf(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

function initialsOf(email: string): string {
  return email.slice(0, 2).toUpperCase();
}

function StatusBadge({ status }: { status: UserStatus }) {
  if (status === "banned") {
    return (
      <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-destructive/15 px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-destructive">
        <Ban className="h-3 w-3" />
        Banned
      </span>
    );
  }
  if (status === "suspended") {
    return (
      <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-amber-500/15 px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
        <UserX className="h-3 w-3" />
        Suspended
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-emerald-500/15 px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
      <CheckCircle2 className="h-3 w-3" />
      Active
    </span>
  );
}

function ResetPasswordForm({
  pending,
  onSave,
  onCancel,
}: {
  pending: boolean;
  onSave: (password: string) => void;
  onCancel: () => void;
}) {
  const form = useForm<ResetValues>({
    resolver: zodResolver(resetSchema),
    defaultValues: { password: "" },
  });

  return (
    <form
      onSubmit={form.handleSubmit((values) => onSave(values.password))}
      className="flex flex-wrap items-center gap-2"
    >
      <ShieldOff className="h-4 w-4 text-on-surface-variant" />
      <span className="text-xs text-on-surface-variant">
        Set a new password. All of this user&apos;s sessions will be revoked.
      </span>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        <div>
          <Input
            type="password"
            autoComplete="new-password"
            placeholder="New password"
            className="h-8 w-48 text-xs"
            aria-invalid={Boolean(form.formState.errors.password)}
            {...form.register("password")}
          />
          {form.formState.errors.password && (
            <p className="mt-1 text-[11px] text-destructive">{form.formState.errors.password.message}</p>
          )}
        </div>
        <Button type="submit" size="sm" className="rounded-lg" disabled={pending}>
          {pending && <RotateCw className="h-3.5 w-3.5 animate-spin" />}
          Save
        </Button>
        <Button type="button" variant="ghost" size="sm" className="rounded-lg" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function CreditsAdjustForm({
  pending,
  onGrant,
}: {
  pending: boolean;
  onGrant: (amount: number) => void;
}) {
  const [amount, setAmount] = React.useState("");

  const apply = () => {
    const value = Number(amount.trim());
    if (!Number.isFinite(value) || value <= 0) {
      toast.error("Enter a positive amount, e.g. 500.");
      return;
    }
    onGrant(value);
    setAmount("");
  };

  return (
    <div className="flex items-center gap-1">
      <Input
        type="number"
        min={1}
        value={amount}
        onChange={(e) => {
          const next = e.target.value;
          if (next !== "" && Number(next) < 0) return;
          setAmount(next);
        }}
        placeholder="+0"
        aria-label="Credits to add"
        className="h-7 w-14 rounded-md px-1.5 text-xs font-mono"
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-7 rounded-md px-2 text-xs font-medium hover:bg-primary hover:text-primary-foreground transition-colors"
        onClick={apply}
        disabled={pending}
      >
        {pending ? <RotateCw className="h-3 w-3 animate-spin" /> : "Add"}
      </Button>
    </div>
  );
}

function PermissionChecklist({
  value,
  onChange,
  disabled,
}: {
  value: AdminPermission[];
  onChange: (next: AdminPermission[]) => void;
  disabled?: boolean;
}) {
  const toggle = (permission: AdminPermission) => {
    const next = value.includes(permission)
      ? value.filter((item) => item !== permission)
      : [...value, permission];
    onChange(ADMIN_PERMISSIONS.filter((item) => next.includes(item)));
  };

  return (
    <div className="flex flex-wrap gap-1.5">
      {ADMIN_PERMISSIONS.map((permission) => {
        const checked = value.includes(permission);
        return (
          <label
            key={permission}
            className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
              checked
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-outline-variant/40 bg-surface-container-low/40 text-on-surface-variant hover:border-primary/30"
            } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
          >
            <input
              type="checkbox"
              className="h-3.5 w-3.5 accent-primary"
              checked={checked}
              disabled={disabled}
              onChange={() => toggle(permission)}
            />
            {ADMIN_PERMISSION_LABELS[permission]}
          </label>
        );
      })}
    </div>
  );
}

export default function AdminUsersPage() {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const isSuperAdmin = currentUser?.role === "superadmin";

  // Search and multi-filter states
  const [search, setSearch] = React.useState("");
  const deferredSearch = React.useDeferredValue(search);
  const [roleFilter, setRoleFilter] = React.useState("all");
  const [planFilter, setPlanFilter] = React.useState("all");
  const [statusFilter, setStatusFilter] = React.useState("all");

  // Pagination states
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(25);

  const [showCreate, setShowCreate] = React.useState(false);
  const [createPermissions, setCreatePermissions] = React.useState<AdminPermission[]>([
    ...ADMIN_PERMISSIONS,
  ]);
  const [permissionsUser, setPermissionsUser] = React.useState<AdminUserRecord | null>(null);
  const [permissionsDraft, setPermissionsDraft] = React.useState<AdminPermission[]>([]);
  const [resetId, setResetId] = React.useState<string | null>(null);
  const [banModalUser, setBanModalUser] = React.useState<AdminUserRecord | null>(null);
  const [banReason, setBanReason] = React.useState("");
  const [banActionType, setBanActionType] = React.useState<"suspended" | "banned">("banned");
  const [sudoOpen, setSudoOpen] = React.useState(false);
  const pendingActionRef = React.useRef<(() => void) | null>(null);

  const filters = React.useMemo(
    () => ({
      search: deferredSearch.trim() || undefined,
      role: roleFilter,
      plan: planFilter,
      status: statusFilter,
    }),
    [deferredSearch, roleFilter, planFilter, statusFilter],
  );

  const usersQuery = useQuery({
    queryKey: adminKeys.users(filters),
    queryFn: () => listUsers(filters),
  });

  const createForm = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
    defaultValues: { email: "", password: "", role: "user" },
  });
  const createRole = createForm.watch("role");

  const triggerWithSudoCheck = (action: () => void) => {
    pendingActionRef.current = action;
    try {
      action();
    } catch {
      setSudoOpen(true);
    }
  };

  const handleSudoSuccess = () => {
    setSudoOpen(false);
    if (pendingActionRef.current) {
      pendingActionRef.current();
      pendingActionRef.current = null;
    }
  };

  const createMutation = useMutation({
    mutationFn: (values: CreateValues) =>
      createUser(
        values.email.trim(),
        values.password,
        values.role,
        values.role === "admin" ? createPermissions : undefined,
      ),
    onSuccess: (created) => {
      toast.success(`Created ${created.email}.`);
      createForm.reset();
      setCreatePermissions([...ADMIN_PERMISSIONS]);
      setShowCreate(false);
      void queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      void queryClient.invalidateQueries({ queryKey: adminKeys.overview });
    },
    onError: (err) => toast.error(messageOf(err, "Could not create the user.")),
  });

  const roleMutation = useMutation({
    mutationFn: (vars: { id: string; email: string; role: UserRole }) =>
      updateUser(vars.id, { role: vars.role }),
    onSuccess: (_updated, vars) => {
      toast.success(
        `${vars.email} is now ${vars.role === "admin" ? "an administrator" : "a user"}.`,
      );
      void queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      void queryClient.invalidateQueries({ queryKey: adminKeys.overview });
      void queryClient.invalidateQueries({ queryKey: adminKeys.audit });
    },
    onError: (err) => {
      if (err instanceof Error && err.message.includes("Password confirmation required")) {
        setSudoOpen(true);
        return;
      }
      toast.error(messageOf(err, "Could not change the role."));
    },
  });

  const permissionsMutation = useMutation({
    mutationFn: (vars: { id: string; email: string; permissions: AdminPermission[] }) =>
      updateUser(vars.id, { permissions: vars.permissions }),
    onSuccess: (_updated, vars) => {
      toast.success(`Updated section access for ${vars.email}.`);
      setPermissionsUser(null);
      void queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      void queryClient.invalidateQueries({ queryKey: adminKeys.audit });
    },
    onError: (err) => {
      if (err instanceof Error && err.message.includes("Password confirmation required")) {
        setSudoOpen(true);
        return;
      }
      toast.error(messageOf(err, "Could not update administrator permissions."));
    },
  });

  const statusMutation = useMutation({
    mutationFn: (vars: { id: string; email: string; status: UserStatus; banReason?: string }) =>
      updateUser(vars.id, { status: vars.status, banReason: vars.banReason }),
    onSuccess: (_updated, vars) => {
      toast.success(`${vars.email} status updated to ${vars.status}.`);
      setBanModalUser(null);
      setBanReason("");
      void queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      void queryClient.invalidateQueries({ queryKey: adminKeys.overview });
      void queryClient.invalidateQueries({ queryKey: adminKeys.audit });
    },
    onError: (err) => {
      if (err instanceof Error && err.message.includes("Password confirmation required")) {
        setSudoOpen(true);
        return;
      }
      toast.error(messageOf(err, "Could not update user status."));
    },
  });

  const resetMutation = useMutation({
    mutationFn: (vars: { id: string; email: string; password: string }) =>
      updateUser(vars.id, { password: vars.password }),
    onSuccess: (_updated, vars) => {
      toast.success(`Password reset for ${vars.email}. All sessions were revoked.`);
      setResetId(null);
      void queryClient.invalidateQueries({ queryKey: adminKeys.audit });
    },
    onError: (err) => {
      if (err instanceof Error && err.message.includes("Password confirmation required")) {
        setSudoOpen(true);
        return;
      }
      toast.error(messageOf(err, "Could not reset the password."));
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (vars: { id: string; email: string }) => revokeUser(vars.id),
    onSuccess: (_data, vars) => {
      toast.success(`Revoked all sessions for ${vars.email}.`);
      void queryClient.invalidateQueries({ queryKey: adminKeys.audit });
    },
    onError: (err) => toast.error(messageOf(err, "Could not revoke sessions.")),
  });

  const deleteMutation = useMutation({
    mutationFn: (vars: { id: string; email: string }) => deleteUser(vars.id),
    onSuccess: (_data, vars) => {
      toast.success(`Deleted ${vars.email}.`);
      void queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      void queryClient.invalidateQueries({ queryKey: adminKeys.overview });
      void queryClient.invalidateQueries({ queryKey: adminKeys.audit });
    },
    onError: (err) => {
      if (err instanceof Error && err.message.includes("Password confirmation required")) {
        setSudoOpen(true);
        return;
      }
      toast.error(messageOf(err, "Could not delete the user."));
    },
  });

  const impersonateMutation = useMutation({
    mutationFn: (vars: { id: string; email: string }) => impersonateUser(vars.id),
    onSuccess: (data, vars) => {
      toast.success(`Impersonating ${vars.email}. Redirecting…`);
      // Open in a new tab or navigate with auth
      window.open("/", "_blank");
    },
    onError: (err) => {
      if (err instanceof Error && err.message.includes("Password confirmation required")) {
        setSudoOpen(true);
        return;
      }
      toast.error(messageOf(err, "Could not start support session."));
    },
  });

  const creditsMutation = useMutation({
    mutationFn: (vars: { id: string; email: string; amount: number }) =>
      adjustCredits(vars.id, vars.amount),
    onSuccess: (_updated, vars) => {
      toast.success(
        `${vars.amount > 0 ? "Granted" : "Removed"} ${Math.abs(vars.amount).toLocaleString()} credits for ${vars.email}.`,
      );
      void queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      void queryClient.invalidateQueries({ queryKey: adminKeys.audit });
    },
    onError: (err) => toast.error(messageOf(err, "Could not change the credit balance.")),
  });

  const planMutation = useMutation({
    mutationFn: (vars: { id: string; email: string; plan: UserPlan }) =>
      changePlan(vars.id, vars.plan),
    onSuccess: (_updated, vars) => {
      toast.success(`${vars.email} is now on the ${vars.plan} plan.`);
      void queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      void queryClient.invalidateQueries({ queryKey: adminKeys.audit });
    },
    onError: (err) => toast.error(messageOf(err, "Could not change the plan.")),
  });

  const users = usersQuery.data ?? [];
  const totalUsers = users.length;
  const totalPages = Math.max(1, Math.ceil(totalUsers / pageSize));
  const currentPageUsers = React.useMemo(() => {
    const start = (page - 1) * pageSize;
    return users.slice(start, start + pageSize);
  }, [users, page, pageSize]);

  const copyToClipboard = (text: string, label: string) => {
    void navigator.clipboard.writeText(text);
    toast.success(`Copied ${label} to clipboard.`);
  };

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Users"
        description="Search accounts, enforce security policies, manage subscriptions, ban abusers, and assume support sessions."
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              className="rounded-lg"
              onClick={() => void usersQuery.refetch()}
              disabled={usersQuery.isFetching}
            >
              <RotateCw className={usersQuery.isFetching ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
              Refresh
            </Button>
            <Button size="sm" className="rounded-lg" onClick={() => setShowCreate((open) => !open)}>
              {showCreate ? <X className="h-3.5 w-3.5" /> : <UserPlus className="h-3.5 w-3.5" />}
              {showCreate ? "Cancel" : "New user"}
            </Button>
          </>
        }
      />

      {showCreate && (
        <Panel className="p-5">
          <form
            onSubmit={createForm.handleSubmit((values) => createMutation.mutate(values))}
            className="grid gap-3 sm:grid-cols-[1fr_1fr_140px_auto] sm:items-start"
          >
            <div className="space-y-1.5">
              <Label htmlFor="new-email">Email</Label>
              <Input
                id="new-email"
                type="email"
                autoComplete="off"
                placeholder="person@example.com"
                aria-invalid={Boolean(createForm.formState.errors.email)}
                {...createForm.register("email")}
              />
              {createForm.formState.errors.email && (
                <p className="text-[11px] text-destructive">{createForm.formState.errors.email.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-password">Password</Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                placeholder="At least 8 characters"
                aria-invalid={Boolean(createForm.formState.errors.password)}
                {...createForm.register("password")}
              />
              {createForm.formState.errors.password && (
                <p className="text-[11px] text-destructive">
                  {createForm.formState.errors.password.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              {isSuperAdmin ? (
                <Controller
                  control={createForm.control}
                  name="role"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">User</SelectItem>
                        <SelectItem value="admin">Administrator</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              ) : (
                <div className="flex h-9 items-center rounded-md border border-outline-variant/40 bg-muted/40 px-3 text-sm text-on-surface-variant">
                  User
                </div>
              )}
            </div>
            <Button
              type="submit"
              className="rounded-lg sm:mt-[26px]"
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? (
                <RotateCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <UserPlus className="h-3.5 w-3.5" />
              )}
              Create
            </Button>
          </form>
          {isSuperAdmin && createRole === "admin" && (
            <div className="mt-4 space-y-2 border-t border-outline-variant/20 pt-4">
              <div>
                <Label>Section access</Label>
                <p className="mt-1 text-[11px] text-on-surface-variant">
                  Choose which admin sections this administrator can open. You can change this
                  later from the actions column.
                </p>
              </div>
              <PermissionChecklist value={createPermissions} onChange={setCreatePermissions} />
            </div>
          )}
        </Panel>
      )}

      {/* Real-time Search and Multi-filter Controls */}
      <Panel className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[240px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant" />
            <Input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search by email, User ID, phone, referral code…"
              className="h-9 pl-9 text-xs"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={roleFilter}
              onValueChange={(val) => {
                setRoleFilter(val);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-9 w-[120px] text-xs">
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="user">User</SelectItem>
                <SelectItem value="admin">Administrator</SelectItem>
                <SelectItem value="superadmin">Super admin</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={planFilter}
              onValueChange={(val) => {
                setPlanFilter(val);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-9 w-[120px] text-xs">
                <SelectValue placeholder="Plan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Plans</SelectItem>
                <SelectItem value="free">Free</SelectItem>
                <SelectItem value="pro">Pro</SelectItem>
                <SelectItem value="business">Business</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={statusFilter}
              onValueChange={(val) => {
                setStatusFilter(val);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-9 w-[130px] text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
                <SelectItem value="banned">Banned</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Panel>

      <Panel className="overflow-hidden">
        {usersQuery.error && users.length === 0 ? (
          <ErrorState
            message={messageOf(usersQuery.error, "Could not load users.")}
            onRetry={() => void usersQuery.refetch()}
          />
        ) : usersQuery.isLoading && users.length === 0 ? (
          <LoadingRows rows={6} cols={5} />
        ) : users.length === 0 ? (
          <EmptyState
            title="No matching users found"
            hint="Try clearing your search query or filters."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-outline-variant/20 text-left font-mono text-[10px] uppercase tracking-widest text-on-surface-variant">
                  <th className="min-w-[240px] px-4 py-3 font-medium">User</th>
                  <th className="w-[125px] px-4 py-3 font-medium">Role</th>
                  <th className="w-[125px] px-4 py-3 font-medium">Plan</th>
                  <th className="w-[145px] px-4 py-3 font-medium">Credits</th>
                  <th className="w-[135px] px-4 py-3 font-medium">Created</th>
                  <th className="w-[160px] px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {currentPageUsers.map((record) => {
                  const isSelf = currentUser?.id === record.id;
                  const rolePending =
                    roleMutation.isPending && roleMutation.variables?.id === record.id;
                  const resetPending =
                    resetMutation.isPending && resetMutation.variables?.id === record.id;
                  const isBlocked = record.status === "banned" || record.status === "suspended";

                  return (
                    <React.Fragment key={record.id}>
                      <tr
                        className={`border-b border-outline-variant/10 transition-colors last:border-b-0 hover:bg-surface-container-high/20 ${
                          isBlocked ? "bg-destructive/5 dark:bg-destructive/10" : ""
                        }`}
                      >
                        {/* 1. User & Standing */}
                        <td className="align-middle px-4 py-3">
                          <div className="flex items-center gap-3">
                            <span
                              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-mono text-xs font-bold ${
                                isBlocked
                                  ? "bg-destructive/20 text-destructive"
                                  : "bg-primary/15 text-primary"
                              }`}
                            >
                              {initialsOf(record.email)}
                            </span>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="truncate font-semibold text-foreground text-xs">{record.email}</span>
                                <button
                                  type="button"
                                  onClick={() => copyToClipboard(record.email, "email")}
                                  title="Copy Email"
                                  className="text-on-surface-variant hover:text-foreground transition-colors"
                                >
                                  <Copy className="h-3 w-3" />
                                </button>
                              </div>
                              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                <StatusBadge status={record.status} />
                                <button
                                  type="button"
                                  onClick={() => copyToClipboard(record.id, "User ID")}
                                  title="Click to copy ID"
                                  className="inline-flex items-center gap-1 rounded-md bg-muted/60 px-1.5 py-0.5 font-mono text-[10px] text-on-surface-variant hover:bg-muted hover:text-foreground transition-colors"
                                >
                                  <span>{record.id.slice(0, 8)}</span>
                                  <Copy className="h-2.5 w-2.5 opacity-60" />
                                </button>
                                {isSelf && (
                                  <span className="rounded-md bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                                    You
                                  </span>
                                )}
                              </div>
                              {record.banReason && (
                                <p className="mt-1 text-[11px] italic text-destructive">
                                  Reason: {record.banReason}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* 2. Role */}
                        <td className="align-middle px-4 py-3">
                          {isSuperAdmin && !isSelf && record.role !== "superadmin" ? (
                            <div className="flex items-center gap-1.5">
                              <Select
                                value={record.role}
                                onValueChange={(value) =>
                                  triggerWithSudoCheck(() =>
                                    roleMutation.mutate({
                                      id: record.id,
                                      email: record.email,
                                      role: value as UserRole,
                                    }),
                                  )
                                }
                                disabled={rolePending}
                              >
                                <SelectTrigger className="h-8 w-[125px] text-xs font-medium">
                                  <SelectValue placeholder="Role">
                                    {record.role === "admin" ? "Administrator" : "User"}
                                  </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="user">User</SelectItem>
                                  <SelectItem value="admin">Administrator</SelectItem>
                                </SelectContent>
                              </Select>
                              {rolePending && <RotateCw className="h-3.5 w-3.5 animate-spin text-primary" />}
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <RoleBadge role={record.role} />
                            </div>
                          )}
                        </td>

                        {/* 3. Plan */}
                        <td className="align-middle px-4 py-3">
                          <Select
                            value={record.plan}
                            onValueChange={(value) =>
                              planMutation.mutate({
                                id: record.id,
                                email: record.email,
                                plan: value as UserPlan,
                              })
                            }
                            disabled={planMutation.isPending}
                          >
                            <SelectTrigger className="h-8 w-[115px] text-xs font-medium">
                              <SelectValue placeholder="Plan">
                                {record.plan ? record.plan.charAt(0).toUpperCase() + record.plan.slice(1) : "Free"}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="free">Free</SelectItem>
                              <SelectItem value="pro">Pro</SelectItem>
                              <SelectItem value="business">Business</SelectItem>
                            </SelectContent>
                          </Select>
                          {record.planExpiresAt != null && (
                            <p className="mt-1 max-w-[115px] truncate font-mono text-[10px] uppercase text-primary" title={`Ends ${formatDateTime(record.planExpiresAt)}`}>
                              promo · ends {formatDateTime(record.planExpiresAt).slice(0, 12)}
                            </p>
                          )}
                        </td>

                        {/* 4. Credits */}
                        <td className="align-middle px-4 py-3">
                          <div className="flex flex-col gap-1">
                            <span className="font-mono text-xs font-bold text-foreground">
                              {record.credits.toLocaleString()} <span className="font-sans font-normal text-[10px] text-on-surface-variant">credits</span>
                            </span>
                            <CreditsAdjustForm
                              pending={
                                creditsMutation.isPending &&
                                creditsMutation.variables?.id === record.id
                              }
                              onGrant={(amount) =>
                                creditsMutation.mutate({
                                  id: record.id,
                                  email: record.email,
                                  amount,
                                })
                              }
                            />
                          </div>
                        </td>

                        {/* 5. Created */}
                        <td className="align-middle px-4 py-3 whitespace-nowrap">
                          <p className="text-xs font-medium text-foreground">{formatDateTime(record.createdAt).split("·")[0]}</p>
                          <p className="text-[11px] text-on-surface-variant">{timeAgo(record.createdAt)}</p>
                        </td>

                        {/* 6. Actions */}
                        <td className="align-middle px-4 py-3 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end gap-1">
                            {/* Impersonate */}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 rounded-lg text-primary hover:bg-primary/10"
                              onClick={() =>
                                triggerWithSudoCheck(() =>
                                  impersonateMutation.mutate({
                                    id: record.id,
                                    email: record.email,
                                  }),
                                )
                              }
                              disabled={isSelf || isBlocked}
                              title="Assume support session"
                              aria-label="Assume support session"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Button>

                            {/* Ban or Unban */}
                            {record.status !== "active" ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 rounded-lg text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400"
                                onClick={() =>
                                  triggerWithSudoCheck(() =>
                                    statusMutation.mutate({
                                      id: record.id,
                                      email: record.email,
                                      status: "active",
                                    }),
                                  )
                                }
                                title="Reactivate account"
                                aria-label="Reactivate account"
                              >
                                <UserCheck className="h-3.5 w-3.5" />
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 rounded-lg text-amber-600 hover:bg-amber-500/10 dark:text-amber-400"
                                onClick={() => setBanModalUser(record)}
                                disabled={isSelf}
                                title="Restrict account"
                                aria-label="Restrict account"
                              >
                                <Ban className="h-3.5 w-3.5" />
                              </Button>
                            )}

                            {/* Reset password */}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-foreground"
                              onClick={() => setResetId((id) => (id === record.id ? null : record.id))}
                              title="Reset password"
                              aria-label="Reset password"
                            >
                              <KeyRound className="h-3.5 w-3.5" />
                            </Button>

                            {/* Manage section access */}
                            {isSuperAdmin && record.role === "admin" && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 rounded-lg text-primary hover:bg-primary/10"
                                onClick={() => {
                                  setPermissionsUser(record);
                                  setPermissionsDraft(record.permissions ?? []);
                                }}
                                title="Manage section access"
                                aria-label="Manage section access"
                              >
                                <Settings2 className="h-3.5 w-3.5" />
                              </Button>
                            )}

                            {/* Revoke sessions */}
                            <ConfirmButton
                              label="Revoke sessions"
                              confirmLabel="Revoke?"
                              variant="ghost"
                              size="icon"
                              icon={<ShieldOff className="h-3.5 w-3.5" />}
                              title="Revoke all sessions"
                              onConfirm={() =>
                                revokeMutation.mutateAsync({ id: record.id, email: record.email })
                              }
                              className="h-7 w-7 text-on-surface-variant hover:bg-surface-container-high hover:text-foreground"
                            />

                            {/* Delete */}
                            <ConfirmButton
                              label="Delete user"
                              confirmLabel="Delete?"
                              variant="destructive"
                              size="icon"
                              icon={<Trash2 className="h-3.5 w-3.5" />}
                              title="Delete user"
                              onConfirm={() =>
                                triggerWithSudoCheck(() =>
                                  deleteMutation.mutate({ id: record.id, email: record.email }),
                                )
                              }
                              disabled={isSelf}
                              className="h-7 w-7"
                            />
                          </div>
                        </td>
                      </tr>
                      {resetId === record.id && (
                        <tr className="border-b border-outline-variant/10 bg-surface-container-high/30">
                          <td colSpan={6} className="px-4 py-3">
                            <ResetPasswordForm
                              key={record.id}
                              pending={resetPending}
                              onSave={(password) =>
                                triggerWithSudoCheck(() =>
                                  resetMutation.mutate({
                                    id: record.id,
                                    email: record.email,
                                    password,
                                  }),
                                )
                              }
                              onCancel={() => setResetId(null)}
                            />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Controls */}
        {totalUsers > 0 && (
          <div className="flex flex-wrap items-center justify-between border-t border-outline-variant/15 px-4 py-3 text-xs text-on-surface-variant">
            <div className="flex items-center gap-2">
              <span>Showing {currentPageUsers.length} of {totalUsers} users</span>
              <Select
                value={String(pageSize)}
                onValueChange={(val) => {
                  setPageSize(Number(val));
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-7 w-24 text-[11px]">
                  <SelectValue placeholder="Page size">{`${pageSize} / page`}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10 / page</SelectItem>
                  <SelectItem value="25">25 / page</SelectItem>
                  <SelectItem value="50">50 / page</SelectItem>
                  <SelectItem value="100">100 / page</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px]">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-7 w-7 rounded-lg p-0"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 w-7 rounded-lg p-0"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </Panel>

      {/* Account Restriction Modal */}
      {banModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in-0 duration-150">
          <div className="glass-panel w-full max-w-md overflow-hidden rounded-3xl border border-outline-variant/30 bg-surface/95 p-6 shadow-2xl">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-destructive/15 text-destructive">
                  <ShieldAlert className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="font-display text-[16px] font-bold">Restrict User Account</h3>
                  <p className="text-xs text-on-surface-variant truncate max-w-[240px]">{banModalUser.email}</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full"
                onClick={() => setBanModalUser(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="mt-4 space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Restriction Level</Label>
                <Select
                  value={banActionType}
                  onValueChange={(val) => setBanActionType(val as "suspended" | "banned")}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="suspended">Suspended (Temporary Freeze)</SelectItem>
                    <SelectItem value="banned">Banned (Permanent Revocation)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Reason for Restriction</Label>
                <Input
                  type="text"
                  placeholder="e.g. Chargeback, Terms of Service violation, Spamming"
                  value={banReason}
                  onChange={(e) => setBanReason(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl"
                  onClick={() => setBanModalUser(null)}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  className="rounded-xl"
                  onClick={() =>
                    triggerWithSudoCheck(() =>
                      statusMutation.mutate({
                        id: banModalUser.id,
                        email: banModalUser.email,
                        status: banActionType,
                        banReason: banReason.trim() || undefined,
                      }),
                    )
                  }
                >
                  Confirm Restriction
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Section Access Modal */}
      {permissionsUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in-0 duration-150">
          <div className="glass-panel w-full max-w-lg overflow-hidden rounded-3xl border border-outline-variant/30 bg-surface/95 p-6 shadow-2xl">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                  <Settings2 className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="font-display text-[16px] font-bold">Section Access</h3>
                  <p className="text-xs text-on-surface-variant truncate max-w-[260px]">
                    {permissionsUser.email}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full"
                onClick={() => setPermissionsUser(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <p className="mt-3 text-xs text-on-surface-variant">
              Pick the admin sections this administrator can open. The super administrator always
              has access to everything.
            </p>

            <div className="mt-3 flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 rounded-lg px-2 text-[11px]"
                onClick={() => setPermissionsDraft([...ADMIN_PERMISSIONS])}
              >
                Select all
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 rounded-lg px-2 text-[11px]"
                onClick={() => setPermissionsDraft([])}
              >
                Clear all
              </Button>
            </div>

            <div className="mt-3">
              <PermissionChecklist
                value={permissionsDraft}
                onChange={setPermissionsDraft}
                disabled={permissionsMutation.isPending}
              />
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl"
                onClick={() => setPermissionsUser(null)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="rounded-xl"
                disabled={permissionsMutation.isPending}
                onClick={() => {
                  const target = permissionsUser;
                  triggerWithSudoCheck(() =>
                    permissionsMutation.mutate({
                      id: target.id,
                      email: target.email,
                      permissions: permissionsDraft,
                    }),
                  );
                }}
              >
                {permissionsMutation.isPending && (
                  <RotateCw className="h-3.5 w-3.5 animate-spin" />
                )}
                Save access
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Sudo Mode Re-Auth Modal */}
      <AdminSudoDialog
        open={sudoOpen}
        onSuccess={handleSudoSuccess}
        onCancel={() => {
          setSudoOpen(false);
          pendingActionRef.current = null;
        }}
      />

      <p className="text-xs text-on-surface-variant">
        The super administrator can create administrators and limit each one to specific sections. The
        super administrator cannot be demoted, deleted, or restricted. Impersonation sessions and
        restrictions are permanently audited.
      </p>
    </div>
  );
}

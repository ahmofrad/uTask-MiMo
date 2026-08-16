"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { useFormattedDate } from "@/lib/date/useFormattedDate";
import { apiFetch } from "@/lib/api-fetch";

type UserWithRole = {
  id: string;
  email: string;
  displayName: string;
  status: string;
  ldapGroup: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  inviteExpiresAt: string | null;
  roles: { type: string }[];
};

const STATUS_FILTERS = ["all", "active", "suspended", "invited"] as const;

type Props = {
  users: UserWithRole[];
};

const USER_ROLES = ["owner", "admin", "manager", "member", "guest"] as const;

type Role = (typeof USER_ROLES)[number];

function getRole(roles: { type: string }[]): string {
  return roles[0]?.type ?? "none";
}

export function AdminUserList({ users }: Props) {
  const t = useTranslations("admin");
  const { date } = useFormattedDate();
  const [list, setList] = useState(users);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [createOpen, setCreateOpen] = useState(false);

  const visible = statusFilter === "all" ? list : list.filter((u) => u.status === statusFilter);

  const { addToast } = useToast();

  async function resendInvite(userId: string) {
    const res = await apiFetch(`/api/v1/users/${userId}/invite`, { method: "POST" });
    if (res.ok) {
      addToast({ message: t("inviteSent") });
    } else {
      addToast({ message: t("inviteFailed") });
    }
  }

  async function toggleSuspend(userId: string, currentStatus: string) {
    const res = await apiFetch(`/api/v1/users/${userId}/suspend`, { method: "POST" });
    if (res.ok) {
      setList((prev) =>
        prev.map((u) =>
          u.id === userId
            ? { ...u, status: currentStatus === "suspended" ? "active" : "suspended" }
            : u,
        ),
      );
    }
  }

  function handleCreated(user: UserWithRole) {
    setList((prev) => [user, ...prev]);
    setCreateOpen(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <label className="flex items-center gap-2 text-sm text-fg-secondary">
          <span>{t("statusFilter")}</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2 py-1.5 border border-border-primary rounded-md bg-bg-primary text-fg-primary text-sm"
          >
            {STATUS_FILTERS.map((s) => (
              <option key={s} value={s}>
                {t(`statusFilter_${s}`)}
              </option>
            ))}
          </select>
        </label>
        <Button onClick={() => setCreateOpen(true)}>{t("newUser")}</Button>
      </div>
      {createOpen && <CreateUserDialog onClose={() => setCreateOpen(false)} onCreated={handleCreated} />}
      <div className="overflow-x-auto border border-border-primary rounded-lg">
      <table className="w-full text-sm">
        <thead className="bg-bg-secondary text-fg-secondary">
          <tr>
            <th className="text-start ps-4 pe-4 py-3 font-medium">{t("name")}</th>
            <th className="text-start ps-4 pe-4 py-3 font-medium">{t("email")}</th>
            <th className="text-start ps-4 pe-4 py-3 font-medium">{t("role")}</th>
            <th className="text-start ps-4 pe-4 py-3 font-medium">{t("ldapSource")}</th>
            <th className="text-start ps-4 pe-4 py-3 font-medium">{t("status")}</th>
            <th className="text-start ps-4 pe-4 py-3 font-medium">{t("actions")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-primary">
          {visible.map((u) => (
            <tr key={u.id} className="hover:bg-bg-secondary/50">
              <td className="ps-4 pe-4 py-3 text-fg-primary">{u.displayName}</td>
              <td className="ps-4 pe-4 py-3 text-fg-secondary">{u.email}</td>
              <td className="ps-4 pe-4 py-3">
                <span className="px-2 py-1 text-xs rounded-full bg-accent/10 text-accent">
                  {getRole(u.roles)}
                </span>
              </td>
              <td className="ps-4 pe-4 py-3">
                {u.ldapGroup ? (
                  <span className="px-2 py-1 text-xs rounded-full bg-accent/10 text-accent">
                    LDAP · {u.ldapGroup}
                  </span>
                ) : (
                  <span className="text-xs text-fg-muted">{t("ldapLocal")}</span>
                )}
              </td>
              <td className="ps-4 pe-4 py-3">
                <span
                  className={`px-2 py-1 text-xs rounded-full ${
                    u.status === "active"
                      ? "bg-success-bg text-success"
                      : u.status === "suspended"
                        ? "bg-danger-bg text-destructive"
                        : "bg-warning-bg text-warning"
                  }`}
                >
                  {u.status === "ldapGroupRemoved" ? t("ldapGroupRemoved") : u.status}
                </span>
              </td>
              <td className="ps-4 pe-4 py-3">
                {u.status === "ldapGroupRemoved" ? (
                  <span className="text-xs text-fg-muted">—</span>
                ) : (
                  <div className="flex items-center gap-2">
                    {u.status === "invited" && (
                      <div className="flex flex-col items-start gap-1">
                        <Button variant="ghost" size="sm" onClick={() => void resendInvite(u.id)}>
                          {t("resendInvite")}
                        </Button>
                        {u.inviteExpiresAt && (
                          <span className="text-xs text-fg-muted">
                            {t("inviteExpires", { date: date(u.inviteExpiresAt) })}
                          </span>
                        )}
                      </div>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleSuspend(u.id, u.status)}
                    >
                      {u.status === "suspended" ? t("restore") : t("suspend")}
                    </Button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}

function CreateUserDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (_user: UserWithRole) => void }) {
  const t = useTranslations("admin");
  const tc = useTranslations("common");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("member");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !displayName.trim() || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await apiFetch("/api/v1/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          displayName: displayName.trim(),
          ...(password ? { password } : {}),
          role,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        data?: { id?: string; email?: string; displayName?: string; status?: string };
      };
      if (!res.ok) {
        if (res.status === 409) throw new Error(t("newUserConflict"));
        throw new Error((body as { error?: { message?: string } }).error?.message ?? t("createFailed"));
      }
      const created = body.data;
      if (!created?.id) throw new Error(t("createFailed"));
      // The API returns a slim shape; pad it to the row type so the table
      // renders immediately without a reload.
      onCreated({
        id: created.id,
        email: created.email ?? "",
        displayName: created.displayName ?? "",
        status: created.status ?? "active",
        ldapGroup: null,
        lastLoginAt: null,
        createdAt: new Date().toISOString(),
        inviteExpiresAt: null,
        roles: [{ type: role }],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("createFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass =
    "w-full px-3 py-2 border border-border-primary rounded-lg bg-bg-primary text-fg-primary text-sm placeholder:text-fg-subtle focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-colors";

  return (
    <Dialog open onClose={onClose} title={t("newUserTitle")} className="max-w-md">
      <p className="text-sm text-fg-secondary mb-4">{t("newUserDescription")}</p>
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        <div>
          <label htmlFor="new-user-email" className="block text-sm font-medium text-fg-secondary mb-1.5">
            {t("newUserEmail")} *
          </label>
          <input
            id="new-user-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
            required
            autoComplete="off"
            autoFocus
          />
        </div>
        <div>
          <label htmlFor="new-user-name" className="block text-sm font-medium text-fg-secondary mb-1.5">
            {t("newUserDisplayName")} *
          </label>
          <input
            id="new-user-name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className={inputClass}
            required
            autoComplete="off"
          />
        </div>
        <div>
          <label htmlFor="new-user-password" className="block text-sm font-medium text-fg-secondary mb-1.5">
            {t("newUserPassword")}
          </label>
          <input
            id="new-user-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
            minLength={8}
            autoComplete="new-password"
          />
          <p className="mt-1 text-xs text-fg-muted">{t("newUserPasswordHint")}</p>
        </div>
        <div>
          <label htmlFor="new-user-role" className="block text-sm font-medium text-fg-secondary mb-1.5">
            {t("newUserRole")}
          </label>
          <select
            id="new-user-role"
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            className={inputClass}
          >
            {USER_ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
            {tc("cancel")}
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? t("newUserCreating") : t("newUserTitle")}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

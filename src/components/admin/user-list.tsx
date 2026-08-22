"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useFormattedDate } from "@/lib/date/useFormattedDate";
import { apiFetch } from "@/lib/api-fetch";
import { CreateUserDialog, type UserWithRole } from "./user-create-dialog";

const STATUS_FILTERS = ["all", "active", "suspended", "invited"] as const;

type Props = {
  users: UserWithRole[];
};

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


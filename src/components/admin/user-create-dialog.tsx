"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { apiFetch } from "@/lib/api-fetch";

export type UserWithRole = {
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

const USER_ROLES = ["owner", "admin", "manager", "member", "guest"] as const;

type Role = (typeof USER_ROLES)[number];

type Props = {
  onClose: () => void;
  onCreated: (_user: UserWithRole) => void;
};

export function CreateUserDialog({ onClose, onCreated }: Props) {
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

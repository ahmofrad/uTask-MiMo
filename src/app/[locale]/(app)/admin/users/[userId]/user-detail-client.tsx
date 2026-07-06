"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api-fetch";

type Props = {
  userId: string;
  displayName: string | null;
  email: string;
  status: string;
  globalRole: string | null;
  projectMemberships: { projectId: string; projectName: string; projectRole: string }[];
};

export function UserDetailClient({ userId, displayName, email, status, globalRole: initialRole, projectMemberships: initialMemberships }: Props) {
  const t = useTranslations("admin");
  const [globalRole, setGlobalRole] = useState(initialRole ?? "member");
  const [saving, setSaving] = useState(false);
  const [memberships, setMemberships] = useState(initialMemberships);

  async function updateGlobalRole(newRole: string) {
    setSaving(true);
    setGlobalRole(newRole);
    try {
      await apiFetch(`/api/v1/admin/users/${userId}/role`, {
        method: "PATCH",
        body: JSON.stringify({ role: newRole }),
      });
    } finally {
      setSaving(false);
    }
  }

  async function updateProjectRole(projectId: string, newRole: string) {
    setSaving(true);
    try {
      await apiFetch(`/api/v1/admin/projects/${projectId}/members/${userId}`, {
        method: "PATCH",
        body: JSON.stringify({ projectRole: newRole }),
      });
      setMemberships((prev) => prev.map((m) => m.projectId === projectId ? { ...m, projectRole: newRole } : m));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Profile */}
      <div className="border border-border-primary rounded-xl bg-bg-surface p-5 space-y-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-bg-surface-2 flex items-center justify-center text-fg-secondary text-lg font-medium">
            {displayName?.charAt(0)?.toUpperCase() ?? "?"}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-fg-primary">{displayName}</h1>
            <p className="text-sm text-fg-muted">{email}</p>
          </div>
          <span className={`text-xs px-2 py-1 rounded-full ${status === "active" ? "bg-success-bg text-success" : "bg-danger-bg text-danger"}`}>
            {status}
          </span>
        </div>
      </div>

      {/* Global Role */}
      <div className="border border-border-primary rounded-xl bg-bg-surface p-5 space-y-3">
        <h2 className="text-xs font-medium text-fg-muted uppercase tracking-wide">{t("globalRole")}</h2>
        <div className="flex items-center gap-3">
          <select
            value={globalRole}
            onChange={(e) => updateGlobalRole(e.target.value)}
            disabled={saving}
            className="px-3 py-2 border border-border-primary rounded-lg bg-bg-primary text-fg-primary text-sm focus:outline-none focus:ring-1 focus:ring-accent"
          >
            <option value="owner">{t("owner")}</option>
            <option value="admin">{t("adminRole")}</option>
            <option value="manager">{t("manager")}</option>
            <option value="member">{t("member")}</option>
            <option value="guest">{t("guest")}</option>
          </select>
          {saving && <span className="text-xs text-fg-muted">Saving...</span>}
        </div>
        <p className="text-xs text-fg-tertiary">
          {t("roleOverrideNote")}
        </p>
      </div>

      {/* Project Memberships */}
      <div className="border border-border-primary rounded-xl bg-bg-surface p-5 space-y-3">
        <h2 className="text-xs font-medium text-fg-muted uppercase tracking-wide">{t("projectMemberships")}</h2>
        {memberships.length === 0 ? (
          <p className="text-sm text-fg-muted">{t("noProjectMembers")}</p>
        ) : (
          <div className="space-y-3">
            {memberships.map((m) => (
              <div key={m.projectId} className="flex items-center justify-between p-3 rounded-lg bg-bg-primary border border-border-secondary">
                <span className="text-sm font-medium text-fg-primary">{m.projectName}</span>
                <select
                  value={m.projectRole}
                  onChange={(e) => updateProjectRole(m.projectId, e.target.value)}
                  disabled={saving}
                  className="px-2 py-1 border border-border-primary rounded-lg bg-bg-surface text-fg-primary text-xs focus:outline-none focus:ring-1 focus:ring-accent"
                >
                  <option value="lead">{t("lead")}</option>
                  <option value="contributor">{t("contributor")}</option>
                  <option value="viewer">{t("viewer")}</option>
                </select>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

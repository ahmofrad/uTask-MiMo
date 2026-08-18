"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useFormattedDate } from "@/lib/date/useFormattedDate";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-fetch";

type GroupInfo = {
  id: string;
  name: string;
  memberCount: number;
  lastSyncedAt: string | null;
};

type SourceInfo = {
  id: string;
  name: string;
  enabled: boolean;
  lastSyncedAt: string | null;
  lastSyncError: string | null;
  syncIntervalHours: number;
  groupCount: number;
  memberCount: number;
  groups: GroupInfo[];
};

type SyncStatus = {
  sources: SourceInfo[];
  totalGroups: number;
  totalMembers: number;
  totalDistinctUsers: number;
};

export function LdapSyncDashboard() {
  const t = useTranslations("admin");
  const { dateTime } = useFormattedDate();
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  useEffect(() => {
    apiFetch("/api/v1/admin/ldap/sync-status")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((json) => setStatus(json.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleSync(sourceId: string) {
    setSyncingId(sourceId);
    setSyncResult(null);
    try {
      const res = await apiFetch(`/api/v1/admin/ldap-sources/${sourceId}/sync`, { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        setSyncResult(t("ldapSyncDone", { users: json.data?.users ?? 0, groups: json.data?.groups ?? 0 }));
        // Refresh the dashboard
        const fresh = await apiFetch("/api/v1/admin/ldap/sync-status");
        if (fresh.ok) {
          const freshJson = await fresh.json();
          setStatus(freshJson.data);
        }
      } else {
        setSyncResult(t("ldapConnectionFailed", { msg: json.error?.message ?? "Unknown error" }));
      }
    } catch {
      setSyncResult(t("syncFailed"));
    }
    setSyncingId(null);
  }

  if (loading) {
    return <p className="text-sm text-fg-muted">{t("loading")}</p>;
  }

  if (!status) {
    return <p className="text-sm text-fg-muted">{t("loadFailed")}</p>;
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label={t("ldapSources")} value={status.sources.length} icon="Sources" />
        <StatCard label={t("ldapGroups")} value={status.totalGroups} icon="Groups" />
        <StatCard label={t("ldapDistinctUsers")} value={status.totalDistinctUsers} icon="Users" />
        <StatCard label={t("ldapTotalMemberships")} value={status.totalMembers} icon="Memberships" />
      </div>

      {/* Sync Result */}
      {syncResult && (
        <div className="p-3 rounded-lg bg-accent/10 border border-accent/20 text-sm text-fg-primary">
          {syncResult}
        </div>
      )}

      {/* Source Details */}
      {status.sources.length === 0 ? (
        <p className="text-sm text-fg-muted italic">{t("noSources")}</p>
      ) : (
        <div className="space-y-4">
          {status.sources.map((source) => (
            <div key={source.id} className="rounded-lg border border-border-primary bg-bg-surface p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className={`w-2.5 h-2.5 rounded-full ${source.enabled ? "bg-success" : "bg-fg-muted"}`} />
                  <h3 className="font-medium text-fg-primary">{source.name}</h3>
                  <span className="text-xs text-fg-muted px-2 py-0.5 rounded-full bg-bg-secondary">
                    {source.syncIntervalHours}h {t("syncInterval")}
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void handleSync(source.id)}
                  disabled={syncingId === source.id || !source.enabled}
                >
                  {syncingId === source.id ? t("ldapSyncing") : t("ldapSyncNow")}
                </Button>
              </div>

              {/* Status Row */}
              <div className="flex items-center gap-6 text-xs text-fg-muted mb-3">
                <span>
                  {t("lastSynced")}:{" "}
                  {source.lastSyncedAt ? dateTime(source.lastSyncedAt) : t("never")}
                </span>
                <span>
                  {t("ldapGroups")}: {source.groupCount}
                </span>
                <span>
                  {t("ldapTotalMemberships")}: {source.memberCount}
                </span>
              </div>

              {/* Error */}
              {source.lastSyncError && (
                <div className="p-2 rounded bg-danger/10 border border-danger/20 text-xs text-danger mb-3">
                  {source.lastSyncError}
                </div>
              )}

              {/* Groups Table */}
              {source.groups.length > 0 && (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border-primary">
                      <th className="text-start py-1.5 text-fg-secondary font-medium">{t("name")}</th>
                      <th className="text-start py-1.5 text-fg-secondary font-medium">{t("ldapTotalMemberships")}</th>
                      <th className="text-start py-1.5 text-fg-secondary font-medium">{t("lastSynced")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {source.groups.map((group) => (
                      <tr key={group.id} className="border-b border-border-primary/50">
                        <td className="py-1.5 text-fg-primary">{group.name}</td>
                        <td className="py-1.5 text-fg-muted">{group.memberCount}</td>
                        <td className="py-1.5 text-fg-muted">
                          {group.lastSyncedAt ? dateTime(group.lastSyncedAt) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: string }) {
  return (
    <div className="p-4 rounded-xl border border-border-primary bg-bg-surface">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-fg-muted uppercase tracking-wide">{label}</span>
        <span className="text-fg-tertiary text-xs">{icon}</span>
      </div>
      <p className="text-2xl font-bold text-fg-primary">{value}</p>
    </div>
  );
}

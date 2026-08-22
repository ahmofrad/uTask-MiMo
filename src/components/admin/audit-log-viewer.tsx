"use client";

import { memo, useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useFormattedDate } from "@/lib/date/useFormattedDate";
import { apiFetch } from "@/lib/api-fetch";
import { Button } from "@/components/ui/button";

type AuditEntry = {
  id: string;
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  beforeJson: unknown;
  afterJson: unknown;
  occurredAt: string;
  actor?: { id: string; displayName: string; email: string } | null;
};

const ACTION_OPTIONS = [
  "task_created",
  "task_updated",
  "task_deleted",
  "comment_created",
  "comment_updated",
  "comment_deleted",
  "project_created",
  "project_updated",
  "project_archived",
  "custom_field_created",
  "custom_field_updated",
  "custom_field_archived",
  "project_member_added",
  "project_member_removed",
  "group_created",
  "group_updated",
  "group_deleted",
  "group_member_added",
  "group_member_removed",
  "group_grant_created",
  "group_grant_revoked",
  "login_success",
  "login_failed",
  "logout",
  "settings_updated",
  "user_updated",
  "user_suspended",
  "user_unsuspended",
  "invite_sent",
  "invite_accepted",
  "api_token_created",
  "api_token_revoked",
  "webhook_created",
  "webhook_updated",
  "webhook_deleted",
  "watcher_added",
  "watcher_removed",
  "ldap_sync",
  "mail_test_sent",
  "session_revoked",
  "department_created",
  "department_updated",
  "department_deleted",
] as const;

type AuditLogViewerProps = {
  initialLogs: AuditEntry[];
  initialHasMore: boolean;
  initialNextCursor: string | null;
};

export const AuditLogViewer = memo(function AuditLogViewer({ initialLogs, initialHasMore, initialNextCursor }: AuditLogViewerProps) {
  const t = useTranslations("audit");
  const { dateTime } = useFormattedDate();
  const [logs, setLogs] = useState(initialLogs);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [nextCursor, setNextCursor] = useState(initialNextCursor);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Filters
  const [actionFilter, setActionFilter] = useState("");
  const [entityFilter, setEntityFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const fetchLogs = useCallback(async (cursor?: string, reset = false) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("limit", "100");
      if (cursor) params.set("cursor", cursor);
      if (actionFilter) params.set("action", actionFilter);
      if (entityFilter) params.set("entityType", entityFilter);

      const res = await apiFetch(`/api/v1/audit-log?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        const newLogs = data.data ?? [];
        if (reset) {
          setLogs(newLogs);
        } else {
          setLogs((prev) => [...prev, ...newLogs]);
        }
        setHasMore(data.meta?.hasMore ?? false);
        setNextCursor(data.meta?.nextCursor ?? null);
      }
    } catch {
      // silent
    }
    setLoading(false);
  }, [actionFilter, entityFilter]);

  useEffect(() => {
    void fetchLogs(undefined, true);
  }, [fetchLogs]);

  function handleFilterChange() {
    void fetchLogs(undefined, true);
  }

  function handleLoadMore() {
    if (nextCursor) void fetchLogs(nextCursor, false);
  }

  // Client-side date filtering
  const filtered = logs.filter((log) => {
    if (dateFrom && log.occurredAt < dateFrom) return false;
    if (dateTo && log.occurredAt > dateTo + "T23:59:59.999Z") return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const actorName = log.actor?.displayName ?? log.actor?.email ?? "";
      const entityName = log.entityType;
      if (!actorName.toLowerCase().includes(q) && !entityName.toLowerCase().includes(q) && !log.action.includes(q)) {
        return false;
      }
    }
    return true;
  });

  const entityTypeOptions = [...new Set(logs.map((l) => l.entityType))].sort();

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="rounded-lg border border-border-primary bg-bg-surface p-3 space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-fg-muted">{t("filters")}</span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-fg-secondary">
            <span className="shrink-0">{t("action")}</span>
            <select
              value={actionFilter}
              onChange={(e) => { setActionFilter(e.target.value); }}
              className="text-xs bg-bg-primary border border-border rounded px-1.5 py-1 text-fg-primary"
            >
              <option value="">{t("all")}</option>
              {ACTION_OPTIONS.map((a) => (
                <option key={a} value={a}>{t.has(`actions.${a}`) ? t(`actions.${a}` as never) : a}</option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-1.5 text-xs text-fg-secondary">
            <span className="shrink-0">{t("entity")}</span>
            <select
              value={entityFilter}
              onChange={(e) => { setEntityFilter(e.target.value); }}
              className="text-xs bg-bg-primary border border-border rounded px-1.5 py-1 text-fg-primary"
            >
              <option value="">{t("all")}</option>
              {entityTypeOptions.map((et) => (
                <option key={et} value={et}>{et}</option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-1.5 text-xs text-fg-secondary">
            <span className="shrink-0">{t("from")}</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="text-xs bg-bg-primary border border-border rounded px-1.5 py-1 text-fg-primary"
            />
          </label>

          <label className="flex items-center gap-1.5 text-xs text-fg-secondary">
            <span className="shrink-0">{t("to")}</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="text-xs bg-bg-primary border border-border rounded px-1.5 py-1 text-fg-primary"
            />
          </label>

          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="text-xs bg-bg-primary border border-border rounded px-2 py-1 text-fg-primary placeholder:text-fg-tertiary w-48"
          />

          <Button variant="outline" size="sm" onClick={handleFilterChange}>
            {t("apply")}
          </Button>

          {(actionFilter || entityFilter || dateFrom || dateTo || searchQuery) && (
            <button
              type="button"
              onClick={() => {
                setActionFilter("");
                setEntityFilter("");
                setDateFrom("");
                setDateTo("");
                setSearchQuery("");
                void fetchLogs(undefined, true);
              }}
              className="text-xs font-medium text-accent hover:underline"
            >
              {t("clearFilters")}
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-primary">
              <th className="text-start p-2 text-fg-secondary">{t("time")}</th>
              <th className="text-start p-2 text-fg-secondary">{t("actor")}</th>
              <th className="text-start p-2 text-fg-secondary">{t("action")}</th>
              <th className="text-start p-2 text-fg-secondary">{t("entity")}</th>
              <th className="text-start p-2 text-fg-secondary w-8"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((log) => {
              const actionLabel = t.has(`actions.${log.action}`)
                ? t(`actions.${log.action}` as never)
                : log.action.replace(/_/g, " ");
              const isExpanded = expandedId === log.id;
              const hasChanges = log.beforeJson != null || log.afterJson != null;

              return (
                <tr key={log.id} className="border-b border-border-primary hover:bg-bg-secondary/50">
                  <td className="p-2 text-fg-primary whitespace-nowrap font-mono text-xs">
                    {dateTime(log.occurredAt)}
                  </td>
                  <td className="p-2 text-fg-primary whitespace-nowrap">
                    {log.actor?.displayName ?? log.actor?.email ?? "system"}
                  </td>
                  <td className="p-2">
                    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-accent/10 text-accent">
                      {actionLabel}
                    </span>
                  </td>
                  <td className="p-2 text-fg-secondary">
                    <span className="text-xs text-fg-muted">{log.entityType}</span>
                    <span className="font-mono text-xs text-fg-tertiary ms-2">{log.entityId.slice(0, 8)}…</span>
                  </td>
                  <td className="p-2">
                    {hasChanges && (
                      <button
                        type="button"
                        onClick={() => setExpandedId(isExpanded ? null : log.id)}
                        className="text-xs text-accent hover:underline"
                        aria-label={isExpanded ? t("hideDetails") : t("showDetails")}
                      >
                        {isExpanded ? "▲" : "▼"}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && !loading && (
              <tr>
                <td colSpan={5} className="p-4 text-center text-fg-tertiary">{t("empty")}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Expanded detail rows */}
      {expandedId && (() => {
        const log = filtered.find((l) => l.id === expandedId);
        if (!log) return null;
        const before = log.beforeJson as Record<string, unknown> | null;
        const after = log.afterJson as Record<string, unknown> | null;
        const allKeys = [...new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])];
        return (
          <div className="rounded-lg border border-border-primary bg-bg-surface p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-fg-secondary">
                {t("diff.field")}: {log.entityType} · {log.entityId.slice(0, 8)}…
              </span>
              <button type="button" onClick={() => setExpandedId(null)} className="text-xs text-fg-muted hover:text-fg-primary">
                {t("hideDetails")}
              </button>
            </div>
            {allKeys.length === 0 ? (
              <p className="text-xs text-fg-muted italic">{t("diff.noChanges")}</p>
            ) : (
              <div className="space-y-1">
                {allKeys.map((key) => {
                  const b = before?.[key];
                  const a = after?.[key];
                  if (b === a) return null;
                  return (
                    <div key={key} className="flex items-start gap-2 text-xs">
                      <span className="font-medium text-fg-muted shrink-0 w-24 truncate">{key}</span>
                      <span className="text-fg-muted truncate max-w-[40%]">{formatJsonVal(b)}</span>
                      <span className="text-fg-subtle">→</span>
                      <span className="text-fg-primary truncate max-w-[40%]">{formatJsonVal(a)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {/* Load more */}
      {hasMore && (
        <div className="text-center">
          <Button variant="outline" size="sm" onClick={handleLoadMore} disabled={loading}>
            {loading ? t("loading") : t("loadMore")}
          </Button>
        </div>
      )}
    </div>
  );
});

function formatJsonVal(val: unknown): string {
  if (val === undefined || val === null) return "—";
  if (typeof val === "object") return JSON.stringify(val);
  const str = String(val);
  return str.length > 80 ? str.slice(0, 80) + "…" : str;
}

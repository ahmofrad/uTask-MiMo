"use client";

import { memo, useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api-fetch";
import { Button } from "@/components/ui/button";
import { LogDiffDetails } from "./audit-log-diff";
import { AuditFilterBar } from "./audit-filter-bar";
import { AuditLogTable } from "./audit-log-table";

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

type AuditLogViewerProps = {
  initialLogs: AuditEntry[];
  initialHasMore: boolean;
  initialNextCursor: string | null;
};

export const AuditLogViewer = memo(function AuditLogViewer({
  initialLogs,
  initialHasMore,
  initialNextCursor,
}: AuditLogViewerProps) {
  const t = useTranslations("audit");
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

  function handleClearFilters() {
    setActionFilter("");
    setEntityFilter("");
    setDateFrom("");
    setDateTo("");
    setSearchQuery("");
    void fetchLogs(undefined, true);
  }

  function handleToggleExpand(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  // Client-side date + search filtering
  const filtered = logs.filter((log) => {
    if (dateFrom && log.occurredAt < dateFrom) return false;
    if (dateTo && log.occurredAt > dateTo + "T23:59:59.999Z") return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const actorName = log.actor?.displayName ?? log.actor?.email ?? "";
      const entityName = log.entityType;
      if (
        !actorName.toLowerCase().includes(q) &&
        !entityName.toLowerCase().includes(q) &&
        !log.action.includes(q)
      ) {
        return false;
      }
    }
    return true;
  });

  const entityTypeOptions = [...new Set(logs.map((l) => l.entityType))].sort();

  return (
    <div className="space-y-4">
      <AuditFilterBar
        actionFilter={actionFilter}
        entityFilter={entityFilter}
        dateFrom={dateFrom}
        dateTo={dateTo}
        searchQuery={searchQuery}
        entityTypeOptions={entityTypeOptions}
        onActionFilterChange={setActionFilter}
        onEntityFilterChange={setEntityFilter}
        onDateFromChange={setDateFrom}
        onDateToChange={setDateTo}
        onSearchQueryChange={setSearchQuery}
        onApply={handleFilterChange}
        onClear={handleClearFilters}
      />

      <AuditLogTable
        logs={filtered}
        expandedId={expandedId}
        loading={loading}
        onToggleExpand={handleToggleExpand}
      />

      {expandedId && (() => {
        const log = filtered.find((l) => l.id === expandedId);
        if (!log) return null;
        return (
          <LogDiffDetails
            entityType={log.entityType}
            entityId={log.entityId}
            before={log.beforeJson as Record<string, unknown> | null}
            after={log.afterJson as Record<string, unknown> | null}
            onClose={() => setExpandedId(null)}
          />
        );
      })()}

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

import { useCallback, useState } from "react";
import { apiFetch } from "@/lib/api-fetch";
import type { ActivityEvent } from "@/lib/activity/types";

export type UseTaskAuditOptions = {
  taskId: string;
  initialEvents: ActivityEvent[];
  initialHasMore: boolean | undefined;
  initialNextCursor: string | null | undefined;
};

export type UseTaskAuditReturn = {
  auditEvents: ActivityEvent[];
  auditHasMore: boolean;
  auditLimit: number;
  setAuditLimit: (limit: number) => void;
  refreshAudit: (limit?: number) => Promise<void>;
  loadMoreAudit: () => Promise<void>;
};

export function useTaskAudit({
  taskId,
  initialEvents,
  initialHasMore = false,
  initialNextCursor,
}: UseTaskAuditOptions): UseTaskAuditReturn {
  const [events, setEvents] = useState(initialEvents);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [cursor, setCursor] = useState<string | null | undefined>(initialNextCursor);
  const [limit, setLimit] = useState(10);

  const refreshAudit = useCallback(async (newLimit?: number) => {
    const res = await apiFetch(`/api/v1/activity/tasks/${taskId}?limit=${newLimit ?? limit}`);
    if (res.ok) {
      const data = await res.json();
      setEvents(data.items ?? []);
      setHasMore(data.hasMore ?? false);
      setCursor(data.nextCursor ?? null);
    }
  }, [limit, taskId]);

  const loadMoreAudit = useCallback(async () => {
    if (!cursor || !hasMore) return;
    const res = await apiFetch(`/api/v1/activity/tasks/${taskId}?cursor=${encodeURIComponent(cursor)}&limit=50`);
    if (res.ok) {
      const data = await res.json();
      setEvents((prev) => [...prev, ...(data.items ?? [])]);
      setHasMore(data.hasMore ?? false);
      setCursor(data.nextCursor ?? null);
    }
  }, [cursor, hasMore, taskId]);

  return {
    auditEvents: events,
    auditHasMore: hasMore,
    auditLimit: limit,
    setAuditLimit: setLimit,
    refreshAudit,
    loadMoreAudit,
  };
}

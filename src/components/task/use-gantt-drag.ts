import { useCallback, useRef } from "react";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api-fetch";
import {
  applyDragDelta,
  createDragState,
  dragPatchBody,
  roundedDragDelta,
  type DragMode,
  type DragState,
} from "@/lib/gantt/drag";
import { getTimelineDragRawDeltaDays, type TimelineDirection } from "@/lib/gantt/timeline";
import type { GanttRow } from "@/lib/gantt-types";

export type DragOverrides = Record<string, { startDate: string | null; dueDate: string | null }>;

type UseGanttDragParams = {
  dayWidth: number;
  direction: TimelineDirection;
  dateFor: (_r: GanttRow) => { start: Date | null; end: Date | null };
  setOverrides: React.Dispatch<React.SetStateAction<DragOverrides>>;
  onReload?: (() => void) | undefined;
  t: (_key: string, _params?: Record<string, string | number>) => string;
  tc: (_key: string) => string;
};

export function useGanttDrag({
  dayWidth,
  direction,
  dateFor,
  setOverrides,
  onReload,
  t,
  tc,
}: UseGanttDragParams) {
  const dragRef = useRef<DragState | null>(null);
  const { addToast } = useToast();

  const finalizeDrag = useCallback(
    async (d: DragState) => {
      const deltaDays = roundedDragDelta(d);
      if (deltaDays === 0) return;
      const snapped = applyDragDelta(d, deltaDays, true);
      setOverrides((prev) => ({
        ...prev,
        [snapped.id]: { startDate: snapped.currentStart.toISOString(), dueDate: snapped.currentEnd.toISOString() },
      }));
      const body = dragPatchBody(snapped);
      try {
        const res = await apiFetch(`/api/v1/tasks/${d.id}`, { method: "PATCH", body: JSON.stringify(body) });
        if (res.ok) {
          const json = (await res.json().catch(() => null)) as { data?: { autoScheduled?: { id: string; startDate: string | null; dueDate: string | null }[] } } | null;
          const autoScheduled = json?.data?.autoScheduled ?? [];
          if (autoScheduled.length > 0) {
            addToast({
              message: t("autoScheduledToast", { count: autoScheduled.length }),
              action: {
                label: tc("common.undo"),
                onClick: async () => {
                  await Promise.allSettled(
                    autoScheduled.map((item) =>
                      apiFetch(`/api/v1/tasks/${item.id}`, {
                        method: "PATCH",
                        body: JSON.stringify({ startDate: item.startDate, dueDate: item.dueDate }),
                      }),
                    ),
                  );
                  setOverrides((prev) => { const next = { ...prev }; delete next[d.id]; return next; });
                  onReload?.();
                },
              },
            });
          }
        }
      } catch {
        setOverrides((prev) => { const next = { ...prev }; delete next[d.id]; return next; });
      }
    },
    [addToast, t, tc, onReload, setOverrides],
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent, r: GanttRow, mode: DragMode = "move") => {
      if (r.isSummary) return;
      const { start, end } = dateFor(r);
      if (!start) return;
      if (mode !== "move") { e.stopPropagation(); e.preventDefault(); }
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      dragRef.current = createDragState(r.id, mode, e.clientX, start, end ?? start);
    },
    [dateFor],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const deltaDays = getTimelineDragRawDeltaDays(d.startX, e.clientX, dayWidth, direction);
      const next = applyDragDelta(d, deltaDays, false);
      dragRef.current = next;
      setOverrides((prev) => ({
        ...prev,
        [next.id]: { startDate: next.currentStart.toISOString(), dueDate: next.currentEnd.toISOString() },
      }));
    },
    [dayWidth, direction, setOverrides],
  );

  const onPointerUp = useCallback(() => {
    const d = dragRef.current;
    dragRef.current = null;
    if (d) void finalizeDrag(d);
  }, [finalizeDrag]);

  const onLostPointerCapture = useCallback(() => {
    const d = dragRef.current;
    if (!d) return;
    dragRef.current = null;
    void finalizeDrag(d);
  }, [finalizeDrag]);

  return { onPointerDown, onPointerMove, onPointerUp, onLostPointerCapture };
}

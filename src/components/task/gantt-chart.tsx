"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toJalali, toGregorian, getMonthName, getDaysInMonth } from "@/lib/date/jalali";
import { formatNumber, type Locale } from "@/lib/date/format";
import {
  diffCalendarDays,
  normalizeStoredDayMarker,
  parseDateOnly,
  startOfCalendarDay,
  timelineDayStart,
  toDateOnly,
} from "@/lib/date/day-marker";
import { useWorkingDayConfig } from "@/hooks/use-working-day-config";
import { createWorkingDayCalendar } from "@/lib/date/working-day-calendar";
import { apiFetch } from "@/lib/api-fetch";
import { useToast } from "@/components/ui/toast";
import { JalaliDatePicker } from "@/components/ui/jalali-date-picker";
import { GanttCriticalPanel } from "./gantt-critical-panel";
import { GanttDepsPanel } from "./gantt-deps-panel";
import { GanttHeader } from "./gantt-header";
import { GanttTaskRow } from "./gantt-task-row";
import type { GanttLink, GanttReport, GanttRow } from "@/lib/gantt-types";
import { linkShortLabel, linkLagSuffix } from "@/lib/gantt/links";

import { criticalDescendants, criticalPredecessors } from "@/lib/gantt/chain";
import { exportGanttAsPdf, exportGanttAsPng } from "@/lib/gantt/export-raster";
import {
  applyDragDelta,
  createDragState,
  dragPatchBody,
  roundedDragDelta,
  type DragMode,
  type DragState,
} from "@/lib/gantt/drag";
import {
  getTimelineDragRawDeltaDays,
  getTimelinePosition,
  type TimelineDirection,
} from "@/lib/gantt/timeline";

const BOX_WIDTH = 64;
const LEFT_WIDTH = 288;
const ROW_HEIGHT = 52;

// First and last day of the current Jalali month — the default export window.
function currentMonthRange(): { start: string; end: string } {
  const now = toJalali(new Date());
  return {
    start: toDateOnly(toGregorian(now.jy, now.jm, 1)),
    end: toDateOnly(toGregorian(now.jy, now.jm, getDaysInMonth(now.jy, now.jm))),
  };
}

const GANTT_PREFS_KEY = "ganttPrefs:v1";
const ZOOM_OPTIONS = [
  { width: 36, label: "ganttZoomSmall" },
  { width: 52, label: "ganttZoomMedium" },
  { width: 72, label: "ganttZoomLarge" },
] as const;

type TimelineDay = {
  date: Date;
  offset: number;
  label: string;
  isMonthStart: boolean;
  isToday: boolean;
  isNonWorking: boolean;
  isDayOff: boolean;
  holidayName: string;
};

type TimelineMonth = {
  key: string;
  label: string;
  startOffset: number;
  dayCount: number;
};

const DEP_TYPES = ["FINISH_TO_START", "START_TO_START", "FINISH_TO_FINISH", "RELATES_TO"] as const;
type LinkType = (typeof DEP_TYPES)[number];

type LinkErrorKey =
  | "loadError"
  | "cycleError"
  | "selfError"
  | "sameProjectError"
  | "duplicateError"
  | "blocked";

function linkErrorKey(code?: string): LinkErrorKey {
  switch (code) {
    case "SELF":
      return "selfError";
    case "DUPLICATE":
      return "duplicateError";
    case "CROSS_PROJECT":
      return "sameProjectError";
    case "DEPENDENCY_CYCLE":
      return "cycleError";
    case "DEPENDENCY_BLOCKED":
      return "blocked";
    default:
      return "loadError";
  }
}

export function GanttChart({
  report,
  projectId,
  onReload,
}: {
  report: GanttReport;
  projectId: string;
  onReload?: () => void;
}) {
  const t = useTranslations("task");
  const tc = useTranslations();
  const locale = useLocale() as Locale;
  const { addToast } = useToast();
  const workingDays = useWorkingDayConfig();
  const [overrides, setOverrides] = useState<Record<string, { startDate: string | null; dueDate: string | null }>>({});
  const dragRef = useRef<DragState | null>(null);

  // Optimistic drag overrides are bridges to the server: once a refreshed
  // report carries the same dates, the override is redundant and is dropped,
  // so it can never shadow fresher data (or a later undo) forever.
  useEffect(() => {
    setOverrides((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const [id, override] of Object.entries(prev)) {
        const row = report.tasks.find((candidate) => candidate.id === id);
        if (!row) continue;
        const rowStart = row.startDate ?? row.summaryStart ?? null;
        const rowEnd = row.dueDate ?? row.summaryEnd ?? null;
        if (override.startDate === rowStart && override.dueDate === rowEnd) {
          delete next[id];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [report]);
  const [linkMode, setLinkMode] = useState(false);
  const [linkSourceId, setLinkSourceId] = useState<string | null>(null);
  const [linkBusy, setLinkBusy] = useState(false);
  const [linkError, setLinkError] = useState<LinkErrorKey | null>(null);
  const [pendingLink, setPendingLink] = useState<{ sourceId: string; targetId: string } | null>(null);
  const [linkType, setLinkType] = useState<LinkType>("FINISH_TO_START");
  const [linkLag, setLinkLag] = useState(0);
  const [linkLagUnit, setLinkLagUnit] = useState<"DAY" | "HOUR">("DAY");
  const [depsOpen, setDepsOpen] = useState(false);
  const [criticalListOpen, setCriticalListOpen] = useState(false);
  const [showCritical, setShowCritical] = useState(true);
  const [dayWidth, setDayWidth] = useState(52);
  const [exporting, setExporting] = useState<"png" | "pdf" | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<"png" | "pdf">("png");
  const [exportStart, setExportStart] = useState(currentMonthRange().start);
  const [exportEnd, setExportEnd] = useState(currentMonthRange().end);

  // View preferences are remembered per browser (zoom + panel toggles). Read
  // after mount so server and client render the same initial markup.
  useEffect(() => {
    try {
      const stored = localStorage.getItem(GANTT_PREFS_KEY);
      if (!stored) return;
      const prefs = JSON.parse(stored) as {
        dayWidth?: number;
        depsOpen?: boolean;
        criticalListOpen?: boolean;
        showCritical?: boolean;
      };
      if (typeof prefs.dayWidth === "number" && ZOOM_OPTIONS.some((z) => z.width === prefs.dayWidth)) {
        setDayWidth(prefs.dayWidth);
      }
      if (typeof prefs.depsOpen === "boolean") setDepsOpen(prefs.depsOpen);
      if (typeof prefs.criticalListOpen === "boolean") setCriticalListOpen(prefs.criticalListOpen);
      if (typeof prefs.showCritical === "boolean") setShowCritical(prefs.showCritical);
    } catch {
      // ignore malformed prefs
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        GANTT_PREFS_KEY,
        JSON.stringify({ dayWidth, depsOpen, criticalListOpen, showCritical }),
      );
    } catch {
      // storage unavailable (private mode etc.)
    }
  }, [dayWidth, depsOpen, criticalListOpen, showCritical]);
  const [depsBusy, setDepsBusy] = useState(false);
  const [depEdits, setDepEdits] = useState<Record<string, { type: LinkType; lag: number; lagUnit: "DAY" | "HOUR" }>>({});
  const canEdit = report.canEdit ?? false;

  const rows = report.tasks;

  const { rangeStart, totalDays, dayCount, days, months, todayOffset } = useMemo(() => {
    // Weekend rule: the configured weekend when an admin set one, otherwise
    // the locale default (Friday for fa-IR, Sat+Sun otherwise) — matching the
    // calendar view. Holidays always tint regardless.
    const calendar = createWorkingDayCalendar(workingDays, locale);
    const today = startOfCalendarDay(new Date());
    const withDates = rows.flatMap((r) => {
      const s = r.startDate ?? r.summaryStart;
      const e = r.dueDate ?? r.summaryEnd;
      return [s, e].filter(Boolean).map((d) => new Date(d as string));
    });
    let start = withDates.length ? new Date(Math.min(...withDates.map((d) => d.getTime()))) : today;
    let end = withDates.length ? new Date(Math.max(...withDates.map((d) => d.getTime()))) : today;
    // Day markers anchor to their UTC calendar day so the range covers the
    // cells the bars actually occupy (a due marker must not push the range
    // into the next local day).
    start = timelineDayStart(start);
    end = timelineDayStart(end);
    start.setDate(start.getDate() - 7);
    end.setDate(end.getDate() + 90);
    const total = Math.max(diffCalendarDays(start, end), 14);
    const dayCount = total + 1;
    const generatedDays: TimelineDay[] = [];
    const generatedMonths: TimelineMonth[] = [];
    const cursor = new Date(start);
    let previousMonthKey = "";

    for (let offset = 0; offset < dayCount; offset++) {
      const date = new Date(cursor);
      const jalali = toJalali(date);
      const monthKey = `${jalali.jy}-${jalali.jm}`;
      const isMonthStart = monthKey !== previousMonthKey;
      const day: TimelineDay = {
        date,
        offset,
        label: formatNumber(jalali.jd, locale, locale === "fa-IR"),
        isMonthStart,
        isToday: date.getTime() === today.getTime(),
        isNonWorking: calendar.isNonWorking(date),
        isDayOff: calendar.isDayOff(date),
        holidayName: calendar.holidayName(date) ?? "",
      };
      generatedDays.push(day);

      const currentMonth = generatedMonths[generatedMonths.length - 1];
      if (isMonthStart || !currentMonth) {
        generatedMonths.push({
          key: monthKey,
          label: `${getMonthName(jalali.jm, locale)} ${formatNumber(jalali.jy, locale, locale === "fa-IR", false)}`,
          startOffset: offset,
          dayCount: 1,
        });
      } else {
        currentMonth.dayCount += 1;
      }

      previousMonthKey = monthKey;
      cursor.setDate(cursor.getDate() + 1);
    }

    const currentTodayOffset = diffCalendarDays(start, today);
    return {
      rangeStart: start,
      totalDays: total,
      dayCount,
      days: generatedDays,
      months: generatedMonths,
      todayOffset: currentTodayOffset >= 0 && currentTodayOffset < dayCount ? currentTodayOffset : null,
    };
  }, [locale, rows, workingDays]);


  const direction: TimelineDirection = locale === "fa-IR" ? "rtl" : "ltr";

  const dayOffset = (date: Date | string | null): number | null => {
    if (!date) return null;
    return Math.max(0, Math.min(totalDays, diffCalendarDays(rangeStart, timelineDayStart(new Date(date)))));
  };

  const dayPos = (date: Date | string | null, itemWidth = dayWidth): number => {
    const offset = dayOffset(date);
    if (offset == null) return 0;
    return getTimelinePosition(offset, totalDays, dayWidth, direction, itemWidth);
  };

  const dateFor = (r: GanttRow): { start: Date | null; end: Date | null } => {
    const o = overrides[r.id];
    const realStart = o?.startDate ?? r.startDate ?? null;
    const realEnd = o?.dueDate ?? r.dueDate ?? null;
    const sumStart = r.summaryStart ?? null;
    const sumEnd = r.summaryEnd ?? null;
    let startStr = realStart ?? sumStart;
    let endStr = realEnd ?? sumEnd;
    // Ensure a bar is visible even when only one bound exists.
    if (!startStr && endStr) startStr = endStr;
    if (!endStr && startStr) endStr = startStr;
    // Normalize legacy non-canonical markers (e.g. Asia/Tehran local
    // midnights from pre-marker-aware drags) so bars, labels, geometry, and
    // drag all anchor on the same calendar day in every timezone.
    return {
      start: startStr ? normalizeStoredDayMarker(new Date(startStr)) : null,
      end: endStr ? normalizeStoredDayMarker(new Date(endStr)) : null,
    };
  };

  const todayStart = startOfCalendarDay(new Date());

  const isDelayed = (r: GanttRow): boolean => {
    if (r.status === "done") return false;
    const { end } = dateFor(r);
    if (!end) return false;
    // Compare calendar days: a stored due marker anchored to its day means
    // the task is only late once that day is fully behind today.
    return timelineDayStart(end).getTime() < todayStart.getTime();
  };

  const delayedDays = (r: GanttRow): number => {
    const { end } = dateFor(r);
    if (!end) return 0;
    return Math.max(0, diffCalendarDays(todayStart, timelineDayStart(end)));
  };

  // A dependency is invalid when the predecessor's end overlaps the successor's start
  // (Mizito's "incorrect dependency" rule).
  const isInvalidLink = (source: GanttRow, target: GanttRow): boolean => {
    const sEnd = dateFor(source).end;
    const tStart = dateFor(target).start;
    if (!sEnd || !tStart) return false;
    return sEnd > tStart;
  };

  const onPointerDown = (e: React.PointerEvent, r: GanttRow, mode: DragMode = "move") => {
    if (r.isSummary) return;
    const { start, end } = dateFor(r);
    if (!start) return;
    if (mode !== "move") {
      e.stopPropagation();
      e.preventDefault();
    }
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = createDragState(r.id, mode, e.clientX, start, end ?? start);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const deltaDays = getTimelineDragRawDeltaDays(
      d.startX,
      e.clientX,
      dayWidth,
      direction,
    );
    // Live drag: follow the pointer continuously (no whole-day snapping).
    const next = applyDragDelta(d, deltaDays, false);
    dragRef.current = next;
    setOverrides((prev) => ({
      ...prev,
      [next.id]: {
        startDate: next.currentStart.toISOString(),
        dueDate: next.currentEnd.toISOString(),
      },
    }));
  };

  const finalizeDrag = async (d: DragState) => {
    // The pointer moved less than half a day — nothing was persisted. Keep
    // any existing override: cell-to-cell drags never set a divergent value
    // for sub-half-day movement (the delta rounds to zero), and clearing it
    // here would expose the stale pre-drag report after a real drag, making
    // the bar snap back on a later plain click. Overrides that match a
    // refreshed report are pruned by the report-sync effect below.
    const deltaDays = roundedDragDelta(d);
    if (deltaDays === 0) return;
    // Re-snap from the original dates with the rounded whole-day delta so
    // the saved dates land exactly on calendar days. The override is synced
    // with the values being saved; the drag itself is over, so dragRef stays
    // cleared — otherwise later pointermoves (with no button held) would keep
    // dragging the bar.
    const snapped = applyDragDelta(d, deltaDays, true);
    setOverrides((prev) => ({
      ...prev,
      [snapped.id]: {
        startDate: snapped.currentStart.toISOString(),
        dueDate: snapped.currentEnd.toISOString(),
      },
    }));
    const body = dragPatchBody(snapped);
    try {
      const res = await apiFetch(`/api/v1/tasks/${d.id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const json = (await res.json().catch(() => null)) as
          | { data?: { autoScheduled?: { id: string; startDate: string | null; dueDate: string | null }[] } }
          | null;
        const autoScheduled = json?.data?.autoScheduled ?? [];
        if (autoScheduled.length > 0) {
          addToast({
            message: t("autoScheduledToast", { count: autoScheduled.length }),              action: {
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
                  // Drop the dragged task's optimistic override so the
                  // refreshed report (with the undone dates) is what renders.
                  setOverrides((prev) => {
                    if (!(d.id in prev)) return prev;
                    const next = { ...prev };
                    delete next[d.id];
                    return next;
                  });
                  onReload?.();
                },
              },
          });
        }
      }
    } catch {
      setOverrides((prev) => {
        const next = { ...prev };
        delete next[d.id];
        return next;
      });
    }
  };

  const onPointerUp = () => {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d) return;
    void finalizeDrag(d);
  };

  const onLostPointerCapture = () => {
    // The browser dropped pointer capture mid-drag (e.g. the node was
    // re-created) before a pointerup arrived. Finalize immediately so the bar
    // can never keep following the pointer without a held button. In the
    // normal flow pointerup already cleared dragRef, so this is a no-op.
    const d = dragRef.current;
    if (!d) return;
    dragRef.current = null;
    void finalizeDrag(d);
  };

  const toggleLinkMode = () => {
    setLinkMode((active) => !active);
    setLinkSourceId(null);
    setLinkError(null);
  };

  const doExport = async (format: "png" | "pdf") => {
    if (exporting) return;
    setExporting(format);
    setLinkError(null);
    try {
      const range = { rangeStart: parseDateOnly(exportStart), rangeEnd: parseDateOnly(exportEnd) };
      if (format === "png") {
        await exportGanttAsPng({ report, locale, ...range, ...(workingDays ? { workingDays } : {}) });
      } else {
        await exportGanttAsPdf({ report, locale, ...range, ...(workingDays ? { workingDays } : {}) });
      }
      setExportOpen(false);
    } catch {
      setLinkError("loadError");
    } finally {
      setExporting(null);
    }
  };

  const toggleExportDialog = () => {
    if (exportOpen) {
      setExportOpen(false);
      return;
    }
    // Reset to the current month each time the dialog opens.
    const range = currentMonthRange();
    setExportStart(range.start);
    setExportEnd(range.end);
    setExportFormat("png");
    setExportOpen(true);
  };

  const startLink = (row: GanttRow) => {
    if (linkBusy || pendingLink || row.isSummary || row.isMilestone) return;
    if (!linkSourceId) {
      setLinkSourceId(row.id);
      setLinkError(null);
      return;
    }
    if (linkSourceId === row.id) {
      setLinkSourceId(null);
      return;
    }
    // Second bar clicked — open the link dialog instead of creating instantly.
    setLinkType("FINISH_TO_START");
    setLinkLag(0);
    setLinkLagUnit("DAY");
    setPendingLink({ sourceId: linkSourceId, targetId: row.id });
    setLinkError(null);
  };

  const cancelLink = () => {
    setPendingLink(null);
    setLinkSourceId(null);
    setLinkError(null);
  };

  const createPendingLink = () => {
    if (!pendingLink) return;
    void createLink(pendingLink.sourceId, pendingLink.targetId, linkType, linkLag, linkLagUnit);
  };

  const createLink = async (
    dependsOnId: string,
    taskId: string,
    type: LinkType,
    lag: number,
    lagUnit: "DAY" | "HOUR",
  ) => {
    setLinkBusy(true);
    setLinkError(null);
    try {
      const res = await apiFetch(`/api/v1/projects/${projectId}/tasks/${taskId}/dependencies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dependsOnId, type, lag, lagUnit }),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as { error?: { code?: string } } | null;
        setLinkError(linkErrorKey(json?.error?.code));
        return;
      }
      setPendingLink(null);
      setLinkSourceId(null);
      onReload?.();
    } catch {
      setLinkError("loadError");
    } finally {
      setLinkBusy(false);
    }
  };

  const removeLink = async (link: GanttLink) => {
    if (linkBusy) return;
    setLinkBusy(true);
    setLinkError(null);
    try {
      const res = await apiFetch(
        `/api/v1/projects/${projectId}/tasks/${link.target}/dependencies/${link.source}?type=${link.type}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as { error?: { code?: string } } | null;
        setLinkError(linkErrorKey(json?.error?.code));
        return;
      }
      onReload?.();
    } catch {
      setLinkError("loadError");
    } finally {
      setLinkBusy(false);
    }
  };

  const beginDepEdit = (link: GanttLink) => {
    setDepEdits((prev) => ({
      ...prev,
      [link.id]: {
        type: DEP_TYPES.includes(link.type as LinkType) ? (link.type as LinkType) : "FINISH_TO_START",
        lag: link.lag,
        lagUnit: link.lagUnit === "HOUR" ? "HOUR" : "DAY",
      },
    }));
  };

  // Edits are delete + recreate (the API has no dependency PATCH endpoint).
  const saveDepEdit = async (link: GanttLink) => {
    const edit = depEdits[link.id];
    if (!edit || depsBusy) return;
    setDepsBusy(true);
    setLinkError(null);
    try {
      const del = await apiFetch(
        `/api/v1/projects/${projectId}/tasks/${link.target}/dependencies/${link.source}?type=${link.type}`,
        { method: "DELETE" },
      );
      if (!del.ok) {
        const json = (await del.json().catch(() => null)) as { error?: { code?: string } } | null;
        setLinkError(linkErrorKey(json?.error?.code));
        return;
      }
      const res = await apiFetch(`/api/v1/projects/${projectId}/tasks/${link.target}/dependencies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dependsOnId: link.source, type: edit.type, lag: edit.lag, lagUnit: edit.lagUnit }),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as { error?: { code?: string } } | null;
        setLinkError(linkErrorKey(json?.error?.code));
        return;
      }
      setDepEdits((prev) => {
        const next = { ...prev };
        delete next[link.id];
        return next;
      });
      onReload?.();
    } catch {
      setLinkError("loadError");
    } finally {
      setDepsBusy(false);
    }
  };

  const rowTitle = (id: string | null): string => {
    if (!id) return "";
    return rows.find((r) => r.id === id)?.title ?? id;
  };

  const typeLabel = (tp: string) => {
    const map: Record<string, string> = {
      FINISH_TO_START: "typeFS",
      START_TO_START: "typeSS",
      FINISH_TO_FINISH: "typeFF",
      RELATES_TO: "typeRelates",
    };
    return t(`dependencies.${map[tp] ?? "typeFS"}`);
  };

  const hasCritical = report.tasks.some((r) => r.critical === true);
  // Critical rows, most urgent first: negative float (already behind) before
  // zero, then by WBS order for a stable list.
  const criticalRows = report.tasks
    .filter((r) => r.critical === true)
    .sort((a, b) => (a.floatDays ?? 0) - (b.floatDays ?? 0) || a.wbsCode.localeCompare(b.wbsCode));

  const floatPhrase = (days: number): string => {
    const abs = Math.round(Math.abs(days) * 10) / 10;
    const formatted = formatNumber(abs, locale, locale === "fa-IR");
    if (abs === 0) return t("ganttFloatNone");
    if (days > 0) return t("ganttFloatSlack", { days: formatted });
    return t("ganttFloatBehind", { days: formatted });
  };

  // Native tooltip for bars: delayed days plus the float (slack) phrase for
  // critical rows, so hovering reveals slack without opening the panel.
  // Milestones and summaries fall back to their title when neither applies.
  const barTitle = (row: GanttRow): string => {
    const parts: string[] = [];
    if (isDelayed(row)) parts.push(t("ganttDelayedDays", { count: delayedDays(row) }));
    if (row.critical === true && row.floatDays != null) parts.push(floatPhrase(row.floatDays));
    if (parts.length > 0) return parts.join(" · ");
    return row.isSummary || row.isMilestone ? row.title : "";
  };

  const criticalIdSet = new Set(criticalRows.map((r) => r.id));

  // Why this task is critical, as a short line: its critical predecessors for
  // leaves, the critical sub-chain for summaries, or the reason it stands
  // alone (deadline-driven vs. the head of the chain).
  const criticalChainInfo = (row: GanttRow): string => {
    if (row.isSummary) {
      const descendants = criticalDescendants(rows, row.id);
      if (descendants.length === 0) return "";
      const shown = descendants.slice(0, 3).map((d) => d.title);
      if (descendants.length > 3) {
        shown.push(t("ganttFloatMore", { count: descendants.length - 3 }));
      }
      return `${t("ganttFloatVia")}: ${shown.join(", ")}`;
    }
    const predecessors = criticalPredecessors(report.links, criticalIdSet, row.id);
    if (predecessors.length === 0) {
      const deadlineDriven = row.startDate == null && row.dueDate != null;
      return deadlineDriven ? t("ganttFloatDeadlineDriven") : t("ganttFloatChainHead");
    }
    return `${t("ganttFloatDependsOn")}: ${predecessors
      .map((p) => `${rowTitle(p.source)} · ${typeLabel(p.type)}${linkLagSuffix(p)}`)
      .join(", ")}`;
  };
  const toolbarButton = (active: boolean) =>
    `px-3 py-1.5 rounded-md border text-sm font-medium transition-colors ${
      active
        ? "border-accent bg-accent text-fg-inverse"
        : "border-border-primary bg-bg-primary text-fg-secondary hover:bg-bg-surface"
    }`;

  if (rows.length === 0) {
    return <div className="text-center py-12 text-fg-muted text-sm">{t("ganttNoTasks")}</div>;
  }

  const noDateTasks = rows.filter((r) => !r.startDate && !r.dueDate && !r.summaryStart && !r.summaryEnd);
  const totalWidth = dayCount * dayWidth;
  const rowsHeight = rows.length * ROW_HEIGHT;
  const timelineOrigin = direction === "rtl" ? 0 : LEFT_WIDTH;
  const timelineXForOffset = (offset: number, itemWidth = 0): number =>
    getTimelinePosition(offset, totalDays, dayWidth, direction, itemWidth);

  const rowIndex = new Map<string, number>();
  rows.forEach((r, i) => rowIndex.set(r.id, i));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        {canEdit && (
          <button
            type="button"
            data-testid="gantt-link-toggle"
            onClick={toggleLinkMode}
            aria-pressed={linkMode}
            className={toolbarButton(linkMode)}
          >
            {t("ganttLinkTasks")}
          </button>
        )}
        <button
          type="button"
          data-testid="gantt-deps-toggle"
          onClick={() => setDepsOpen((open) => !open)}
          aria-pressed={depsOpen}
          aria-expanded={depsOpen}
          className={toolbarButton(depsOpen)}
        >
          {t("ganttDeps")} ({report.links.length})
        </button>
        {hasCritical && (
          <button
            type="button"
            data-testid="gantt-critical-toggle"
            onClick={() => setShowCritical((visible) => !visible)}
            aria-pressed={showCritical}
            className={toolbarButton(showCritical)}
          >
            {t("ganttCriticalPath")}
          </button>
        )}
        {hasCritical && (
          <button
            type="button"
            data-testid="gantt-critical-list"
            onClick={() => setCriticalListOpen((open) => !open)}
            aria-pressed={criticalListOpen}
            aria-expanded={criticalListOpen}
            className={toolbarButton(criticalListOpen)}
          >
            {t("ganttCriticalList")} ({criticalRows.length})
          </button>
        )}
        <label className="flex items-center gap-1.5 text-xs text-fg-muted">
          {t("ganttZoom")}
          <select
            data-testid="gantt-zoom"
            value={dayWidth}
            onChange={(ev) => setDayWidth(Number(ev.target.value))}
            className="text-xs bg-bg-primary border border-border rounded px-1.5 py-1 text-fg-primary"
          >
            {ZOOM_OPTIONS.map((zoom) => (
              <option key={zoom.width} value={zoom.width}>
                {t(zoom.label)}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          data-testid="gantt-export"
          onClick={toggleExportDialog}
          disabled={exporting !== null}
          aria-expanded={exportOpen}
          className={exportOpen ? toolbarButton(true) : "px-3 py-1.5 rounded-md border border-border-primary bg-bg-primary text-fg-secondary text-sm font-medium hover:bg-bg-surface disabled:opacity-40"}
        >
          {t("ganttExport")}
        </button>
        {linkMode && (
          <span className="text-xs text-fg-muted" role="status">
            {t("ganttLinkHint")}
          </span>
        )}
        {linkError && (
          <span className="text-xs text-destructive" role="alert">
            {t(`dependencies.${linkError}`)}
          </span>
        )}
      </div>

      {exportOpen && (
        <form
          data-testid="gantt-export-dialog"
          role="dialog"
          aria-label={t("ganttExport")}
          onSubmit={(e) => {
            e.preventDefault();
            void doExport(exportFormat);
          }}
          className="flex flex-wrap items-end gap-3 rounded-lg border border-border-primary bg-bg-secondary/50 p-3 text-sm"
        >
          <fieldset className="flex flex-col gap-1">
            <legend className="text-xs text-fg-muted mb-1">{t("ganttExportFormat")}</legend>
            <div className="flex gap-4">
              <label className="flex items-center gap-1.5 text-fg-primary">
                <input
                  type="radio"
                  name="gantt-export-format"
                  data-testid="gantt-export-format-png"
                  value="png"
                  checked={exportFormat === "png"}
                  onChange={() => setExportFormat("png")}
                  className="accent-accent"
                />
                {t("ganttExportPng")}
              </label>
              <label className="flex items-center gap-1.5 text-fg-primary">
                <input
                  type="radio"
                  name="gantt-export-format"
                  data-testid="gantt-export-format-pdf"
                  value="pdf"
                  checked={exportFormat === "pdf"}
                  onChange={() => setExportFormat("pdf")}
                  className="accent-accent"
                />
                {t("ganttExportPdf")}
              </label>
            </div>
          </fieldset>
          <label className="flex flex-col gap-1 text-xs text-fg-muted">
            {t("ganttExportStart")}
            <JalaliDatePicker value={exportStart} onChange={(v) => v && setExportStart(v)} className="w-40" testId="gantt-export-start" />
          </label>
          <label className="flex flex-col gap-1 text-xs text-fg-muted">
            {t("ganttExportEnd")}
            <JalaliDatePicker value={exportEnd} onChange={(v) => v && setExportEnd(v)} className="w-40" testId="gantt-export-end" />
          </label>
          <div className="flex items-center gap-2 ms-auto">
            <button
              type="button"
              onClick={() => setExportOpen(false)}
              className="px-3 py-1.5 rounded-md border border-border-primary bg-bg-primary text-fg-secondary text-sm font-medium hover:bg-bg-surface"
            >
              {tc("common.cancel")}
            </button>
            <button
              type="submit"
              data-testid="gantt-export-submit"
              disabled={exporting !== null}
              className="px-3 py-1.5 rounded-md border border-border-primary bg-bg-surface text-fg-primary text-sm font-medium hover:bg-bg-surface-2 disabled:opacity-40"
            >
              {exporting ? tc("common.loading") : t("ganttExportSubmit")}
            </button>
          </div>
        </form>
      )}

      {pendingLink && (
        <form
          data-testid="gantt-link-dialog"
          role="dialog"
          aria-label={t("ganttLinkTitle")}
          onSubmit={(e) => {
            e.preventDefault();
            createPendingLink();
          }}
          className="flex flex-wrap items-end gap-3 rounded-lg border border-border-primary bg-bg-secondary/50 p-3 text-sm"
        >
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold uppercase tracking-wide text-fg-muted">{t("ganttLinkTitle")}</div>
            <div className="truncate text-xs text-fg-primary">
              {rowTitle(linkSourceId)} <span className="text-fg-muted">→</span> {rowTitle(pendingLink.targetId)}
            </div>
          </div>
          <label className="text-xs text-fg-muted">
            {t("dependencies.title")}
            <select
              value={linkType}
              onChange={(ev) => setLinkType(ev.target.value as LinkType)}
              data-testid="gantt-link-type"
              className="mt-1 block w-full text-sm bg-bg-primary border border-border rounded px-2 py-1 text-fg-primary"
            >
              {DEP_TYPES.map((tp) => (
                <option key={tp} value={tp}>
                  {typeLabel(tp)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-fg-muted">
            {t("dependencies.lag")}
            <input
              type="number"
              value={linkLag}
              onChange={(ev) => setLinkLag(Number(ev.target.value))}
              data-testid="gantt-link-lag"
              className="mt-1 block w-20 text-sm bg-bg-primary border border-border rounded px-2 py-1 text-fg-primary"
            />
          </label>
          <label className="text-xs text-fg-muted">
            {t("ganttLinkLagUnit")}
            <select
              value={linkLagUnit}
              onChange={(ev) => setLinkLagUnit(ev.target.value as "DAY" | "HOUR")}
              data-testid="gantt-link-lag-unit"
              className="mt-1 block w-full text-sm bg-bg-primary border border-border rounded px-2 py-1 text-fg-primary"
            >
              <option value="DAY">{t("dependencies.lagUnitDay")}</option>
              <option value="HOUR">{t("dependencies.lagUnitHour")}</option>
            </select>
          </label>
          <button
            type="submit"
            data-testid="gantt-link-create"
            disabled={linkBusy}
            className="px-3 py-1.5 rounded-md bg-accent text-fg-inverse text-sm font-medium hover:opacity-90 disabled:opacity-40"
          >
            {t("ganttLinkCreate")}
          </button>
          <button
            type="button"
            data-testid="gantt-link-cancel"
            onClick={cancelLink}
            className="px-3 py-1.5 rounded-md border border-border-primary bg-bg-primary text-fg-secondary text-sm font-medium hover:bg-bg-surface"
          >
            {t("ganttLinkCancel")}
          </button>
        </form>
      )}

      {criticalListOpen && hasCritical && (
        <GanttCriticalPanel
          criticalRows={criticalRows}
          dateFor={dateFor}
          criticalChainInfo={criticalChainInfo}
          floatPhrase={floatPhrase}
        />
      )}

      {depsOpen && (
        <GanttDepsPanel
          links={report.links}
          canEdit={canEdit}
          depsBusy={depsBusy}
          linkBusy={linkBusy}
          depEdits={depEdits}
          rowTitle={rowTitle}
          typeLabel={typeLabel}
          beginDepEdit={beginDepEdit}
          saveDepEdit={saveDepEdit}
          removeLink={removeLink}
          onDepEditChange={(linkId, edit) => setDepEdits((prev) => ({ ...prev, [linkId]: edit }))}
          onDepEditCancel={(linkId) =>
            setDepEdits((prev) => {
              const next = { ...prev };
              delete next[linkId];
              return next;
            })
          }
        />
      )}
      <div
        data-testid="gantt-scroll-container"
        className="overflow-x-auto border border-border-primary rounded-lg"
      >
        <div style={{ minWidth: totalWidth + LEFT_WIDTH }}>
          {/* Header */}
          <GanttHeader
            days={days}
            months={months}
            dayWidth={dayWidth}
            totalWidth={totalWidth}
            todayOffset={todayOffset}
            timelineXForOffset={timelineXForOffset}
          />

          {/* Dependency arrows overlay */}
          <div className="relative" style={{ height: rowsHeight }}>
            <svg
              className={`absolute inset-0 pointer-events-none ${linkMode ? "z-30" : ""}`}
              width={totalWidth + LEFT_WIDTH}
              height={rowsHeight}
            >
              <defs>
                <marker id="gantt-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                  <path d="M0,0 L6,3 L0,6 Z" className="fill-fg-muted" />
                </marker>
              </defs>
              {report.links.map((link) => {
                const sRow = rowIndex.get(link.source);
                const tRow = rowIndex.get(link.target);
                if (sRow == null || tRow == null) return null;
                const sTask = rows[sRow];
                const tTask = rows[tRow];
                if (!sTask || !tTask) return null;
                const sEnd = dateFor(sTask).end ?? dateFor(sTask).start;
                const tStart = dateFor(tTask).start ?? dateFor(tTask).end;
                if (!sEnd || !tStart) return null;
                const sourcePosition = dayPos(sEnd, BOX_WIDTH);
                const targetPosition = dayPos(tStart, 0);
                const x1 = timelineOrigin + (direction === "rtl" ? sourcePosition : sourcePosition + BOX_WIDTH);
                const y1 = sRow * ROW_HEIGHT + ROW_HEIGHT / 2;
                const x2 = timelineOrigin + targetPosition;
                const y2 = tRow * ROW_HEIGHT + ROW_HEIGHT / 2;
                const mx = (x1 + x2) / 2;
                const invalid = isInvalidLink(sTask, tTask);
                return (
                  <g
                    key={link.id}
                    data-testid="gantt-link-arrow"
                    data-link-source={link.source}
                    data-link-target={link.target}
                    className={linkMode ? "cursor-pointer" : ""}
                    onClick={linkMode ? () => void removeLink(link) : undefined}
                    role={linkMode ? "button" : undefined}
                    aria-label={linkMode ? t("dependencies.remove") : undefined}
                  >
                    {linkMode && (
                      // Invisible wide hit area: a 1px bezier is nearly
                      // impossible to click, so extend the target to 12px.
                      <path
                        d={`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`}
                        fill="none"
                        stroke="transparent"
                        strokeWidth={12}
                        style={{ pointerEvents: "stroke" }}
                      />
                    )}
                    <path
                      d={`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={invalid ? 1.5 : 1}
                      className={`${invalid ? "text-danger" : "text-fg-subtle"} ${linkMode ? "hover:opacity-70" : ""}`}
                      markerEnd="url(#gantt-arrow)"
                    >
                      {invalid ? <title>{t("ganttInvalidDep")}</title> : null}
                    </path>
                    <text
                      x={mx}
                      y={(y1 + y2) / 2 - 5}
                      textAnchor="middle"
                      className="fill-fg-subtle stroke-bg-primary font-mono"
                      style={{
                        fontSize: 10,
                        paintOrder: "stroke",
                        strokeWidth: 3,
                        strokeLinejoin: "round",
                        pointerEvents: "none",
                      }}
                    >
                      {linkShortLabel(link)}
                    </text>
                  </g>
                );
              })}
            </svg>

            {/* Rows */}
            {rows.map((row, i) => (
              <GanttTaskRow
                key={row.id}
                row={row}
                index={i}
                days={days}
                dayWidth={dayWidth}
                totalWidth={totalWidth}
                rangeStart={rangeStart}
                linkMode={linkMode}
                linkSourceId={linkSourceId}
                showCritical={showCritical}
                dateFor={dateFor}
                isDelayed={isDelayed}
                barTitle={barTitle}
                dayPos={dayPos}
                timelineXForOffset={timelineXForOffset}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onLostPointerCapture={onLostPointerCapture}
                startLink={startLink}
              />
            ))}
          </div>
        </div>
      </div>

      {noDateTasks.length > 0 && (
        <div className="text-xs text-fg-muted">
          {noDateTasks.length} {t("ganttNoDates")}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-fg-muted pt-1">
        <span className="font-medium text-fg-primary">{t("ganttLegend")}</span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-info" />
          {t("status.open")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-warning" />
          {t("status.in_progress")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-success" />
          {t("status.done")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-fg-subtle" />
          {t("status.cancelled")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm ring-2 ring-danger" />
          {t("ganttCriticalPath")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-fg-subtle ring-2 ring-danger" />
          {t("ganttDelayed")}
        </span>
        <span className="flex items-center gap-1.5 text-danger">
          <span className="w-3 h-0.5 bg-danger" />
          {t("ganttInvalidDeps")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-danger-bg border border-danger/40" />
          {t("holiday")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-bg-surface-2 border border-border-primary" />
          {t("nonWorkingDay")}
        </span>
      </div>
    </div>
  );
}

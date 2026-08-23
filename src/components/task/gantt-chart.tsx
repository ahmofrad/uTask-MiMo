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
import { GanttCriticalPanel } from "./gantt-critical-panel";
import { GanttDepsPanel } from "./gantt-deps-panel";
import { GanttHeader } from "./gantt-header";
import { GanttTaskRow } from "./gantt-task-row";
import { GanttToolbar } from "./gantt-toolbar";
import { GanttExportDialog } from "./gantt-export-dialog";
import { GanttLinkDialog, type LinkType } from "./gantt-link-dialog";
import { GanttLegend } from "./gantt-legend";
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

type LinkErrorKey =
  | "loadError"
  | "cycleError"
  | "selfError"
  | "sameProjectError"
  | "duplicateError"
  | "blocked";

function linkErrorKey(code?: string): LinkErrorKey {
  switch (code) {
    case "SELF": return "selfError";
    case "DUPLICATE": return "duplicateError";
    case "CROSS_PROJECT": return "sameProjectError";
    case "DEPENDENCY_CYCLE": return "cycleError";
    case "DEPENDENCY_BLOCKED": return "blocked";
    default: return "loadError";
  }
}

const BOX_WIDTH = 64;
const LEFT_WIDTH = 288;
const ROW_HEIGHT = 52;
const GANTT_PREFS_KEY = "ganttPrefs:v1";
const ZOOM_OPTIONS = [
  { width: 36, label: "ganttZoomSmall" },
  { width: 52, label: "ganttZoomMedium" },
  { width: 72, label: "ganttZoomLarge" },
] as const;

function currentMonthRange(): { start: string; end: string } {
  const now = toJalali(new Date());
  return {
    start: toDateOnly(toGregorian(now.jy, now.jm, 1)),
    end: toDateOnly(toGregorian(now.jy, now.jm, getDaysInMonth(now.jy, now.jm))),
  };
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
  const dragRef = useRef<DragState | null>(null);

  // Optimistic drag overrides
  const [overrides, setOverrides] = useState<Record<string, { startDate: string | null; dueDate: string | null }>>({});
  useEffect(() => {
    setOverrides((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const [id, override] of Object.entries(prev)) {
        const row = report.tasks.find((c) => c.id === id);
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

  // Link state
  const [linkMode, setLinkMode] = useState(false);
  const [linkSourceId, setLinkSourceId] = useState<string | null>(null);
  const [linkBusy, setLinkBusy] = useState(false);
  const [linkError, setLinkError] = useState<LinkErrorKey | null>(null);
  const [pendingLink, setPendingLink] = useState<{ sourceId: string; targetId: string } | null>(null);
  const [linkType, setLinkType] = useState<LinkType>("FINISH_TO_START");
  const [linkLag, setLinkLag] = useState(0);
  const [linkLagUnit, setLinkLagUnit] = useState<"DAY" | "HOUR">("DAY");
  // Panel toggles
  const [depsOpen, setDepsOpen] = useState(false);
  const [criticalListOpen, setCriticalListOpen] = useState(false);
  const [showCritical, setShowCritical] = useState(true);
  // Zoom
  const [dayWidth, setDayWidth] = useState(52);
  // Export
  const [exporting, setExporting] = useState<"png" | "pdf" | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<"png" | "pdf">("png");
  const [exportStart, setExportStart] = useState(currentMonthRange().start);
  const [exportEnd, setExportEnd] = useState(currentMonthRange().end);

  // Read preferences from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(GANTT_PREFS_KEY);
      if (!stored) return;
      const prefs = JSON.parse(stored) as {
        dayWidth?: number; depsOpen?: boolean; criticalListOpen?: boolean; showCritical?: boolean;
      };
      if (typeof prefs.dayWidth === "number" && ZOOM_OPTIONS.some((z) => z.width === prefs.dayWidth)) setDayWidth(prefs.dayWidth);
      if (typeof prefs.depsOpen === "boolean") setDepsOpen(prefs.depsOpen);
      if (typeof prefs.criticalListOpen === "boolean") setCriticalListOpen(prefs.criticalListOpen);
      if (typeof prefs.showCritical === "boolean") setShowCritical(prefs.showCritical);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    try { localStorage.setItem(GANTT_PREFS_KEY, JSON.stringify({ dayWidth, depsOpen, criticalListOpen, showCritical })); } catch { /* ignore */ }
  }, [dayWidth, depsOpen, criticalListOpen, showCritical]);

  // Deps panel editing
  const [depsBusy, setDepsBusy] = useState(false);
  const [depEdits, setDepEdits] = useState<Record<string, { type: LinkType; lag: number; lagUnit: "DAY" | "HOUR" }>>({});

  const canEdit = report.canEdit ?? false;
  const rows = report.tasks;

  // --- Timeline computation ---
  const { rangeStart, totalDays, dayCount, days, months, todayOffset } = useMemo(() => {
    const calendar = createWorkingDayCalendar(workingDays, locale);
    const today = startOfCalendarDay(new Date());
    const withDates = rows.flatMap((r) => {
      const s = r.startDate ?? r.summaryStart;
      const e = r.dueDate ?? r.summaryEnd;
      return [s, e].filter(Boolean).map((d) => new Date(d as string));
    });
    let start = withDates.length ? new Date(Math.min(...withDates.map((d) => d.getTime()))) : today;
    let end = withDates.length ? new Date(Math.max(...withDates.map((d) => d.getTime()))) : today;
    start = timelineDayStart(start);
    end = timelineDayStart(end);
    start.setDate(start.getDate() - 7);
    end.setDate(end.getDate() + 90);
    const total = Math.max(diffCalendarDays(start, end), 14);
    const dc = total + 1;
    const genDays: TimelineDay[] = [];
    const genMonths: TimelineMonth[] = [];
    const cursor = new Date(start);
    let prevKey = "";
    for (let offset = 0; offset < dc; offset++) {
      const date = new Date(cursor);
      const jalali = toJalali(date);
      const monthKey = `${jalali.jy}-${jalali.jm}`;
      const isMonthStart = monthKey !== prevKey;
      genDays.push({
        date, offset,
        label: formatNumber(jalali.jd, locale, locale === "fa-IR"),
        isMonthStart,
        isToday: date.getTime() === today.getTime(),
        isNonWorking: calendar.isNonWorking(date),
        isDayOff: calendar.isDayOff(date),
        holidayName: calendar.holidayName(date) ?? "",
      });
      const cur = genMonths[genMonths.length - 1];
      if (isMonthStart || !cur) {
        genMonths.push({
          key: monthKey,
          label: `${getMonthName(jalali.jm, locale)} ${formatNumber(jalali.jy, locale, locale === "fa-IR", false)}`,
          startOffset: offset, dayCount: 1,
        });
      } else { cur.dayCount += 1; }
      prevKey = monthKey;
      cursor.setDate(cursor.getDate() + 1);
    }
    const todayOff = diffCalendarDays(start, today);
    return {
      rangeStart: start, totalDays: total, dayCount: dc,
      days: genDays, months: genMonths,
      todayOffset: todayOff >= 0 && todayOff < dc ? todayOff : null,
    };
  }, [locale, rows, workingDays]);

  const direction: TimelineDirection = locale === "fa-IR" ? "rtl" : "ltr";

  // --- Geometry helpers ---
  const dayOffset = (date: Date | string | null): number | null => {
    if (!date) return null;
    return Math.max(0, Math.min(totalDays, diffCalendarDays(rangeStart, timelineDayStart(new Date(date)))));
  };
  const dayPos = (date: Date | string | null, itemWidth = dayWidth): number => {
    const offset = dayOffset(date);
    if (offset == null) return 0;
    return getTimelinePosition(offset, totalDays, dayWidth, direction, itemWidth);
  };
  const timelineXForOffset = (offset: number, itemWidth = 0): number =>
    getTimelinePosition(offset, totalDays, dayWidth, direction, itemWidth);

  const dateFor = (r: GanttRow): { start: Date | null; end: Date | null } => {
    const o = overrides[r.id];
    const startStr = (o?.startDate ?? r.startDate ?? r.summaryStart ?? null);
    const endStr = (o?.dueDate ?? r.dueDate ?? r.summaryEnd ?? null);
    const s = startStr ?? endStr;
    const e = endStr ?? startStr;
    return {
      start: s ? normalizeStoredDayMarker(new Date(s)) : null,
      end: e ? normalizeStoredDayMarker(new Date(e)) : null,
    };
  };

  const todayStart = startOfCalendarDay(new Date());
  const isDelayed = (r: GanttRow): boolean => {
    if (r.status === "done") return false;
    const { end } = dateFor(r);
    if (!end) return false;
    return timelineDayStart(end).getTime() < todayStart.getTime();
  };
  const delayedDays = (r: GanttRow): number => {
    const { end } = dateFor(r);
    if (!end) return 0;
    return Math.max(0, diffCalendarDays(todayStart, timelineDayStart(end)));
  };
  const isInvalidLink = (source: GanttRow, target: GanttRow): boolean => {
    const sEnd = dateFor(source).end;
    const tStart = dateFor(target).start;
    if (!sEnd || !tStart) return false;
    return sEnd > tStart;
  };

  // --- Drag handlers ---
  const onPointerDown = (e: React.PointerEvent, r: GanttRow, mode: DragMode = "move") => {
    if (r.isSummary) return;
    const { start, end } = dateFor(r);
    if (!start) return;
    if (mode !== "move") { e.stopPropagation(); e.preventDefault(); }
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = createDragState(r.id, mode, e.clientX, start, end ?? start);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const deltaDays = getTimelineDragRawDeltaDays(d.startX, e.clientX, dayWidth, direction);
    const next = applyDragDelta(d, deltaDays, false);
    dragRef.current = next;
    setOverrides((prev) => ({
      ...prev,
      [next.id]: { startDate: next.currentStart.toISOString(), dueDate: next.currentEnd.toISOString() },
    }));
  };
  const finalizeDrag = async (d: DragState) => {
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
                await Promise.allSettled(autoScheduled.map((item) =>
                  apiFetch(`/api/v1/tasks/${item.id}`, { method: "PATCH", body: JSON.stringify({ startDate: item.startDate, dueDate: item.dueDate }) }),
                ));
                setOverrides((prev) => { const next = { ...prev }; delete next[d.id]; return next; });
                onReload?.();
              },
            },
          });
        }
      }
    } catch { setOverrides((prev) => { const next = { ...prev }; delete next[d.id]; return next; }); }
  };
  const onPointerUp = () => { const d = dragRef.current; dragRef.current = null; if (d) void finalizeDrag(d); };
  const onLostPointerCapture = () => { const d = dragRef.current; if (!d) return; dragRef.current = null; void finalizeDrag(d); };

  // --- Link handlers ---
  const toggleLinkMode = () => { setLinkMode((a) => !a); setLinkSourceId(null); setLinkError(null); };
  const startLink = (row: GanttRow) => {
    if (linkBusy || pendingLink || row.isSummary || row.isMilestone) return;
    if (!linkSourceId) { setLinkSourceId(row.id); setLinkError(null); return; }
    if (linkSourceId === row.id) { setLinkSourceId(null); return; }
    setLinkType("FINISH_TO_START"); setLinkLag(0); setLinkLagUnit("DAY");
    setPendingLink({ sourceId: linkSourceId, targetId: row.id });
    setLinkError(null);
  };
  const cancelLink = () => { setPendingLink(null); setLinkSourceId(null); setLinkError(null); };
  const createLink = async (dependsOnId: string, taskId: string, type: LinkType, lag: number, lagUnit: "DAY" | "HOUR") => {
    setLinkBusy(true); setLinkError(null);
    try {
      const res = await apiFetch(`/api/v1/projects/${projectId}/tasks/${taskId}/dependencies`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dependsOnId, type, lag, lagUnit }),
      });
      if (!res.ok) { const json = (await res.json().catch(() => null)) as { error?: { code?: string } } | null; setLinkError(linkErrorKey(json?.error?.code)); return; }
      setPendingLink(null); setLinkSourceId(null);
      onReload?.();
    } catch { setLinkError("loadError"); }
    finally { setLinkBusy(false); }
  };
  const removeLink = async (link: GanttLink) => {
    if (linkBusy) return; setLinkBusy(true); setLinkError(null);
    try {
      const res = await apiFetch(`/api/v1/projects/${projectId}/tasks/${link.target}/dependencies/${link.source}?type=${link.type}`, { method: "DELETE" });
      if (!res.ok) { const json = (await res.json().catch(() => null)) as { error?: { code?: string } } | null; setLinkError(linkErrorKey(json?.error?.code)); return; }
      onReload?.();
    } catch { setLinkError("loadError"); }
    finally { setLinkBusy(false); }
  };
  const beginDepEdit = (link: GanttLink) => {
    setDepEdits((prev) => ({ ...prev, [link.id]: {
      type: DEP_TYPES.includes(link.type as LinkType) ? (link.type as LinkType) : "FINISH_TO_START",
      lag: link.lag, lagUnit: link.lagUnit === "HOUR" ? "HOUR" : "DAY",
    }}));
  };
  const saveDepEdit = async (link: GanttLink) => {
    const edit = depEdits[link.id];
    if (!edit || depsBusy) return; setDepsBusy(true); setLinkError(null);
    try {
      const del = await apiFetch(`/api/v1/projects/${projectId}/tasks/${link.target}/dependencies/${link.source}?type=${link.type}`, { method: "DELETE" });
      if (!del.ok) { const json = (await del.json().catch(() => null)) as { error?: { code?: string } } | null; setLinkError(linkErrorKey(json?.error?.code)); return; }
      const res = await apiFetch(`/api/v1/projects/${projectId}/tasks/${link.target}/dependencies`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dependsOnId: link.source, type: edit.type, lag: edit.lag, lagUnit: edit.lagUnit }),
      });
      if (!res.ok) { const json = (await res.json().catch(() => null)) as { error?: { code?: string } } | null; setLinkError(linkErrorKey(json?.error?.code)); return; }
      setDepEdits((prev) => { const next = { ...prev }; delete next[link.id]; return next; });
      onReload?.();
    } catch { setLinkError("loadError"); }
    finally { setDepsBusy(false); }
  };

  // --- Export ---
  const doExport = async (format: "png" | "pdf") => {
    if (exporting) return; setExporting(format); setLinkError(null);
    try {
      const range = { rangeStart: parseDateOnly(exportStart), rangeEnd: parseDateOnly(exportEnd) };
      if (format === "png") await exportGanttAsPng({ report, locale, ...range, ...(workingDays ? { workingDays } : {}) });
      else await exportGanttAsPdf({ report, locale, ...range, ...(workingDays ? { workingDays } : {}) });
      setExportOpen(false);
    } catch { setLinkError("loadError"); }
    finally { setExporting(null); }
  };
  const toggleExportDialog = () => {
    if (exportOpen) { setExportOpen(false); return; }
    const range = currentMonthRange();
    setExportStart(range.start); setExportEnd(range.end); setExportFormat("png");
    setExportOpen(true);
  };

  // --- Critical path helpers ---
  const rowTitle = (id: string | null): string => id ? (rows.find((r) => r.id === id)?.title ?? id) : "";
  const typeLabel = (tp: string) => {
    const map: Record<string, string> = { FINISH_TO_START: "typeFS", START_TO_START: "typeSS", FINISH_TO_FINISH: "typeFF", RELATES_TO: "typeRelates" };
    return t(`dependencies.${map[tp] ?? "typeFS"}`);
  };

  const hasCritical = rows.some((r) => r.critical === true);
  const criticalRows = rows.filter((r) => r.critical).sort((a, b) => (a.floatDays ?? 0) - (b.floatDays ?? 0) || a.wbsCode.localeCompare(b.wbsCode));
  const criticalIdSet = new Set(criticalRows.map((r) => r.id));

  const floatPhrase = (days: number): string => {
    const abs = Math.round(Math.abs(days) * 10) / 10;
    const formatted = formatNumber(abs, locale, locale === "fa-IR");
    if (abs === 0) return t("ganttFloatNone");
    if (days > 0) return t("ganttFloatSlack", { days: formatted });
    return t("ganttFloatBehind", { days: formatted });
  };
  const barTitle = (row: GanttRow): string => {
    const parts: string[] = [];
    if (isDelayed(row)) parts.push(t("ganttDelayedDays", { count: delayedDays(row) }));
    if (row.critical === true && row.floatDays != null) parts.push(floatPhrase(row.floatDays));
    if (parts.length > 0) return parts.join(" · ");
    return row.isSummary || row.isMilestone ? row.title : "";
  };
  const criticalChainInfo = (row: GanttRow): string => {
    if (row.isSummary) {
      const descendants = criticalDescendants(rows, row.id);
      if (descendants.length === 0) return "";
      const shown = descendants.slice(0, 3).map((d) => d.title);
      if (descendants.length > 3) shown.push(t("ganttFloatMore", { count: descendants.length - 3 }));
      return `${t("ganttFloatVia")}: ${shown.join(", ")}`;
    }
    const predecessors = criticalPredecessors(report.links, criticalIdSet, row.id);
    if (predecessors.length === 0) {
      return (row.startDate == null && row.dueDate != null) ? t("ganttFloatDeadlineDriven") : t("ganttFloatChainHead");
    }
    return `${t("ganttFloatDependsOn")}: ${predecessors.map((p) => `${rowTitle(p.source)} · ${typeLabel(p.type)}${linkLagSuffix(p)}`).join(", ")}`;
  };

  // --- Render ---
  if (rows.length === 0) {
    return <div className="text-center py-12 text-fg-muted text-sm">{t("ganttNoTasks")}</div>;
  }

  const noDateTasks = rows.filter((r) => !r.startDate && !r.dueDate && !r.summaryStart && !r.summaryEnd);
  const totalWidth = dayCount * dayWidth;
  const rowsHeight = rows.length * ROW_HEIGHT;
  const timelineOrigin = direction === "rtl" ? 0 : LEFT_WIDTH;
  const rowIndex = new Map<string, number>();
  rows.forEach((r, i) => rowIndex.set(r.id, i));

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <GanttToolbar
        canEdit={canEdit}
        linkMode={linkMode}
        depsOpen={depsOpen}
        depsCount={report.links.length}
        hasCritical={hasCritical}
        showCritical={showCritical}
        criticalListOpen={criticalListOpen}
        criticalCount={criticalRows.length}
        dayWidth={dayWidth}
        exportOpen={exportOpen}
        exporting={exporting !== null}
        linkError={linkError}
        onToggleLinkMode={toggleLinkMode}
        onToggleDeps={() => setDepsOpen((o) => !o)}
        onToggleShowCritical={() => setShowCritical((v) => !v)}
        onToggleCriticalList={() => setCriticalListOpen((o) => !o)}
        onZoomChange={setDayWidth}
        onToggleExport={toggleExportDialog}
      />

      {/* Export dialog */}
      {exportOpen && (
        <GanttExportDialog
          exportFormat={exportFormat}
          exportStart={exportStart}
          exportEnd={exportEnd}
          exporting={exporting !== null}
          onFormatChange={setExportFormat}
          onStartChange={(v) => setExportStart(v)}
          onEndChange={(v) => setExportEnd(v)}
          onSubmit={() => void doExport(exportFormat)}
          onClose={() => setExportOpen(false)}
        />
      )}

      {/* Link dialog */}
      {pendingLink && (
        <GanttLinkDialog
          linkType={linkType}
          linkLag={linkLag}
          linkLagUnit={linkLagUnit}
          linkBusy={linkBusy}
          sourceTitle={rowTitle(linkSourceId)}
          targetTitle={rowTitle(pendingLink.targetId)}
          onTypeChange={setLinkType}
          onLagChange={setLinkLag}
          onLagUnitChange={setLinkLagUnit}
          onCreate={() => void createLink(pendingLink.sourceId, pendingLink.targetId, linkType, linkLag, linkLagUnit)}
          onCancel={cancelLink}
        />
      )}

      {/* Critical panel */}
      {criticalListOpen && hasCritical && (
        <GanttCriticalPanel
          criticalRows={criticalRows}
          dateFor={dateFor}
          criticalChainInfo={criticalChainInfo}
          floatPhrase={floatPhrase}
        />
      )}

      {/* Dependencies panel */}
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
          onDepEditCancel={(linkId) => setDepEdits((prev) => { const next = { ...prev }; delete next[linkId]; return next; })}
        />
      )}

      {/* Chart area */}
      <div data-testid="gantt-scroll-container" className="overflow-x-auto border border-border-primary rounded-lg">
        <div style={{ minWidth: totalWidth + LEFT_WIDTH }}>
          <GanttHeader
            days={days}
            months={months}
            dayWidth={dayWidth}
            totalWidth={totalWidth}
            todayOffset={todayOffset}
            timelineXForOffset={timelineXForOffset}
          />

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
                const x1 = timelineOrigin + (direction === "rtl" ? dayPos(sEnd, BOX_WIDTH) : dayPos(sEnd, BOX_WIDTH) + BOX_WIDTH);
                const y1 = sRow * ROW_HEIGHT + ROW_HEIGHT / 2;
                const x2 = timelineOrigin + dayPos(tStart, 0);
                const y2 = tRow * ROW_HEIGHT + ROW_HEIGHT / 2;
                const mx = (x1 + x2) / 2;
                const invalid = isInvalidLink(sTask, tTask);
                return (
                  <g key={link.id} data-testid="gantt-link-arrow"
                    data-link-source={link.source} data-link-target={link.target}
                    className={linkMode ? "cursor-pointer" : ""}
                    onClick={linkMode ? () => void removeLink(link) : undefined}
                    role={linkMode ? "button" : undefined}
                    aria-label={linkMode ? t("dependencies.remove") : undefined}
                  >
                    {linkMode && <path d={`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`} fill="none" stroke="transparent" strokeWidth={12} style={{ pointerEvents: "stroke" }} />}
                    <path d={`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`} fill="none" stroke="currentColor"
                      strokeWidth={invalid ? 1.5 : 1}
                      className={`${invalid ? "text-danger" : "text-fg-subtle"} ${linkMode ? "hover:opacity-70" : ""}`}
                      markerEnd="url(#gantt-arrow)"
                    >
                      {invalid ? <title>{t("ganttInvalidDep")}</title> : null}
                    </path>
                    <text x={mx} y={(y1 + y2) / 2 - 5} textAnchor="middle"
                      className="fill-fg-subtle stroke-bg-primary font-mono"
                      style={{ fontSize: 10, paintOrder: "stroke", strokeWidth: 3, strokeLinejoin: "round", pointerEvents: "none" }}
                    >
                      {linkShortLabel(link)}
                    </text>
                  </g>
                );
              })}
            </svg>

            {rows.map((row, i) => (
              <GanttTaskRow
                key={row.id} row={row} index={i}
                days={days} dayWidth={dayWidth} totalWidth={totalWidth}
                rangeStart={rangeStart}
                linkMode={linkMode} linkSourceId={linkSourceId}
                showCritical={showCritical}
                dateFor={dateFor} isDelayed={isDelayed} barTitle={barTitle}
                dayPos={dayPos} timelineXForOffset={timelineXForOffset}
                onPointerDown={onPointerDown} onPointerMove={onPointerMove}
                onPointerUp={onPointerUp} onLostPointerCapture={onLostPointerCapture}
                startLink={startLink}
              />
            ))}
          </div>
        </div>
      </div>

      {noDateTasks.length > 0 && (
        <div className="text-xs text-fg-muted">{noDateTasks.length} {t("ganttNoDates")}</div>
      )}

      <GanttLegend />
    </div>
  );
}
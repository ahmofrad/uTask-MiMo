"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { toJalali, getMonthName } from "@/lib/date/jalali";
import { formatNumber, type Locale } from "@/lib/date/format";
import { useFormattedDate } from "@/lib/date/useFormattedDate";
import { apiFetch } from "@/lib/api-fetch";
import type { GanttLink, GanttReport, GanttRow } from "@/lib/gantt-types";
import {
  getTimelineDragDeltaDays,
  getTimelineItemGeometry,
  getTimelinePosition,
  snapTimelineDate,
  shiftTimelineDateByDays,
  type TimelineDirection,
} from "@/lib/gantt/timeline";

const DAY_WIDTH = 52;
const BOX_WIDTH = 64;
const LEFT_WIDTH = 288;
const ROW_HEIGHT = 52;

type TimelineDay = {
  date: Date;
  offset: number;
  label: string;
  isMonthStart: boolean;
  isToday: boolean;
};

type TimelineMonth = {
  key: string;
  label: string;
  startOffset: number;
  dayCount: number;
};

type DragMode = "move" | "resize-start" | "resize-due";

type DragState = {
  id: string;
  mode: DragMode;
  startX: number;
  origStart: Date;
  origEnd: Date;
  currentStart: Date;
  currentEnd: Date;
  lastDeltaDays: number;
};

const STATUS_COLORS: Record<string, string> = {
  open: "bg-info",
  in_progress: "bg-warning",
  done: "bg-success",
  cancelled: "bg-fg-subtle",
};

function startOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

function diffDays(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

function isSameCalendarDay(a: Date, b: Date): boolean {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

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
  const locale = useLocale() as Locale;
  const { shortDate } = useFormattedDate();
  const [overrides, setOverrides] = useState<Record<string, { startDate: string | null; dueDate: string | null }>>({});
  const dragRef = useRef<DragState | null>(null);
  const [linkMode, setLinkMode] = useState(false);
  const [linkSourceId, setLinkSourceId] = useState<string | null>(null);
  const [linkBusy, setLinkBusy] = useState(false);
  const [linkError, setLinkError] = useState<LinkErrorKey | null>(null);
  const canEdit = report.canEdit ?? false;

  const rows = report.tasks;

  const { rangeStart, totalDays, dayCount, days, months, todayOffset } = useMemo(() => {
    const today = startOfDay(new Date());
    const withDates = rows.flatMap((r) => {
      const s = r.startDate ?? r.summaryStart;
      const e = r.dueDate ?? r.summaryEnd;
      return [s, e].filter(Boolean).map((d) => new Date(d as string));
    });
    let start = withDates.length ? new Date(Math.min(...withDates.map((d) => d.getTime()))) : today;
    let end = withDates.length ? new Date(Math.max(...withDates.map((d) => d.getTime()))) : today;
    start = startOfDay(start);
    end = startOfDay(end);
    start.setDate(start.getDate() - 7);
    end.setDate(end.getDate() + 90);
    const total = Math.max(diffDays(start, end), 14);
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

    const currentTodayOffset = diffDays(start, today);
    return {
      rangeStart: start,
      totalDays: total,
      dayCount,
      days: generatedDays,
      months: generatedMonths,
      todayOffset: currentTodayOffset >= 0 && currentTodayOffset < dayCount ? currentTodayOffset : null,
    };
  }, [locale, rows]);

  const direction: TimelineDirection = locale === "fa-IR" ? "rtl" : "ltr";

  const dayOffset = (date: Date | string | null): number | null => {
    if (!date) return null;
    return Math.max(0, Math.min(totalDays, diffDays(rangeStart, startOfDay(new Date(date)))));
  };

  const dayPos = (date: Date | string | null, itemWidth = DAY_WIDTH): number => {
    const offset = dayOffset(date);
    if (offset == null) return 0;
    return getTimelinePosition(offset, totalDays, DAY_WIDTH, direction, itemWidth);
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
    return { start: startStr ? new Date(startStr) : null, end: endStr ? new Date(endStr) : null };
  };

  const todayStart = startOfDay(new Date());

  const isDelayed = (r: GanttRow): boolean => {
    if (r.status === "done") return false;
    const { end } = dateFor(r);
    if (!end) return false;
    return end < todayStart;
  };

  const delayedDays = (r: GanttRow): number => {
    const { end } = dateFor(r);
    if (!end) return 0;
    return Math.max(0, diffDays(todayStart, end));
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
    dragRef.current = {
      id: r.id,
      mode,
      startX: e.clientX,
      origStart: start,
      origEnd: end ?? start,
      currentStart: start,
      currentEnd: end ?? start,
      lastDeltaDays: 0,
    };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const deltaDays = getTimelineDragDeltaDays(
      d.startX,
      e.clientX,
      DAY_WIDTH,
      direction,
    );
    let ns = d.origStart;
    let ne = d.origEnd;
    const isSingleDay = isSameCalendarDay(d.origStart, d.origEnd);
    if (d.mode === "move") {
      ns = snapTimelineDate(shiftTimelineDateByDays(d.origStart, deltaDays), "start");
      ne = snapTimelineDate(shiftTimelineDateByDays(d.origEnd, deltaDays), "end");
    } else if (d.mode === "resize-start") {
      ns = snapTimelineDate(shiftTimelineDateByDays(d.origStart, deltaDays), "start");
      if (isSingleDay && deltaDays > 0) {
        ne = snapTimelineDate(shiftTimelineDateByDays(d.origEnd, deltaDays), "end");
      } else if (ns > d.origEnd) {
        ns = snapTimelineDate(d.origEnd, "start");
      }
    } else {
      ne = snapTimelineDate(shiftTimelineDateByDays(d.origEnd, deltaDays), "end");
      if (isSingleDay && deltaDays < 0) {
        ns = snapTimelineDate(shiftTimelineDateByDays(d.origStart, deltaDays), "start");
      } else if (ne < d.origStart) {
        ne = snapTimelineDate(d.origStart, "end");
      }
    }
    d.currentStart = ns;
    d.currentEnd = ne;
    d.lastDeltaDays = deltaDays;
    setOverrides((prev) => ({
      ...prev,
      [d.id]: { startDate: ns.toISOString(), dueDate: ne.toISOString() },
    }));
  };

  const onPointerUp = async () => {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d || d.lastDeltaDays === 0) return;
    const startChanged = d.currentStart.getTime() !== d.origStart.getTime();
    const dueChanged = d.currentEnd.getTime() !== d.origEnd.getTime();
    const body = d.mode === "move" || (startChanged && dueChanged)
      ? { startDate: d.currentStart.toISOString(), dueDate: d.currentEnd.toISOString() }
      : d.mode === "resize-start"
        ? { startDate: d.currentStart.toISOString() }
        : { dueDate: d.currentEnd.toISOString() };
    try {
      await apiFetch(`/api/v1/tasks/${d.id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
    } catch {
      setOverrides((prev) => {
        const next = { ...prev };
        delete next[d.id];
        return next;
      });
    }
  };

  const toggleLinkMode = () => {
    setLinkMode((active) => !active);
    setLinkSourceId(null);
    setLinkError(null);
  };

  const startLink = (row: GanttRow) => {
    if (linkBusy || row.isSummary || row.isMilestone) return;
    if (!linkSourceId) {
      setLinkSourceId(row.id);
      setLinkError(null);
      return;
    }
    if (linkSourceId === row.id) {
      setLinkSourceId(null);
      return;
    }
    void createLink(linkSourceId, row.id);
  };

  const createLink = async (dependsOnId: string, taskId: string) => {
    setLinkBusy(true);
    setLinkError(null);
    try {
      const res = await apiFetch(`/api/v1/projects/${projectId}/tasks/${taskId}/dependencies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dependsOnId, type: "FINISH_TO_START", lag: 0 }),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as { error?: { code?: string } } | null;
        setLinkError(linkErrorKey(json?.error?.code));
        return;
      }
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

  if (rows.length === 0) {
    return <div className="text-center py-12 text-fg-muted text-sm">{t("ganttNoTasks")}</div>;
  }

  const noDateTasks = rows.filter((r) => !r.startDate && !r.dueDate && !r.summaryStart && !r.summaryEnd);
  const totalWidth = dayCount * DAY_WIDTH;
  const rowsHeight = rows.length * ROW_HEIGHT;
  const timelineOrigin = direction === "rtl" ? 0 : LEFT_WIDTH;
  const timelineXForOffset = (offset: number, itemWidth = 0): number =>
    getTimelinePosition(offset, totalDays, DAY_WIDTH, direction, itemWidth);

  const rowIndex = new Map<string, number>();
  rows.forEach((r, i) => rowIndex.set(r.id, i));

  return (
    <div className="space-y-4">
      {canEdit && (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <button
            type="button"
            data-testid="gantt-link-toggle"
            onClick={toggleLinkMode}
            aria-pressed={linkMode}
            className={`px-3 py-1.5 rounded-md border text-sm font-medium transition-colors ${
              linkMode
                ? "border-accent bg-accent text-fg-inverse"
                : "border-border-primary bg-bg-primary text-fg-secondary hover:bg-bg-surface"
            }`}
          >
            {t("ganttLinkTasks")}
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
      )}
      <div
        data-testid="gantt-scroll-container"
        className="overflow-x-auto border border-border-primary rounded-lg"
      >
        <div style={{ minWidth: totalWidth + LEFT_WIDTH }}>
          {/* Header */}
          <div className="flex border-b border-border-primary bg-bg-secondary">
            <div className="sticky start-0 z-30 flex h-20 w-72 shrink-0 items-end border-e border-border-primary bg-bg-secondary p-3 text-xs font-semibold text-fg-muted">
              {t("wbs")}
            </div>
            <div
              dir="ltr"
              className="relative h-20 shrink-0"
              style={{ width: totalWidth }}
            >
              <div className="absolute inset-x-0 top-0 h-9 border-b border-border-primary bg-bg-secondary">
                {months.map((month) => (
                  <div
                    key={month.key}
                    data-testid="gantt-timeline-month"
                    dir={locale === "fa-IR" ? "rtl" : "ltr"}
                    className="absolute top-0 flex h-9 items-center border-e border-border-primary px-3 text-[15px] font-bold text-fg-primary"
                    style={{
                      left: `${timelineXForOffset(month.startOffset, month.dayCount * DAY_WIDTH)}px`,
                      width: `${month.dayCount * DAY_WIDTH}px`,
                    }}
                  >
                    <span className="truncate">{month.label}</span>
                  </div>
                ))}
              </div>
              <div className="absolute inset-x-0 top-9 h-11 bg-bg-primary">
                {days.map((day) => (
                  <div
                    key={day.offset}
                    data-testid="gantt-timeline-day"
                    data-day-offset={day.offset}
                    dir={locale === "fa-IR" ? "rtl" : "ltr"}
                    className={`absolute top-0 flex h-11 items-center justify-center border-e border-border-secondary/70 text-[15px] font-semibold leading-none text-fg-secondary ${
                      day.isMonthStart ? "border-s-2 border-s-border-strong" : ""
                    } ${day.isToday ? "bg-accent-bg text-accent" : ""}`}
                    style={{
                      left: `${timelineXForOffset(day.offset, DAY_WIDTH)}px`,
                      width: `${DAY_WIDTH}px`,
                    }}
                  >
                    {day.label}
                  </div>
                ))}
              </div>
              {todayOffset != null ? (
                <div
                  className="pointer-events-none absolute top-9 z-10 h-11 w-0.5 bg-danger/70"
                  style={{ left: `${timelineXForOffset(todayOffset, DAY_WIDTH) + DAY_WIDTH / 2}px` }}
                />
              ) : null}
            </div>
          </div>

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
                  </g>
                );
              })}
            </svg>

            {/* Rows */}
            {rows.map((row, i) => {
              const { start, end } = dateFor(row);
              const geometry = getTimelineItemGeometry(start, end, rangeStart, DAY_WIDTH);
              const width = geometry.width;
              const barLeft = timelineXForOffset(geometry.startOffset, width);
              const isCritical = row.critical;
              return (
                <div
                  key={row.id}
                  className="flex border-b border-border-secondary hover:bg-bg-secondary/50 transition-colors"
                  style={{ position: "absolute", top: i * ROW_HEIGHT, left: 0, right: 0, height: ROW_HEIGHT }}
                >
                  <div
                    data-testid="gantt-task-label"
                    className="sticky start-0 z-20 isolate flex h-full w-72 shrink-0 flex-col justify-center gap-0.5 overflow-visible border-e border-border-primary bg-bg-primary p-3"
                  >
                    <div className="flex items-baseline gap-1 min-w-0">
                      <span className="text-[10px] font-mono text-fg-subtle shrink-0">{row.wbsCode}</span>
                      <Link
                        href={`/tasks/${row.id}`}
                        className="min-w-0 text-xs font-medium text-fg-primary hover:text-accent truncate"
                        title={row.title}
                      >
                        {row.title}
                      </Link>
                    </div>
                    {start || end ? (
                      <span
                        data-testid="gantt-task-date"
                        dir={locale === "fa-IR" ? "rtl" : "ltr"}
                        className="relative z-30 block min-w-0 whitespace-nowrap text-start text-[11px] leading-4 text-fg-muted"
                      >
                        {shortDate((start ?? end)!.toISOString())} – {shortDate((end ?? start)!.toISOString())}
                      </span>
                    ) : null}
                  </div>
                  <div dir="ltr" className="relative h-full shrink-0" style={{ width: totalWidth }}>
                    {days.map((day) => (
                      <div
                        key={day.offset}
                        className={`absolute top-0 h-full border-e border-border-secondary/40 ${day.isToday ? "bg-accent-bg/30" : ""}`}
                        style={{
                          left: `${timelineXForOffset(day.offset, DAY_WIDTH)}px`,
                          width: `${DAY_WIDTH}px`,
                        }}
                      />
                    ))}
                    {row.isMilestone && start ? (
                      <div
                        className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 rotate-45 bg-accent border border-bg-surface ${
                          isDelayed(row) ? "ring-2 ring-danger" : ""
                        }`}
                        style={{ left: `${dayPos(start, DAY_WIDTH) + DAY_WIDTH / 2 - 8}px` }}
                        title={isDelayed(row) ? t("ganttDelayedDays", { count: delayedDays(row) }) : row.title}
                      />
                    ) : !row.isSummary && start ? (
                      <div
                        data-testid="gantt-task-bar"
                        data-task-id={row.id}
                        onPointerDown={linkMode ? undefined : (e) => onPointerDown(e, row)}
                        onPointerMove={linkMode ? undefined : onPointerMove}
                        onPointerUp={linkMode ? undefined : onPointerUp}
                        onClick={linkMode ? () => startLink(row) : undefined}
                        onKeyDown={linkMode ? (e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            startLink(row);
                          }
                        } : undefined}
                        role={linkMode ? "button" : undefined}
                        tabIndex={linkMode ? 0 : undefined}
                        aria-pressed={linkMode ? linkSourceId === row.id : undefined}
                        className={`absolute top-2.5 h-7 select-none touch-none rounded-md ${STATUS_COLORS[row.status] ?? "bg-info"} shadow-sm ${
                          linkMode ? "cursor-pointer" : "cursor-grab"
                        } hover:opacity-80 ${
                          isCritical ? "ring-2 ring-danger" : ""
                        } ${isDelayed(row) ? "ring-2 ring-danger" : ""} ${
                          linkSourceId === row.id ? "ring-2 ring-accent" : ""
                        }`}
                        style={{ left: `${barLeft}px`, width: `${width}px` }}
                        title={isDelayed(row) ? t("ganttDelayedDays", { count: delayedDays(row) }) : undefined}
                      >
                        <div
                          className="h-full rounded-md bg-fg-inverse/20"
                          style={{ width: `${row.progress}%` }}
                        />
                        {!linkMode && (
                          <>
                            <button
                              type="button"
                              data-testid="gantt-task-resize-start"
                              data-task-id={row.id}
                              aria-label={t("ganttResizeStart")}
                              onPointerDown={(e) => onPointerDown(e, row, "resize-start")}
                              onClick={(e) => e.preventDefault()}
                              className={`absolute inset-y-0 z-10 w-3 cursor-col-resize appearance-none border-0 bg-fg-inverse/20 p-0 opacity-40 transition-opacity hover:bg-fg-inverse/20 hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg-inverse ${
                                direction === "rtl" ? "end-0" : "start-0"
                              }`}
                            />
                            <button
                              type="button"
                              data-testid="gantt-task-resize-due"
                              data-task-id={row.id}
                              aria-label={t("ganttResizeDue")}
                              onPointerDown={(e) => onPointerDown(e, row, "resize-due")}
                              onClick={(e) => e.preventDefault()}
                              className={`absolute inset-y-0 z-10 w-3 cursor-col-resize appearance-none border-0 bg-fg-inverse/20 p-0 opacity-40 transition-opacity hover:bg-fg-inverse/20 hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg-inverse ${
                                direction === "rtl" ? "start-0" : "end-0"
                              }`}
                            />
                          </>
                        )}
                      </div>
                    ) : row.isSummary && start ? (
                      <div
                        data-testid="gantt-task-bar"
                        data-task-id={row.id}
                        className={`absolute top-2.5 h-7 rounded-md ${STATUS_COLORS[row.status] ?? "bg-info"} border border-fg-primary/40 shadow-sm ${
                          isCritical ? "ring-2 ring-danger" : ""
                        } ${isDelayed(row) ? "ring-2 ring-danger" : ""}`}
                        style={{ left: `${barLeft}px`, width: `${width}px` }}
                        title={isDelayed(row) ? t("ganttDelayedDays", { count: delayedDays(row) }) : row.title}
                      />
                    ) : null}
                  </div>
                </div>
              );
            })}
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
      </div>
    </div>
  );
}

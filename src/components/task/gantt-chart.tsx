"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { toJalali, getMonthName } from "@/lib/date/jalali";
import { formatNumber, type Locale } from "@/lib/date/format";
import { useFormattedDate } from "@/lib/date/useFormattedDate";
import { apiFetch } from "@/lib/api-fetch";
import type { GanttReport, GanttRow } from "@/lib/gantt-types";
import { getTimelineItemWidth, getTimelinePosition, type TimelineDirection } from "@/lib/gantt/timeline";

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

export function GanttChart({ report, projectId: _projectId }: { report: GanttReport; projectId: string }) {
  const t = useTranslations("task");
  const locale = useLocale() as Locale;
  const { shortDate } = useFormattedDate();
  const [overrides, setOverrides] = useState<Record<string, { startDate: string | null; dueDate: string | null }>>({});
  const dragRef = useRef<{ id: string; startX: number; origStart: Date; origEnd: Date } | null>(null);

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

  const onPointerDown = (e: React.PointerEvent, r: GanttRow) => {
    if (r.isSummary) return;
    const { start, end } = dateFor(r);
    if (!start) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { id: r.id, startX: e.clientX, origStart: start, origEnd: end ?? start };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const deltaDays = Math.round((e.clientX - d.startX) / DAY_WIDTH);
    const ns = new Date(d.origStart);
    ns.setDate(ns.getDate() + deltaDays);
    const ne = new Date(d.origEnd);
    ne.setDate(ne.getDate() + deltaDays);
    setOverrides((prev) => ({ ...prev, [d.id]: { startDate: ns.toISOString(), dueDate: ne.toISOString() } }));
  };

  const onPointerUp = async () => {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d) return;
    const o = overrides[d.id];
    if (!o) return;
    try {
      await apiFetch(`/api/v1/tasks/${d.id}`, {
        method: "PATCH",
        body: JSON.stringify({ startDate: o.startDate, dueDate: o.dueDate }),
      });
    } catch {
      setOverrides((prev) => {
        const next = { ...prev };
        delete next[d.id];
        return next;
      });
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
            <svg className="pointer-events-none absolute inset-0" width={totalWidth + LEFT_WIDTH} height={rowsHeight}>
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
                  <path
                    key={link.id}
                    d={`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={invalid ? 1.5 : 1}
                    className={invalid ? "text-danger" : "text-fg-subtle"}
                    markerEnd="url(#gantt-arrow)"
                  >
                    {invalid ? <title>{t("ganttInvalidDep")}</title> : null}
                  </path>
                );
              })}
            </svg>

            {/* Rows */}
            {rows.map((row, i) => {
              const { start, end } = dateFor(row);
              const width = getTimelineItemWidth(start, end, DAY_WIDTH, BOX_WIDTH);
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
                        onPointerDown={(e) => onPointerDown(e, row)}
                        onPointerMove={onPointerMove}
                        onPointerUp={onPointerUp}
                        className={`absolute top-2.5 h-7 rounded-md ${STATUS_COLORS[row.status] ?? "bg-info"} shadow-sm cursor-grab hover:opacity-80 ${
                          isCritical ? "ring-2 ring-danger" : ""
                        } ${isDelayed(row) ? "ring-2 ring-danger" : ""}`}
                        style={{ left: `${dayPos(start, width)}px`, width: `${width}px` }}
                        title={isDelayed(row) ? t("ganttDelayedDays", { count: delayedDays(row) }) : undefined}
                      >
                        <div
                          className="h-full rounded-md bg-fg-inverse/20"
                          style={{ width: `${row.progress}%` }}
                        />
                      </div>
                    ) : row.isSummary && start ? (
                      <div
                        data-testid="gantt-task-bar"
                        data-task-id={row.id}
                        className={`absolute top-2.5 h-7 rounded-md ${STATUS_COLORS[row.status] ?? "bg-info"} border border-fg-primary/40 shadow-sm ${
                          isCritical ? "ring-2 ring-danger" : ""
                        } ${isDelayed(row) ? "ring-2 ring-danger" : ""}`}
                        style={{ left: `${dayPos(start, width)}px`, width: `${width}px` }}
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

      {report.criticalChain.length > 0 && (
        <div className="flex items-center gap-2 text-xs text-fg-muted">
          <span className="w-3 h-3 rounded ring-2 ring-danger" />
          {t("ganttCriticalPath")}
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

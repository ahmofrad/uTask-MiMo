"use client";

import { memo } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import type { Locale } from "@/lib/date/format";
import { useFormattedDate } from "@/lib/date/useFormattedDate";
import { getTimelineItemGeometry } from "@/lib/gantt/timeline";
import type { GanttRow } from "@/lib/gantt-types";
import type { TimelineDay } from "./gantt-header";

const STATUS_COLORS: Record<string, string> = {
  open: "bg-info",
  in_progress: "bg-warning",
  done: "bg-success",
  cancelled: "bg-fg-subtle",
};

const ROW_HEIGHT = 52;

type RowProps = {
  row: GanttRow;
  index: number;
  days: TimelineDay[];
  dayWidth: number;
  totalWidth: number;
  rangeStart: Date;
  linkMode: boolean;
  linkSourceId: string | null;
  showCritical: boolean;
  dateFor: (_r: GanttRow) => { start: Date | null; end: Date | null };
  isDelayed: (_r: GanttRow) => boolean;
  barTitle: (_r: GanttRow) => string;
  dayPos: (_date: Date | string | null, _itemWidth?: number) => number;
  timelineXForOffset: (_offset: number, _itemWidth?: number) => number;
  onPointerDown: (_e: React.PointerEvent, _r: GanttRow, _mode?: "move" | "resize-start" | "resize-due") => void;
  onPointerMove: (_e: React.PointerEvent) => void;
  onPointerUp: () => void;
  onLostPointerCapture: () => void;
  startLink: (_r: GanttRow) => void;
};

export const GanttTaskRow = memo(function GanttTaskRow({
  row,
  index,
  days,
  dayWidth,
  totalWidth,
  rangeStart,
  linkMode,
  linkSourceId,
  showCritical,
  dateFor,
  isDelayed,
  barTitle,
  dayPos,
  timelineXForOffset,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onLostPointerCapture,
  startLink,
}: RowProps) {
  const t = useTranslations("task");
  const locale = useLocale() as Locale;
  const { shortDate } = useFormattedDate();
  const direction: "ltr" | "rtl" = locale === "fa-IR" ? "rtl" : "ltr";

  const { start, end } = dateFor(row);
  const geometry = getTimelineItemGeometry(start, end, rangeStart, dayWidth);
  const width = geometry.width;
  const barLeft = timelineXForOffset(geometry.startOffset, width);
  const isCritical = row.critical;

  return (
    <div
      className="flex border-b border-border-secondary hover:bg-bg-secondary/50 transition-colors"
      style={{ position: "absolute", top: index * ROW_HEIGHT, left: 0, right: 0, height: ROW_HEIGHT }}
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
            title={day.holidayName || undefined}
            className={`absolute top-0 h-full border-e border-border-secondary/40 ${
              day.isToday ? "bg-accent-bg/30" : day.isNonWorking ? (day.holidayName ? "bg-danger-bg/40" : "bg-bg-surface-2/50") : ""
            }`}
            style={{
              left: `${timelineXForOffset(day.offset, dayWidth)}px`,
              width: `${dayWidth}px`,
            }}
          />
        ))}
        {row.isMilestone && start ? (
          <div
            className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 rotate-45 bg-accent border border-bg-surface ${
              isCritical && showCritical ? "ring-2 ring-danger" : ""
            } ${isDelayed(row) ? "ring-2 ring-danger" : ""}`}
            style={{ left: `${dayPos(start, dayWidth) + dayWidth / 2 - 8}px` }}
            title={barTitle(row)}
          />
        ) : !row.isSummary && start ? (
          <div
            data-testid="gantt-task-bar"
            data-task-id={row.id}
            onPointerDown={linkMode ? undefined : (e) => onPointerDown(e, row)}
            onPointerMove={linkMode ? undefined : onPointerMove}
            onPointerUp={linkMode ? undefined : onPointerUp}
            onLostPointerCapture={linkMode ? undefined : onLostPointerCapture}
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
              isCritical && showCritical ? "ring-2 ring-danger" : ""
            } ${isDelayed(row) ? "ring-2 ring-danger" : ""} ${
              linkSourceId === row.id ? "ring-2 ring-accent" : ""
            }`}
            style={{ left: `${barLeft}px`, width: `${width}px` }}
            title={barTitle(row) || undefined}
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
              isCritical && showCritical ? "ring-2 ring-danger" : ""
            } ${isDelayed(row) ? "ring-2 ring-danger" : ""}`}
            style={{ left: `${barLeft}px`, width: `${width}px` }}
            title={barTitle(row)}
          />
        ) : null}
      </div>
    </div>
  );
});
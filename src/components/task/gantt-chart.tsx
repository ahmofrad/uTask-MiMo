"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useTranslations } from "next-intl";

export type GanttTask = {
  id: string;
  title: string;
  status: string;
  priority: string;
  startDate: string | null;
  dueDate: string | null;
  assigneeId: string | null;
  parentTaskId: string | null;
};

type GanttChartProps = {
  tasks: GanttTask[];
};

const STATUS_COLORS: Record<string, string> = {
  open: "bg-info/70",
  in_progress: "bg-warning/70",
  done: "bg-success/70",
  cancelled: "bg-fg-subtle/40",
};

function startOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

function diffDays(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDay(d: Date): string {
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export function GanttChart({ tasks }: GanttChartProps) {
  const t = useTranslations("task");
  const { rows, totalDays, ticks, rangeStart } = useMemo(() => {
    const today = startOfDay(new Date());

    const rows = tasks
      .filter((tk) => tk.startDate || tk.dueDate)
      .map((t) => {
        const start = t.startDate ? startOfDay(new Date(t.startDate)) : today;
        const end = t.dueDate ? startOfDay(new Date(t.dueDate)) : start;
        return { ...t, start, end };
      })
      .sort((a, b) => a.start.getTime() - b.start.getTime());

    if (rows.length === 0) {
      const emptyStart = startOfDay(new Date());
      return { rows: [], totalDays: 30, ticks: [], rangeStart: emptyStart };
    }

    const allDates = rows.flatMap((r) => [r.start, r.end]);
    const minDate = new Date(Math.min(...allDates.map((d) => d.getTime())));
    const maxDate = new Date(Math.max(...allDates.map((d) => d.getTime())));

    const rangeStart = new Date(minDate);
    rangeStart.setDate(rangeStart.getDate() - 7);
    const rangeEnd = new Date(maxDate);
    rangeEnd.setDate(rangeEnd.getDate() + 90);

    const dayRange = diffDays(rangeStart, rangeEnd);
    if (dayRange < 14) {
      rangeEnd.setDate(rangeEnd.getDate() + (14 - dayRange));
    }

    const totalDays = diffDays(rangeStart, rangeEnd);
    const ticks: { date: Date; label: string; isMonth: boolean }[] = [];
    const cursor = new Date(rangeStart);
    let lastMonth = -1;

    for (let i = 0; i <= totalDays; i++) {
      const isMonth = cursor.getMonth() !== lastMonth;
      if (isMonth || i % 7 === 0) {
        ticks.push({
          date: new Date(cursor),
          label: isMonth
            ? cursor.toLocaleString("default", { month: "short", year: "numeric" })
            : formatDay(cursor),
          isMonth,
        });
        lastMonth = cursor.getMonth();
      }
      cursor.setDate(cursor.getDate() + 1);
    }

    return { rows, totalDays, ticks, rangeStart };
  }, [tasks]);

  const totalDaysVal = totalDays || 30;

  const getPosition = (date: Date) => {
    const days = diffDays(rangeStart, date);
    return Math.max(0, (days / totalDaysVal) * 100);
  };

  const getWidth = (start: Date, end: Date) => {
    const w = diffDays(start, end);
    return Math.max(((w + 1) / totalDaysVal) * 100, 1.5);
  };

  if (tasks.length === 0) {
    return (
      <div className="text-center py-12 text-fg-muted text-sm">
        {t("ganttNoTasks")}
      </div>
    );
  }

  const noDateTasks = tasks.filter((tk) => !tk.startDate && !tk.dueDate);

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto border border-border-primary rounded-lg">
        <div style={{ minWidth: Math.max(totalDaysVal * 30, 600) }}>
          {/* Header: date ticks */}
          <div className="flex border-b border-border-primary bg-bg-secondary">
            <div className="w-56 shrink-0 border-e border-border-primary p-2 text-xs font-medium text-fg-muted">
              {t("title")}
            </div>
            <div className="flex-1 relative h-8">
              {ticks.map((tick, i) => (
                <div
                  key={i}
                  className={`absolute top-0 h-full border-e border-border-secondary text-[10px] ${
                    tick.isMonth ? "font-semibold text-fg-primary" : "text-fg-muted"
                  }`}
                  style={{ left: `${getPosition(tick.date)}%` }}
                >
                  <span className="pl-1 leading-8">{tick.label}</span>
                </div>
              ))}
              {/* Today line */}
              <div
                className="absolute top-0 h-full w-px bg-danger/50 z-10"
                style={{ left: `${getPosition(startOfDay(new Date()))}%` }}
              />
            </div>
          </div>

          {/* Rows */}
          {rows.map((row) => (
            <div key={row.id} className="flex border-b border-border-secondary hover:bg-bg-secondary/50 transition-colors">
              <div className="w-56 shrink-0 border-e border-border-primary p-2">
                <Link
                  href={`/tasks/${row.id}`}
                  className="text-xs font-medium text-fg-primary hover:text-accent truncate block"
                >
                  {row.title}
                </Link>
                <span className="text-[10px] text-fg-muted capitalize">{row.priority}</span>
              </div>
              <div className="flex-1 relative h-10 my-auto">
                {/* Grid lines */}
                {ticks.filter((tk) => tk.isMonth).map((tick, i) => (
                  <div
                    key={i}
                    className="absolute top-0 h-full border-e border-border-secondary/50"
                    style={{ left: `${getPosition(tick.date)}%` }}
                  />
                ))}
                {/* Task bar */}
                <div
                  className={`absolute top-2 h-6 rounded-md ${STATUS_COLORS[row.status] || "bg-info/70"} flex items-center px-1.5 cursor-pointer hover:opacity-80 transition-opacity`}
                  style={{
                    left: `${getPosition(row.start)}%`,
                    width: `${getWidth(row.start, row.end)}%`,
                  }}
                >
                  <span className="text-[10px] font-medium text-fg-primary truncate">{row.title}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {noDateTasks.length > 0 && (
        <div className="text-xs text-fg-muted">
          {noDateTasks.length} task{noDateTasks.length !== 1 ? "s" : ""} without start/due dates (not shown in timeline)
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-fg-muted">
        {Object.entries(STATUS_COLORS).map(([status, color]) => (
          <div key={status} className="flex items-center gap-1.5">
            <span className={`w-3 h-3 rounded ${color}`} />
            <span className="capitalize">{status.replace("_", " ")}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

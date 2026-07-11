"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { toJalali, getMonthName } from "@/lib/date/jalali";
import { useFormattedDate } from "@/lib/date/useFormattedDate";
import { apiFetch } from "@/lib/api-fetch";
import type { GanttReport, GanttRow } from "@/lib/gantt-types";

const DAY_WIDTH = 52;
const BOX_WIDTH = 64;
const LEFT_WIDTH = 288;

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
  const { shortDate } = useFormattedDate();
  const [overrides, setOverrides] = useState<Record<string, { startDate: string | null; dueDate: string | null }>>({});
  const dragRef = useRef<{ id: string; startX: number; origStart: Date; origEnd: Date } | null>(null);

  const rows = report.tasks;

  const { rangeStart, totalDays, ticks } = useMemo(() => {
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
    const tk: { date: Date; label: string; isMonth: boolean }[] = [];
    const cursor = new Date(start);
    let lastMonth = -1;
    for (let i = 0; i <= total; i++) {
      const jm = toJalali(cursor).jm;
      const isMonth = jm !== lastMonth;
      if (isMonth || i % 7 === 0) {
        tk.push({
          date: new Date(cursor),
          label: isMonth ? `${getMonthName(toJalali(cursor).jm, "fa-IR")} ${toJalali(cursor).jy}` : `${toJalali(cursor).jd}`,
          isMonth,
        });
        lastMonth = jm;
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    return { rangeStart: start, totalDays: total, ticks: tk };
  }, [rows]);

  const dayPos = (date: Date | string | null): number => {
    if (!date) return 0;
    return diffDays(rangeStart, startOfDay(new Date(date))) * DAY_WIDTH;
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
  const totalWidth = totalDays * DAY_WIDTH;

  const rowIndex = new Map<string, number>();
  rows.forEach((r, i) => rowIndex.set(r.id, i));

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto border border-border-primary rounded-lg">
        <div style={{ minWidth: totalWidth + LEFT_WIDTH }}>
          {/* Header */}
          <div className="flex border-b border-border-primary bg-bg-secondary">
            <div className="w-72 shrink-0 border-e border-border-primary p-2 text-xs font-medium text-fg-muted">
              {t("wbs")}
            </div>
            <div className="flex-1 relative h-8">
              {ticks.map((tick, i) => (
                <div
                  key={i}
                  className={`absolute top-0 h-full border-e border-border-secondary text-[10px] ${
                    tick.isMonth ? "font-semibold text-fg-primary" : "text-fg-muted"
                  }`}
                  style={{ left: `${dayPos(tick.date)}px` }}
                >
                  <span className="pl-1 leading-8">{tick.label}</span>
                </div>
              ))}
              <div
                className="absolute top-0 h-full w-px bg-danger/50 z-10"
                style={{ left: `${dayPos(startOfDay(new Date()))}px` }}
              />
            </div>
          </div>

          {/* Dependency arrows overlay */}
          <div className="relative" style={{ height: rows.length * 48 }}>
            <svg className="absolute inset-0 pointer-events-none" width={totalWidth + LEFT_WIDTH} height={rows.length * 48}>
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
                const x1 = LEFT_WIDTH + dayPos(sEnd) + BOX_WIDTH;
                const y1 = sRow * 48 + 24;
                const x2 = LEFT_WIDTH + dayPos(tStart);
                const y2 = tRow * 48 + 24;
                const mx = (x1 + x2) / 2;
                return (
                  <path
                    key={link.id}
                    d={`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1}
                    className="text-fg-subtle"
                    markerEnd="url(#gantt-arrow)"
                  />
                );
              })}
            </svg>

            {/* Rows */}
            {rows.map((row, i) => {
              const { start, end } = dateFor(row);
              const left = dayPos(start);
              const width = BOX_WIDTH;
              const isCritical = row.critical;
              return (
                <div
                  key={row.id}
                  className="flex border-b border-border-secondary hover:bg-bg-secondary/50 transition-colors"
                  style={{ position: "absolute", top: i * 48, left: 0, right: 0, height: 48 }}
                >
                  <div className="w-72 shrink-0 border-e border-border-primary p-2 flex flex-col justify-center gap-0.5 overflow-hidden">
                    <div className="flex items-baseline gap-1 min-w-0">
                      <span className="text-[10px] font-mono text-fg-subtle shrink-0">{row.wbsCode}</span>
                      <Link
                        href={`/tasks/${row.id}`}
                        className="text-xs font-medium text-fg-primary hover:text-accent truncate"
                        title={row.title}
                      >
                        {row.title}
                      </Link>
                    </div>
                    {start || end ? (
                      <span className="text-[10px] text-fg-muted truncate">
                        {shortDate((start ?? end)!.toISOString())} – {shortDate((end ?? start)!.toISOString())}
                      </span>
                    ) : null}
                  </div>
                  <div className="flex-1 relative">
                    {ticks.filter((tk) => tk.isMonth).map((tk, idx) => (
                      <div
                        key={idx}
                        className="absolute top-0 h-full border-e border-border-secondary/40"
                        style={{ left: `${dayPos(tk.date)}px` }}
                      />
                    ))}
                    {row.isMilestone && start ? (
                      <div
                        className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rotate-45 bg-accent border border-bg-surface"
                        style={{ left: `${dayPos(start) + DAY_WIDTH / 2 - 8}px` }}
                        title={row.title}
                      />
                    ) : !row.isSummary && start ? (
                      <div
                        onPointerDown={(e) => onPointerDown(e, row)}
                        onPointerMove={onPointerMove}
                        onPointerUp={onPointerUp}
                        className={`absolute top-2.5 h-7 rounded-md ${STATUS_COLORS[row.status] ?? "bg-info"} shadow-sm cursor-grab hover:opacity-80 ${
                          isCritical ? "ring-2 ring-danger" : ""
                        }`}
                        style={{ left: `${left}px`, width: `${width}px` }}
                      >
                        <div
                          className="h-full rounded-md bg-fg-inverse/20"
                          style={{ width: `${row.progress}%` }}
                        />
                      </div>
                    ) : row.isSummary && start ? (
                      <div
                        className={`absolute top-2.5 h-7 rounded-md ${STATUS_COLORS[row.status] ?? "bg-info"} border border-fg-primary/40 shadow-sm ${
                          isCritical ? "ring-2 ring-danger" : ""
                        }`}
                        style={{ left: `${left}px`, width: `${width}px` }}
                        title={row.title}
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
      </div>
    </div>
  );
}

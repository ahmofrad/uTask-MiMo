"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { toJalali, toGregorian, getDaysInMonth, getMonthName, getDayName } from "@/lib/date/jalali";
import { cn } from "@/lib/cn";

export type CalendarTask = {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
  startDate?: string | null;
  progress?: number | null;
};

const STATUS_CHIP: Record<string, string> = {
  open: "border-s-info",
  in_progress: "border-s-warning",
  done: "border-s-success",
  cancelled: "border-s-fg-muted",
};

// getDayName indexes 0=Sat..6=Fri. Friday (index 6) is the weekend for the
// Jalali locale; Saturday+Sunday (indices 0 and 1) for the Gregorian locale.
function isWeekend(date: Date, locale: string): boolean {
  const jsDay = date.getDay(); // 0=Sun..6=Sat
  const idx = (jsDay + 1) % 7; // 0=Sat..6=Fri
  if (locale === "fa-IR") return idx === 6;
  return idx === 0 || idx === 1;
}

type CalendarViewProps = {
  tasks: CalendarTask[];
  onMove?: (_taskId: string, _newDueDate: string, _newStartDate: string | null) => Promise<void>;
};

function atMidnight(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function CalendarView({ tasks, onMove }: CalendarViewProps) {
  const t = useTranslations("task");
  const locale = useLocale() as "fa-IR" | "en-US";
  const isJalali = locale === "fa-IR";
  const [monthOffset, setMonthOffset] = useState(0);
  const [items, setItems] = useState<CalendarTask[]>(tasks);

  useEffect(() => {
    setItems(tasks);
  }, [tasks]);

  const now = new Date();
  const baseDate = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const jBase = isJalali ? toJalali(baseDate) : null;
  const year = isJalali ? jBase!.jy : baseDate.getFullYear();
  const month = isJalali ? jBase!.jm : baseDate.getMonth() + 1;
  const daysInMonth = isJalali ? getDaysInMonth(year, month) : new Date(year, month, 0).getDate();
  const firstDayDate = isJalali ? toGregorian(year, month, 1) : new Date(year, month - 1, 1);
  const startOffset = (firstDayDate.getDay() + 1) % 7;
  const weekdays = Array.from({ length: 7 }, (_, i) => getDayName(i, locale));

  const todayJ = toJalali(now);
  const isToday = (day: number) =>
    isJalali
      ? todayJ.jy === year && todayJ.jm === month && todayJ.jd === day
      : now.getFullYear() === year && now.getMonth() + 1 === month && now.getDate() === day;
  const isWeekendDay = (day: number) => {
    const g = isJalali ? toGregorian(year, month, day) : new Date(year, month - 1, day);
    return isWeekend(g, locale);
  };

  function cellDate(day: number): Date {
    if (isJalali) {
      return atMidnight(toGregorian(year, month, day));
    }
    return new Date(year, month - 1, day, 0, 0, 0);
  }

  function getTasksForDay(day: number): CalendarTask[] {
    return items.filter((task) => {
      if (!task.dueDate) return false;
      const d = new Date(task.dueDate);
      if (isJalali) {
        const j = toJalali(d);
        return j.jy === year && j.jm === month && j.jd === day;
      }
      return d.getFullYear() === year && d.getMonth() + 1 === month && d.getDate() === day;
    });
  }

  async function handleDrop(taskId: string, day: number): Promise<void> {
    if (!onMove) return;
    const task = items.find((tk) => tk.id === taskId);
    if (!task || !task.dueDate) return;

    const oldDue = atMidnight(new Date(task.dueDate));
    const newDue = cellDate(day);
    const deltaDays = Math.round((newDue.getTime() - oldDue.getTime()) / 86400000);
    const newStartIso =
      task.startDate != null
        ? atMidnight(new Date(new Date(task.startDate).getTime() + deltaDays * 86400000)).toISOString()
        : null;
    const newDueIso = newDue.toISOString();

    const snapshot = items;
    setItems((prev) =>
      prev.map((tk) =>
        tk.id === taskId
          ? { ...tk, dueDate: newDueIso, startDate: newStartIso ?? tk.startDate ?? null }
          : tk,
      ),
    );
    try {
      await onMove(taskId, newDueIso, newStartIso);
    } catch {
      setItems(snapshot);
    }
  }

  const monthName = isJalali
    ? getMonthName(month, "fa-IR")
    : new Date(year, month - 1).toLocaleString("en-US", { month: "long" });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setMonthOffset(monthOffset - 1)}
          className="p-2 hover:bg-bg-surface rounded-lg transition-colors"
          aria-label={t("prevMonth")}
        >
          <svg className="w-5 h-5 text-fg-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <h2 className="text-lg font-semibold text-fg-primary">{monthName} {year}</h2>
        <button
          onClick={() => setMonthOffset(monthOffset + 1)}
          className="p-2 hover:bg-bg-surface rounded-lg transition-colors"
          aria-label={t("nextMonth")}
        >
          <svg className="w-5 h-5 text-fg-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        </button>
      </div>

      <div
        className="grid grid-cols-7 gap-1"
        onDragOver={(e) => {
          if (onMove) e.preventDefault();
        }}
      >
        {weekdays.map((d) => (
          <div key={d} className="text-center text-xs text-fg-muted py-1 font-medium">{d}</div>
        ))}
        {Array.from({ length: startOffset }).map((_, i) => <div key={`e${i}`} />)}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const dayTasks = getTasksForDay(day);
          return (
            <div
              key={day}
              className={cn(
                "min-h-[60px] p-1 rounded-lg border text-xs transition-colors",
                dayTasks.length > 0 ? "border-accent/30 bg-accent-bg/30" : "border-border-primary",
                isWeekendDay(day) ? "bg-secondary/40" : "",
                isToday(day) ? "ring-2 ring-accent" : "",
                onMove ? "hover:border-accent/60" : "",
              )}
              onDrop={(e) => {
                if (!onMove) return;
                e.preventDefault();
                const id = e.dataTransfer.getData("text/task-id");
                if (id) void handleDrop(id, day);
              }}
            >
              <div className={cn("text-start mb-1", isToday(day) ? "font-semibold text-accent" : "text-fg-muted")}>{day}</div>
              {dayTasks.slice(0, 3).map((task) => {
                const draggable = !!onMove && !!task.dueDate;
                return (
                  <Link
                    key={task.id}
                    href={`/tasks/${task.id}`}
                    draggable={draggable}
                    onDragStart={
                      draggable
                        ? (e) => {
                            e.dataTransfer.setData("text/task-id", task.id);
                            e.dataTransfer.effectAllowed = "move";
                          }
                        : undefined
                    }
                    className={cn(
                      "block text-xs text-fg-primary truncate px-1 py-0.5 rounded border-s-2 hover:shadow-sm hover:bg-accent/20 cursor-grab active:cursor-grabbing",
                      STATUS_CHIP[task.status] ?? "border-s-fg-muted",
                    )}
                    title={draggable ? t("dragToReschedule") : undefined}
                  >
                    <span className="flex items-center gap-1">
                      {task.priority === "high" && <span className="inline-block w-1.5 h-1.5 rounded-full bg-danger shrink-0" />}
                      <span className="truncate">{task.title}</span>
                    </span>
                    {task.progress != null && task.status !== "done" && (
                      <span className="mt-0.5 block h-0.5 w-full rounded-full bg-secondary overflow-hidden">
                        <span
                          className="block h-full bg-accent"
                          style={{ width: `${Math.max(0, Math.min(100, task.progress))}%` }}
                        />
                      </span>
                    )}
                  </Link>
                );
              })}
              {dayTasks.length > 3 && (
                <div className="text-xs text-fg-subtle text-center">+{dayTasks.length - 3}</div>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-fg-muted">
        {(["open", "in_progress", "done", "cancelled"] as const).map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5">
            <span className={cn("inline-block w-2.5 h-2.5 rounded-full border-s-2", STATUS_CHIP[s])} />
            {t(`status.${s}`)}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-danger" />
          {t("priority.high")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded ring-2 ring-accent" />
          {t("todayLabel")}
        </span>
      </div>
      {onMove && <p className="text-xs text-fg-muted">{t("dragHint")}</p>}
    </div>
  );
}

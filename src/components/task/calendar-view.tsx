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
};

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
        <h3 className="text-lg font-semibold text-fg-primary">{monthName} {year}</h3>
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
                onMove ? "hover:border-accent/60" : "",
              )}
              onDrop={(e) => {
                if (!onMove) return;
                e.preventDefault();
                const id = e.dataTransfer.getData("text/task-id");
                if (id) void handleDrop(id, day);
              }}
            >
              <div className="text-right text-fg-muted mb-1">{day}</div>
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
                    className="block text-[10px] text-fg-primary truncate px-1 py-0.5 rounded hover:bg-accent/20 cursor-grab active:cursor-grabbing"
                    title={draggable ? t("dragToReschedule") : undefined}
                  >
                    {task.title}
                  </Link>
                );
              })}
              {dayTasks.length > 3 && (
                <div className="text-[10px] text-fg-subtle text-center">+{dayTasks.length - 3}</div>
              )}
            </div>
          );
        })}
      </div>
      {onMove && <p className="text-xs text-fg-muted">{t("dragHint")}</p>}
    </div>
  );
}

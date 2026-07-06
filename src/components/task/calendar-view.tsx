"use client";

import { useState } from "react";
import Link from "next/link";
import { useLocale } from "next-intl";
import { toJalali, toGregorian, getDaysInMonth, getMonthName, getDayName } from "@/lib/date/jalali";
import { cn } from "@/lib/cn";

type CalendarTask = {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
};

type CalendarViewProps = {
  tasks: CalendarTask[];
};

export function CalendarView({ tasks }: CalendarViewProps) {
  const locale = useLocale() as "fa-IR" | "en-US";
  const isJalali = locale === "fa-IR";
  const [monthOffset, setMonthOffset] = useState(0);

  const now = new Date();
  const baseDate = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const jBase = isJalali ? toJalali(baseDate) : null;
  const year = isJalali ? jBase!.jy : baseDate.getFullYear();
  const month = isJalali ? jBase!.jm : baseDate.getMonth() + 1;
  const daysInMonth = isJalali ? getDaysInMonth(year, month) : new Date(year, month, 0).getDate();
  const firstDayDate = isJalali ? toGregorian(year, month, 1) : new Date(year, month - 1, 1);
  const startOffset = (firstDayDate.getDay() + 1) % 7;
  const weekdays = Array.from({ length: 7 }, (_, i) => getDayName(i, locale));

  function getTasksForDay(day: number): CalendarTask[] {
    return tasks.filter((task) => {
      if (!task.dueDate) return false;
      const d = new Date(task.dueDate);
      if (isJalali) {
        const j = toJalali(d);
        return j.jy === year && j.jm === month && j.jd === day;
      }
      return d.getFullYear() === year && d.getMonth() + 1 === month && d.getDate() === day;
    });
  }

  const monthName = isJalali
    ? getMonthName(month, "fa-IR")
    : new Date(year, month - 1).toLocaleString("en-US", { month: "long" });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={() => setMonthOffset(monthOffset - 1)} className="p-2 hover:bg-bg-surface rounded-lg transition-colors">
          <svg className="w-5 h-5 text-fg-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <h3 className="text-lg font-semibold text-fg-primary">{monthName} {year}</h3>
        <button onClick={() => setMonthOffset(monthOffset + 1)} className="p-2 hover:bg-bg-surface rounded-lg transition-colors">
          <svg className="w-5 h-5 text-fg-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1">
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
              )}
            >
              <div className="text-right text-fg-muted mb-1">{day}</div>
              {dayTasks.slice(0, 3).map((task) => (
                <Link
                  key={task.id}
                  href={`/tasks/${task.id}`}
                  className="block text-[10px] text-fg-primary truncate px-1 py-0.5 rounded hover:bg-accent/20"
                >
                  {task.title}
                </Link>
              ))}
              {dayTasks.length > 3 && (
                <div className="text-[10px] text-fg-subtle text-center">+{dayTasks.length - 3}</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

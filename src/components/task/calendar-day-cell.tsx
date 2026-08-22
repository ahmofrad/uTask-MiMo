"use client";

import { memo } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
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

export const STATUS_CHIP: Record<string, string> = {
  open: "border-s-info",
  in_progress: "border-s-warning",
  pending_approval: "border-s-tone-violet",
  done: "border-s-success",
  cancelled: "border-s-fg-muted",
};

type Props = {
  day: number;
  dayTasks: CalendarTask[];
  holiday: string | null;
  isHoliday: boolean;
  isDayOff: boolean;
  isWeekend: boolean;
  isToday: boolean;
  dateOnly: string;
  onMove: boolean;
  onDrop: (_taskId: string, _day: number) => void;
};

export const CalendarDayCell = memo(function CalendarDayCell({
  day,
  dayTasks,
  holiday,
  isHoliday,
  isDayOff,
  isWeekend,
  isToday,
  dateOnly,
  onMove,
  onDrop,
}: Props) {
  const t = useTranslations("task");

  return (
    <div
      data-testid={isHoliday ? "calendar-holiday" : "calendar-day"}
      data-date={dateOnly}
      title={holiday || undefined}
      className={cn(
        "min-h-[60px] p-1 rounded-lg border text-xs transition-colors",
        dayTasks.length > 0 ? "border-accent/30 bg-accent-bg/30" : "border-border-primary",
        isWeekend ? "bg-secondary/40" : "",
        isDayOff ? "bg-danger-bg/50 border-danger/40" : "",
        isToday ? "ring-2 ring-accent" : "",
        onMove ? "hover:border-accent/60" : "",
      )}
      onDrop={(e) => {
        if (!onMove) return;
        e.preventDefault();
        const id = e.dataTransfer.getData("text/task-id");
        if (id) onDrop(id, day);
      }}
    >
      <div
        className={cn(
          "text-start mb-1",
          isToday
            ? "font-semibold text-accent"
            : isDayOff
              ? "font-semibold text-danger"
              : "text-fg-muted",
        )}
      >
        {day}
        {isHoliday && (
          <span
            className={cn(
              "ms-1 inline-block h-1.5 w-1.5 rounded-full align-middle",
              isDayOff ? "bg-danger" : "bg-fg-subtle",
            )}
          />
        )}
      </div>
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
              {task.priority === "high" && (
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-danger shrink-0" />
              )}
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
});

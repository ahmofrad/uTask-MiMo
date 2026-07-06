"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { TaskList } from "@/components/task/task-list";
import { formatDate } from "@/lib/date/format";

type TaskItem = {
  id: string;
  title: string;
  status: string;
  priority: string;
  projectId: string;
  assigneeId: string | null;
  dueDate: string | null;
  orderIndex: number;
};

type UpcomingPageProps = {
  tasks: TaskItem[];
};

export function UpcomingPage({ tasks }: UpcomingPageProps) {
  const t = useTranslations();
  const locale = useLocale() as "fa-IR" | "en-US";

  const grouped = useMemo(() => {
    const groups: Map<string, TaskItem[]> = new Map();
    for (const t of tasks) {
      if (!t.dueDate) continue;
      const date = new Date(t.dueDate);
      const key = date.toISOString().slice(0, 10);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(t);
    }
    return Array.from(groups.entries())
      .sort(([a], [b]) => a.localeCompare(b));
  }, [tasks]);

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (tasks.length === 0) {
    return <p className="text-sm text-fg-muted py-8 text-center">{t("task.noUpcomingTasks")}</p>;
  }

  return (
    <div className="space-y-6">
      {grouped.map(([dateKey, dayTasks]) => {
        const date = new Date(dateKey + "T00:00:00");
        const isToday = date.getTime() === startOfToday.getTime();
        const label = isToday
          ? t("task.todayLabel")
          : formatDate(date, locale, "jalali");

        return (
          <section key={dateKey}>
            <h2 className="text-sm font-semibold text-fg-primary mb-3">
              {label}
              <span className="text-fg-muted font-normal ms-2">({dayTasks.length})</span>
            </h2>
            <TaskList initialTasks={dayTasks} />
          </section>
        );
      })}
    </div>
  );
}

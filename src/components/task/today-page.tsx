"use client";

import { TaskList } from "@/components/task/task-list";
import { useTranslations } from "next-intl";

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

type TodayPageProps = {
  tasks: TaskItem[];
};

export function TodayPage({ tasks }: TodayPageProps) {
  const t = useTranslations();
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const overdue = tasks.filter((t) => t.dueDate && new Date(t.dueDate) < startOfToday);
  const dueToday = tasks.filter((t) => !t.dueDate || new Date(t.dueDate) >= startOfToday);

  if (tasks.length === 0) {
    return <p className="text-sm text-fg-muted py-8 text-center">{t("task.noTasksToday")}</p>;
  }

  return (
    <div className="space-y-8">
      {overdue.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-destructive mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-destructive" />
            {t("task.overdue")} ({overdue.length})
          </h2>
          <TaskList initialTasks={overdue} />
        </section>
      )}
      {dueToday.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-fg-primary mb-3">{t("task.dueToday")} ({dueToday.length})</h2>
          <TaskList initialTasks={dueToday} />
        </section>
      )}
    </div>
  );
}

"use client";

import { TaskList } from "@/components/task/task-list";
import { type AssigneeUser } from "@/components/task/assignee-stack";
import { useTranslations } from "next-intl";

type TaskItem = {
  id: string;
  title: string;
  status: string;
  priority: string;
  projectId: string;
  assignees: AssigneeUser[];
  dueDate: string | null;
  orderIndex: number;
};

type InboxPageProps = {
  unassigned: TaskItem[];
  watching: TaskItem[];
};

export function InboxPage({ unassigned, watching }: InboxPageProps) {
  const t = useTranslations();
  const watchingFiltered = watching.filter(
    (w) => !unassigned.some((u) => u.id === w.id),
  );

  if (unassigned.length === 0 && watchingFiltered.length === 0) {
    return <p className="text-sm text-fg-muted py-8 text-center">{t("task.noUnassigned")}</p>;
  }

  return (
    <div className="space-y-8">
      {unassigned.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-fg-primary mb-3">
            {t("task.unassigned")} ({unassigned.length})
          </h2>
          <TaskList initialTasks={unassigned} />
        </section>
      )}
      {watchingFiltered.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-fg-primary mb-3">
            {t("task.watchingCount")} ({watchingFiltered.length})
          </h2>
          <TaskList initialTasks={watchingFiltered} />
        </section>
      )}
    </div>
  );
}

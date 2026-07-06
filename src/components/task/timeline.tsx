"use client";

import { useTranslations } from "next-intl";
import { useFormattedDate } from "@/lib/date/useFormattedDate";
import { TaskCard, type TaskCardData } from "@/components/task/task-card";

type TimelineTask = TaskCardData & {
  assigneeId: string | null;
};

type TimelineProps = {
  tasks: TimelineTask[];
  showProject?: boolean;
};

function groupByDate(tasks: TimelineTask[]): Map<string, TimelineTask[]> {
  const groups = new Map<string, TimelineTask[]>();
  const noDate: TimelineTask[] = [];

  for (const task of tasks) {
    if (!task.dueDate) {
      noDate.push(task);
      continue;
    }
    const key = task.dueDate.split("T")[0] as string;
    const existing = groups.get(key) ?? [];
    existing.push(task);
    groups.set(key, existing);
  }

  const sorted = new Map([...groups.entries()].sort(([a], [b]) => a.localeCompare(b)));
  if (noDate.length > 0) sorted.set("no-date", noDate);
  return sorted;
}

export function Timeline({ tasks, showProject }: TimelineProps) {
  const t = useTranslations("task");
  const { date } = useFormattedDate();
  const grouped = groupByDate(tasks);

  if (tasks.length === 0) {
    return <p className="text-sm text-fg-muted py-8 text-center">{t("noTimelineTasks")}</p>;
  }

  return (
    <div className="relative pl-6 space-y-6">
      <div className="absolute left-2 top-0 bottom-0 w-px bg-border-primary" />
      {Array.from(grouped.entries()).map(([dateKey, dateTasks]) => (
        <div key={dateKey}>
          <div className="relative mb-3">
            <div className="absolute -left-[18px] w-3 h-3 rounded-full bg-accent border-2 border-bg-primary" />
            <h3 className="text-sm font-semibold text-fg-primary">
              {dateKey === "no-date" ? t("noDate") : date(dateKey)}
            </h3>
          </div>
          <div className="space-y-2">
            {dateTasks.map((task) => (
              <div key={task.id} className="p-3 rounded-lg border border-border-primary bg-bg-surface hover:border-border-strong transition-colors overflow-hidden">
                <TaskCard
                  task={task}
                  variant="compact"
                  showProject={showProject}
                />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

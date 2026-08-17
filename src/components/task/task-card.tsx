"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { StatusBadge } from "@/components/task/status-badge";
import { PriorityBadge } from "@/components/task/priority-badge";
import { DueDateChip } from "@/components/task/due-date-chip";
import { AssigneeStack, type AssigneeUser } from "@/components/task/assignee-stack";
import { useFormattedDate } from "@/lib/date/useFormattedDate";
import { hasInvalidLink, type PredecessorInfo } from "@/lib/tasks/dependency-status";

export type TaskCardData = {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  priority: string;
  dueDate: string | null;
  startDate?: string | null;
  assignees?: AssigneeUser[];
  projectName?: string;
  tags?: { id: string; name: string }[];
  subtaskCount?: number;
  subtaskDone?: number;
  blockedBy?: PredecessorInfo[];
};

type TaskCardProps = {
  task: TaskCardData;
  variant: "compact" | "list";
  showProject?: boolean | undefined;
};

const STATUS_BORDER: Record<string, string> = {
  open: "border-s-info",
  in_progress: "border-s-warning",
  done: "border-s-success",
  cancelled: "border-s-fg-subtle",
};

function BlockedBadge({ blockedBy }: { blockedBy: PredecessorInfo[] }) {
  const t = useTranslations("task");
  const titles = blockedBy.map((p) => p.title).join(", ");
  const label = blockedBy.length === 1
    ? t("blockedBy", { title: blockedBy[0]?.title ?? "" })
    : t("blockedByCount", { count: blockedBy.length });
  return (
    <span
      data-testid="task-blocked-badge"
      title={`${label}. ${t("dependencies.title")}: ${titles}`}
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-danger-bg text-danger"
    >
      <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      </svg>
      {blockedBy.length}
    </span>
  );
}

function DependencyWarning({ task }: { task: TaskCardData }) {
  const t = useTranslations("task");
  if (!task.blockedBy || task.blockedBy.length === 0) return null;
  if (!hasInvalidLink(task.startDate ?? null, task.blockedBy)) return null;
  const overlapping = task.blockedBy.filter(
    (p) => p.dueDate && task.startDate && new Date(p.dueDate).getTime() > new Date(task.startDate).getTime(),
  );
  return (
    <p
      data-testid="task-dependency-warning"
      className="flex items-start gap-1.5 text-xs text-danger mt-1.5 leading-snug"
    >
      <svg className="w-3 h-3 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      </svg>
      <span>
        {t("dependencyWarning")}: {overlapping.map((p) => p.title).join(", ")}
      </span>
    </p>
  );
}

export function TaskCard({ task, variant, showProject }: TaskCardProps) {
  const { shortDate } = useFormattedDate();
  const blockedBy = task.blockedBy ?? [];

  if (variant === "compact") {
    return (
      <div className={`relative group overflow-hidden min-w-0 w-full ${STATUS_BORDER[task.status] ?? "border-s-info"}`}>
        <Link href={`/tasks/${task.id}`} draggable={false} className="block overflow-hidden max-w-full">
          <p className="text-sm font-medium text-fg-primary mb-1.5 leading-snug hover:text-accent whitespace-nowrap overflow-hidden text-ellipsis max-w-full block">
            {task.title}
          </p>
        </Link>

        {/* Status + Priority row */}
        <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
          <StatusBadge status={task.status as "open" | "in_progress" | "done" | "cancelled"} />
          <PriorityBadge priority={task.priority as "low" | "med" | "high" | "urgent"} />
          <DueDateChip dueDate={task.dueDate} isCompleted={task.status === "done"} />
          {blockedBy.length > 0 && <BlockedBadge blockedBy={blockedBy} />}
        </div>

        {/* Description snippet */}
        {task.description && (
          <p className="text-xs text-fg-muted line-clamp-2 mb-1.5 leading-relaxed">
            {task.description.replace(/<[^>]+>/g, "").slice(0, 120)}
          </p>
        )}

        {/* Tags */}
        {task.tags && task.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-1.5">
            {task.tags.slice(0, 3).map((tag) => (
              <span key={tag.id} className="text-xs px-1.5 py-0.5 rounded bg-accent/10 text-accent">
                {tag.name}
              </span>
            ))}
            {task.tags.length > 3 && (
              <span className="text-xs text-fg-muted">+{task.tags.length - 3}</span>
            )}
          </div>
        )}

        {/* Subtask progress */}
        {task.subtaskCount != null && task.subtaskCount > 0 && (
          <div className="flex items-center gap-1.5 mb-1.5">
            <div className="flex-1 h-1 bg-bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-success rounded-full"
                style={{ width: `${((task.subtaskDone ?? 0) / task.subtaskCount) * 100}%` }}
              />
            </div>
            <span className="text-xs text-fg-muted">{task.subtaskDone ?? 0}/{task.subtaskCount}</span>
          </div>
        )}

        {/* Footer: project + assignees */}
        <div className="flex items-center justify-between mt-1 gap-2">
          {showProject && task.projectName && (
            <span className="text-xs text-fg-muted truncate max-w-[60%]">{task.projectName}</span>
          )}
          <AssigneeStack assignees={task.assignees ?? []} size="sm" />
        </div>
      </div>
    );
  }

  // variant === "list"
  return (
    <Link
      href={`/tasks/${task.id}`}
      draggable={false}
      className="flex items-center gap-3 p-3 rounded-xl border border-border-primary bg-bg-surface hover:border-accent/40 transition-colors"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <StatusBadge status={task.status as "open" | "in_progress" | "done" | "cancelled"} />
          <span className="text-sm font-medium text-fg-primary truncate">{task.title}</span>
          {blockedBy.length > 0 && <BlockedBadge blockedBy={blockedBy} />}
        </div>

        {/* Tags + description row */}
        <div className="flex items-center gap-2 mt-1">
          {task.tags && task.tags.length > 0 && (
            <div className="flex gap-1">
              {task.tags.slice(0, 3).map((tag) => (
                <span key={tag.id} className="text-xs px-1.5 py-0.5 rounded bg-accent/10 text-accent">
                  {tag.name}
                </span>
              ))}
            </div>
          )}
          {task.description && (
            <span className="text-xs text-fg-muted truncate hidden sm:inline">
              {task.description.replace(/<[^>]+>/g, "").slice(0, 80)}
            </span>
          )}
        </div>

        <DependencyWarning task={task} />
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <PriorityBadge priority={task.priority as "low" | "med" | "high" | "urgent"} />
        {task.dueDate && (
          <span className="text-xs text-fg-muted">{shortDate(task.dueDate)}</span>
        )}
        {task.subtaskCount != null && task.subtaskCount > 0 && (
          <span className="text-xs text-fg-muted">{task.subtaskDone ?? 0}/{task.subtaskCount}</span>
        )}
        {showProject && task.projectName && (
          <span className="text-xs text-fg-muted bg-bg-secondary px-1.5 py-0.5 rounded hidden sm:inline">{task.projectName}</span>
        )}
        <AssigneeStack assignees={task.assignees ?? []} size="sm" />
      </div>
    </Link>
  );
}


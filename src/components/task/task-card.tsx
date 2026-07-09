"use client";

import Link from "next/link";
import { StatusBadge } from "@/components/task/status-badge";
import { PriorityBadge } from "@/components/task/priority-badge";
import { DueDateChip } from "@/components/task/due-date-chip";
import { useFormattedDate } from "@/lib/date/useFormattedDate";

export type TaskCardData = {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  priority: string;
  dueDate: string | null;
  assignee?: { displayName: string; avatarUrl?: string | null } | null;
  projectName?: string;
  tags?: { id: string; name: string }[];
  subtaskCount?: number;
  subtaskDone?: number;
};

type TaskCardProps = {
  task: TaskCardData;
  variant: "compact" | "list";
  onDelete?: ((_taskId: string) => void) | undefined;
  showDelete?: boolean | undefined;
  showProject?: boolean | undefined;
};

const STATUS_BORDER: Record<string, string> = {
  open: "border-s-info",
  in_progress: "border-s-warning",
  done: "border-s-success",
  cancelled: "border-s-fg-subtle",
};

export function TaskCard({ task, variant, onDelete, showDelete, showProject }: TaskCardProps) {
  const { shortDate } = useFormattedDate();

  if (variant === "compact") {
    return (
      <div className={`relative group overflow-hidden min-w-0 w-full ${STATUS_BORDER[task.status] ?? "border-s-info"}`}>
        {showDelete && onDelete && (
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(task.id); }}
            className="absolute top-1.5 left-1.5 z-10 opacity-0 group-hover:opacity-100 text-fg-tertiary hover:text-destructive p-0.5 rounded transition-opacity"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
          </button>
        )}
        <Link href={`/tasks/${task.id}`} className="block overflow-hidden max-w-full">
          <p className="text-sm font-medium text-fg-primary mb-1.5 leading-snug hover:text-accent whitespace-nowrap overflow-hidden text-ellipsis max-w-full block">
            {task.title}
          </p>
        </Link>

        {/* Status + Priority row */}
        <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
          <StatusBadge status={task.status as "open" | "in_progress" | "done" | "cancelled"} />
          <PriorityBadge priority={task.priority as "low" | "med" | "high" | "urgent"} />
          <DueDateChip dueDate={task.dueDate} isCompleted={task.status === "done"} />
        </div>

        {/* Description snippet */}
        {task.description && (
          <p className="text-[11px] text-fg-muted line-clamp-2 mb-1.5 leading-relaxed">
            {task.description.replace(/<[^>]+>/g, "").slice(0, 120)}
          </p>
        )}

        {/* Tags */}
        {task.tags && task.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-1.5">
            {task.tags.slice(0, 3).map((tag) => (
              <span key={tag.id} className="text-[10px] px-1.5 py-0.5 rounded bg-accent/10 text-accent">
                {tag.name}
              </span>
            ))}
            {task.tags.length > 3 && (
              <span className="text-[10px] text-fg-muted">+{task.tags.length - 3}</span>
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
            <span className="text-[10px] text-fg-muted">{task.subtaskDone ?? 0}/{task.subtaskCount}</span>
          </div>
        )}

        {/* Footer: project + assignee */}
        <div className="flex items-center justify-between mt-1">
          {showProject && task.projectName && (
            <span className="text-[10px] text-fg-muted truncate max-w-[60%]">{task.projectName}</span>
          )}
          {task.assignee && (
            <span
              className={`text-[10px] text-fg-muted hidden sm:inline truncate max-w-[120px] ${showProject ? "ms-auto" : ""}`}
            >
              {task.assignee.displayName}
            </span>
          )}
        </div>
      </div>
    );
  }

  // variant === "list"
  return (
    <Link
      href={`/tasks/${task.id}`}
      className="flex items-center gap-3 p-3 rounded-xl border border-border-primary bg-bg-surface hover:border-border-strong transition-colors"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <StatusBadge status={task.status as "open" | "in_progress" | "done" | "cancelled"} />
          <span className="text-sm font-medium text-fg-primary truncate">{task.title}</span>
        </div>

        {/* Tags + description row */}
        <div className="flex items-center gap-2 mt-1">
          {task.tags && task.tags.length > 0 && (
            <div className="flex gap-1">
              {task.tags.slice(0, 3).map((tag) => (
                <span key={tag.id} className="text-[10px] px-1.5 py-0.5 rounded bg-accent/10 text-accent">
                  {tag.name}
                </span>
              ))}
            </div>
          )}
          {task.description && (
            <span className="text-[11px] text-fg-muted truncate hidden sm:inline">
              {task.description.replace(/<[^>]+>/g, "").slice(0, 80)}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <PriorityBadge priority={task.priority as "low" | "med" | "high" | "urgent"} />
        {task.dueDate && (
          <span className="text-xs text-fg-muted">{shortDate(task.dueDate)}</span>
        )}
        {task.subtaskCount != null && task.subtaskCount > 0 && (
          <span className="text-[10px] text-fg-muted">{task.subtaskDone ?? 0}/{task.subtaskCount}</span>
        )}
        {showProject && task.projectName && (
          <span className="text-[10px] text-fg-muted bg-bg-secondary px-1.5 py-0.5 rounded hidden sm:inline">{task.projectName}</span>
        )}
        {task.assignee && (
          <span className="text-[10px] text-fg-muted hidden md:inline truncate max-w-[120px]">
            {task.assignee.displayName}
          </span>
        )}
      </div>
    </Link>
  );
}

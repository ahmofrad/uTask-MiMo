"use client";

import Link from "next/link";
import { cn } from "@/lib/cn";
import { PriorityBadge } from "@/components/task/priority-badge";
import { StatusBadge } from "@/components/task/status-badge";
import { DueDateChip } from "@/components/task/due-date-chip";
import { AssigneeStack, type AssigneeUser } from "@/components/task/assignee-stack";

type TaskRowProps = {
  id: string;
  title: string;
  status: "open" | "in_progress" | "done" | "cancelled";
  priority: "low" | "med" | "high" | "urgent";
  dueDate: string | null;
  assignees?: AssigneeUser[];
  projectName?: string;
  isSelected?: boolean;
  onSelect?: (_id: string) => void;
  className?: string;
};

export function TaskRow({
  id, title, status, priority, dueDate, assignees, projectName,
  isSelected, onSelect, className,
}: TaskRowProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-lg border transition-colors",
        "hover:bg-bg-surface-2 cursor-pointer",
        isSelected
          ? "bg-accent-bg border-s-2 border-accent"
          : "border-border bg-bg-surface",
        className,
      )}
    >
      {onSelect && (
        <input
          type="checkbox"
          checked={!!isSelected}
          onChange={() => onSelect(id)}
          className="rounded border-border text-accent shrink-0"
        />
      )}
      <Link href={`/tasks/${id}`} className="flex-1 flex items-center gap-3 min-w-0">
        <span
          className={cn(
            "flex-1 text-sm truncate",
            status === "done" && "line-through text-fg-muted",
          )}
        >
          {title}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          <StatusBadge status={status} />
          <PriorityBadge priority={priority} />
          <DueDateChip dueDate={dueDate} isCompleted={status === "done"} />
          <AssigneeStack assignees={assignees ?? []} size="sm" />
          {projectName && (
            <span className="text-xs text-fg-muted">{projectName}</span>
          )}
        </div>
      </Link>
    </div>
  );
}

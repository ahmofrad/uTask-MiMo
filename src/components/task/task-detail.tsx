"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { StatusBadge } from "@/components/task/status-badge";
import { PriorityBadge } from "@/components/task/priority-badge";
import { DueDateChip } from "@/components/task/due-date-chip";
import { MemberAvatar } from "@/components/task/member-avatar";
import { CommentThread } from "@/components/comment/comment-thread";
import { AuditTimeline, type AuditEvent } from "@/components/audit/audit-timeline";

type TaskData = {
  id: string;
  title: string;
  description?: string | null;
  status: "open" | "in_progress" | "done" | "cancelled";
  priority: "none" | "low" | "medium" | "high" | "urgent";
  dueDate: string | null;
  estimatedHours?: number | null;
  spentHours?: number | null;
  assignee?: { id: string; displayName: string; avatarUrl?: string | null } | null;
  reporter?: { id: string; displayName: string } | null;
  project?: { id: string; name: string } | null;
  tags?: { tag: { id: string; name: string } }[];
  customFields?: Record<string, unknown>;
};

type TaskDetailProps = {
  task: TaskData;
  onUpdate?: (_updates: Partial<TaskData>) => Promise<void>;
  onAddComment?: (_body: string) => Promise<void>;
  auditEvents?: AuditEvent[];
  className?: string;
};

export function TaskDetail({ task, onUpdate, onAddComment, auditEvents, className }: TaskDetailProps) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(task.title);

  const handleSaveTitle = async () => {
    if (!title.trim() || title === task.title) return;
    await onUpdate?.({ title: title.trim() });
    setEditing(false);
  };

  return (
    <div className={cn("max-w-3xl mx-auto space-y-6", className)}>
      {/* Title */}
      <div>
        {editing ? (
          <div className="flex gap-2">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="flex-1 text-2xl font-bold bg-transparent border-b-2 border-accent text-fg outline-none"
              autoFocus
              onBlur={handleSaveTitle}
              onKeyDown={(e) => { if (e.key === "Enter") handleSaveTitle(); if (e.key === "Escape") { setEditing(false); setTitle(task.title); } }}
            />
          </div>
        ) : (
          <h1
            className="text-2xl font-bold text-fg cursor-pointer hover:text-accent transition-colors"
            onClick={() => setEditing(true)}
          >
            {task.title}
          </h1>
        )}
      </div>

      {/* Meta row */}
      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge status={task.status} />
        <PriorityBadge priority={task.priority} />
        <DueDateChip dueDate={task.dueDate} isCompleted={task.status === "done"} />
        {task.project && (
          <span className="text-sm text-fg-muted bg-bg-surface-2 px-2 py-0.5 rounded-md">
            {task.project.name}
          </span>
        )}
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Main column */}
        <div className="md:col-span-2 space-y-6">
          {/* Description */}
          {task.description && (
            <div>
              <h3 className="text-sm font-medium text-fg mb-2">Description</h3>
              <p className="text-sm text-fg-muted whitespace-pre-wrap">{task.description}</p>
            </div>
          )}

          {/* Comments */}
          {onAddComment && (
            <div>
              <h3 className="text-sm font-medium text-fg mb-3">Comments</h3>
              <CommentThread
                comments={[]}
                onAdd={onAddComment}
              />
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Assignee */}
          <div>
            <h4 className="text-xs text-fg-muted font-medium mb-1">Assignee</h4>
            {task.assignee ? (
              <MemberAvatar
                displayName={task.assignee.displayName}
                avatarUrl={task.assignee.avatarUrl}
                size="sm"
              />
            ) : (
              <p className="text-sm text-fg-subtle">Unassigned</p>
            )}
          </div>

          {/* Reporter */}
          {task.reporter && (
            <div>
              <h4 className="text-xs text-fg-muted font-medium mb-1">Reporter</h4>
              <p className="text-sm text-fg">{task.reporter.displayName}</p>
            </div>
          )}

          {/* Estimated / Spent hours */}
          {task.estimatedHours != null && (
            <div>
              <h4 className="text-xs text-fg-muted font-medium mb-1">Estimated</h4>
              <p className="text-sm text-fg">{task.estimatedHours}h</p>
            </div>
          )}
          {task.spentHours != null && (
            <div>
              <h4 className="text-xs text-fg-muted font-medium mb-1">Spent</h4>
              <p className="text-sm text-fg">{task.spentHours}h</p>
            </div>
          )}

          {/* Tags */}
          {task.tags && task.tags.length > 0 && (
            <div>
              <h4 className="text-xs text-fg-muted font-medium mb-1">Tags</h4>
              <div className="flex flex-wrap gap-1">
                {task.tags.map((t) => (
                  <span key={t.tag.id} className="text-xs px-1.5 py-0.5 rounded-full bg-accent-bg text-accent border border-accent/20">
                    {t.tag.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Audit timeline */}
      {auditEvents && auditEvents.length > 0 && (
        <div className="border-t border-border pt-6">
          <h3 className="text-sm font-medium text-fg mb-3">Activity</h3>
          <AuditTimeline events={auditEvents} />
        </div>
      )}
    </div>
  );
}

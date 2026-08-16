"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { useOptimisticTasks, type Task } from "@/hooks/use-optimistic-task";
import { BulkActionsBar } from "@/components/task/bulk-actions";
import { TaskForm } from "@/components/task/task-form";
import { Dialog } from "@/components/ui/dialog";
import { apiFetch } from "@/lib/api-fetch";
import { AssigneeStack } from "@/components/task/assignee-stack";
import { StatusBadge } from "@/components/task/status-badge";
import { PriorityBadge } from "@/components/task/priority-badge";
import { DueDateChip } from "@/components/task/due-date-chip";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { useTranslations } from "next-intl";

export function TaskList({ initialTasks }: { initialTasks: Task[] }) {
  const t = useTranslations();
  const { tasks, toggleComplete, softDelete } = useOptimisticTasks(initialTasks);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const { addToast } = useToast();

  const refresh = useCallback(() => {
    window.location.reload();
  }, []);

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleDelete(taskId: string) {
    const undo = await softDelete(taskId);
    addToast({
      message: t("task.taskDeletedToast"),
      action: { label: t("common.undo"), onClick: undo },
    });
  }

  async function handleUpdate(data: Record<string, unknown>) {
    if (!editingTask) return;
    const res = await apiFetch(`/api/v1/tasks/${editingTask.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      window.location.reload();
    }
  }

  if (tasks.length === 0) {
    return (
      <EmptyState
        icon="List"
        title={t("task.noTasks")}
        description={t("task.noTasksDescription")}
        className="py-10"
      />
    );
  }

  return (
    <div className="space-y-4">
      <BulkActionsBar
        selectedIds={Array.from(selectedIds)}
        onClear={() => setSelectedIds(new Set())}
        onRefresh={refresh}
      />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {tasks.map((task) => (
          <div
            key={task.id}
            className="relative flex flex-col gap-2 p-4 rounded-xl border border-border-primary bg-bg-surface hover:border-border-strong transition-colors group"
          >
            {/* Top row: checkbox, status, priority, actions */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selectedIds.has(task.id)}
                  onChange={() => toggleSelect(task.id)}
                  className="rounded border-border-primary text-accent shrink-0"
                />
                <button
                  onClick={() => toggleComplete(task.id)}
                  className={`shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${
                    task.status === "done"
                      ? "bg-accent border-accent text-fg-inverse"
                      : "border-border-primary hover:border-accent"
                  }`}
                >
                  {task.status === "done" && (
                    <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
                <StatusBadge status={task.status as "open" | "in_progress" | "done" | "cancelled"} />
                <PriorityBadge priority={task.priority as "low" | "med" | "high" | "urgent"} />
              </div>
              <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                <button
                  onClick={() => setEditingTask(task)}
                  className="text-fg-tertiary hover:text-accent p-1 rounded transition-colors"
                  aria-label={t("common.edit")}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button
                  onClick={() => handleDelete(task.id)}
                  className="text-fg-tertiary hover:text-destructive p-1 rounded transition-colors"
                  aria-label={t("task.deleteTask")}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Title */}
            <Link
              href={`/tasks/${task.id}`}
              className={`text-sm font-medium leading-snug hover:text-accent transition-colors ${
                task.status === "done" ? "line-through text-fg-tertiary" : "text-fg-primary"
              }`}
            >
              {task.title}
            </Link>

            {/* Bottom row: due date + assignees */}
            <div className="flex items-center justify-between mt-auto pt-1">
              <DueDateChip dueDate={task.dueDate} isCompleted={task.status === "done"} />
              <AssigneeStack assignees={task.assignees} size="sm" />
            </div>
          </div>
        ))}
      </div>

      {/* Edit Modal */}
      {editingTask && (
        <Dialog
          open
          onClose={() => setEditingTask(null)}
          title={`${t("common.edit")}: ${editingTask.title}`}
          className="max-w-lg max-h-[90vh]"
        >
          <div className="overflow-y-auto">
            <TaskForm
              projectId={editingTask.projectId}
              initialData={{
                title: editingTask.title,
                status: editingTask.status,
                priority: editingTask.priority,
                dueDate: editingTask.dueDate,
                assigneeIds: editingTask.assignees.map((a) => a.id),
              }}
              onSubmit={handleUpdate}
              onCancel={() => setEditingTask(null)}
            />
          </div>
        </Dialog>
      )}
    </div>
  );
}

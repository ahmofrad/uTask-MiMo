"use client";

import { useState, useCallback } from "react";
import { useOptimisticTasks, type Task } from "@/hooks/use-optimistic-task";
import { BulkActionsBar } from "@/components/task/bulk-actions";
import { useToast } from "@/components/ui/toast";

export function TaskList({ initialTasks }: { initialTasks: Task[] }) {
  const { tasks, toggleComplete, softDelete } = useOptimisticTasks(initialTasks);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
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
      message: "Task deleted",
      action: { label: "Undo", onClick: undo },
    });
  }

  if (tasks.length === 0) {
    return <p className="text-fg-tertiary text-sm py-8 text-center">No tasks</p>;
  }

  return (
    <div className="space-y-2">
      <BulkActionsBar
        selectedIds={Array.from(selectedIds)}
        onClear={() => setSelectedIds(new Set())}
        onRefresh={refresh}
      />
      <div className="space-y-1">
        {tasks.map((task) => (
          <div
            key={task.id}
            className="flex items-center gap-3 px-3 py-2 rounded-lg border border-border-primary bg-bg-primary hover:bg-bg-secondary group"
          >
            <input
              type="checkbox"
              checked={selectedIds.has(task.id)}
              onChange={() => toggleSelect(task.id)}
              className="rounded border-border-primary text-accent shrink-0"
            />
            <button
              onClick={() => toggleComplete(task.id)}
              className={`shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                task.status === "done"
                  ? "bg-accent border-accent text-fg-inverse"
                  : "border-border-primary hover:border-accent"
              }`}
            >
              {task.status === "done" && (
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
            <span
              className={`flex-1 text-sm truncate ${
                task.status === "done" ? "line-through text-fg-tertiary" : "text-fg-primary"
              }`}
            >
              {task.title}
            </span>
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${
              task.status === "done" ? "text-fg-tertiary bg-bg-secondary" :
              task.status === "in_progress" ? "text-accent bg-accent/10" :
              "text-fg-secondary bg-bg-secondary"
            }`}>
              {task.status}
            </span>
            <button
              onClick={() => handleDelete(task.id)}
              className="opacity-0 group-hover:opacity-100 text-fg-tertiary hover:text-destructive-fg text-xs transition-opacity"
              aria-label="Delete task"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

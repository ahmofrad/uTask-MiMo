"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api-fetch";
import { TaskCard, type TaskCardData } from "@/components/task/task-card";

export type BoardTask = TaskCardData & {
  assigneeId: string | null;
};

type BoardProps = {
  initialTasks: BoardTask[];
  projectId: string;
  onDelete?: (_taskId: string) => void;
  showProject?: boolean;
};

const COLUMNS = [
  { key: "open", color: "bg-info-bg border-info/30" },
  { key: "in_progress", color: "bg-warning-bg border-warning/30" },
  { key: "done", color: "bg-success-bg border-success/30" },
  { key: "cancelled", color: "bg-bg-surface-2 border-border" },
];

export function Board({ initialTasks, projectId: _projectId, onDelete, showProject }: BoardProps) {
  const t = useTranslations("task");
  const [tasks, setTasks] = useState(initialTasks);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);

  useEffect(() => {
    setTasks(initialTasks);
  }, [initialTasks]);

  async function moveTask(taskId: string, newStatus: string) {
    setTasks((prev) =>
      prev.map((task) => (task.id === taskId ? { ...task, status: newStatus } : task))
    );

    try {
      const res = await apiFetch(`/api/v1/tasks/${taskId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        setTasks(initialTasks);
      }
    } catch {
      setTasks(initialTasks);
    }
  }

  function handleDragStart(e: React.DragEvent, taskId: string) {
    e.dataTransfer.setData("text/plain", taskId);
    e.dataTransfer.effectAllowed = "move";
    setDraggedId(taskId);
  }

  function handleDragEnd() {
    setDraggedId(null);
    setDragOverCol(null);
  }

  function handleDragOver(e: React.DragEvent, colKey: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverCol(colKey);
  }

  function handleDrop(e: React.DragEvent, targetStatus: string) {
    e.preventDefault();
    const taskId = e.dataTransfer.getData("text/plain") || draggedId;
    const task = tasks.find((tk) => tk.id === taskId);
    if (taskId && task && task.status !== targetStatus) {
      moveTask(taskId, targetStatus);
    }
    setDraggedId(null);
    setDragOverCol(null);
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {COLUMNS.map((col) => {
        const colTasks = tasks.filter((task) => task.status === col.key);
        return (
          <div
            key={col.key}
            className={`w-72 shrink-0 rounded-xl border-2 transition-colors ${
              dragOverCol === col.key ? "border-accent" : "border-transparent"
            }`}
            onDragOver={(e) => handleDragOver(e, col.key)}
            onDrop={(e) => handleDrop(e, col.key)}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                setDragOverCol(null);
              }
            }}
          >
            <div className={`flex items-center justify-between px-3 py-2 rounded-t-xl ${col.color}`}>
              <span className="text-sm font-semibold text-fg-primary">{t(`status.${col.key}`)}</span>
              <span className="text-xs font-medium text-fg-muted bg-white/20 px-2 py-0.5 rounded-full">
                {colTasks.length}
              </span>
            </div>
            <div className="space-y-2 p-2 min-h-[200px]" onDragOver={(e) => e.preventDefault()}>
              {colTasks.map((task) => (
                <div
                  key={task.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, task.id)}
                  onDragEnd={handleDragEnd}
                  className={`p-3 bg-bg-primary border border-border-primary rounded-lg cursor-grab active:cursor-grabbing transition-all group ${
                    draggedId === task.id ? "opacity-50 rotate-2 shadow-lg" : "hover:border-border-strong hover:shadow-sm"
                  }`}
                >
                  <TaskCard
                    task={task}
                    variant="compact"
                    onDelete={onDelete}
                    showDelete={!!onDelete}
                    showProject={showProject}
                  />
                </div>
              ))}
              {colTasks.length === 0 && (
                <p className="text-xs text-fg-subtle text-center py-8">{t("dropHere")}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

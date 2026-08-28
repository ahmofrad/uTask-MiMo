"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api-fetch";
import { useProjectRealtime, type TaskEventPayload } from "@/hooks/use-project-realtime";
import { TaskCard, type TaskCardData } from "@/components/task/task-card";
import { mapTaskListRow } from "@/lib/tasks/serialize";
import { Menu } from "@/components/ui/menu";
import { Icon } from "@/components/icons/icon";
import { useBoardDnd } from "./use-board-dnd";

export type BoardTask = TaskCardData;

type BoardProps = {
  initialTasks: BoardTask[];
  projectId: string;
  projectIds?: string[];
  showProject?: boolean;
  currentUserId: string | undefined;
  includeTask?: (_task: BoardTask) => boolean;
};

const COLUMNS = [
  { key: "open", color: "bg-info-bg border-info/30" },
  { key: "in_progress", color: "bg-warning-bg border-warning/30" },
  { key: "pending_approval", color: "bg-tone-violet-bg border-tone-violet/30" },
  { key: "done", color: "bg-success-bg border-success/30" },
  { key: "cancelled", color: "bg-bg-surface-2 border-border" },
];

type BoardSortKey = "title" | "priority" | "dueDate";
const PRIORITY_ORDER: Record<string, number> = { urgent: 0, high: 1, med: 2, low: 3 };

function sortBoardTasks(tasks: BoardTask[], field: BoardSortKey): BoardTask[] {
  return [...tasks].sort((a, b) => {
    switch (field) {
      case "title":
        return a.title.localeCompare(b.title);
      case "priority":
        return (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99);
      case "dueDate": {
        const da = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
        const db = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
        return da - db;
      }
      default:
        return 0;
    }
  });
}

export function Board({
  initialTasks,
  projectId,
  projectIds,
  showProject,
  currentUserId,
  includeTask,
}: BoardProps) {
  const t = useTranslations("task");
  const [boardSort, setBoardSort] = useState<BoardSortKey>("dueDate");
  const includeTaskRef = useRef(includeTask);
  includeTaskRef.current = includeTask;

  const {
    tasks,
    setTasks,
    draggedId,
    dragOverCol,
    moveTask,
    handleDragStart,
    handleDragEnd,
    handleDragOver,
    handleDrop,
  } = useBoardDnd({ initialTasks });

  useEffect(() => {
    setTasks(initialTasks);
  }, [initialTasks, setTasks]);

  const refreshProject = useCallback(async (changedProjectId: string) => {
    try {
      const res = await apiFetch(`/api/v1/tasks?projectId=${changedProjectId}&limit=200`);
      if (!res.ok) return;
      const body = (await res.json()) as { data?: Record<string, unknown>[] };
      const rows = body.data ?? [];
      setTasks((prev) => {
        const next = new Map(prev.map((task) => [task.id, task]));
        for (const row of rows) {
          const mapped = mapTaskListRow(row) as BoardTask;
          if (includeTaskRef.current && !includeTaskRef.current(mapped)) {
            next.delete(mapped.id);
            continue;
          }
          const existing = next.get(mapped.id);
          next.set(mapped.id, {
            ...existing,
            ...mapped,
            subtaskDone: existing?.subtaskDone ?? 0,
            blockedBy: existing?.blockedBy ?? [],
            ...(existing?.projectName ? { projectName: existing.projectName } : {}),
          });
        }
        return Array.from(next.values());
      });
    } catch {
      // Keep the current board on network errors.
    }
  }, [setTasks]);

  useProjectRealtime(
    projectIds ?? (projectId ? [projectId] : []),
    (event, data: TaskEventPayload) => {
      const changedProjectId = data.projectId ?? projectId;
      if (!changedProjectId) return;
      if (event === "task.deleted") {
        if (data.id) {
          setTasks((prev) => prev.filter((task) => task.id !== data.id));
        }
        return;
      }
      void refreshProject(changedProjectId);
    },
    currentUserId,
  );

  return (
    <div className="flex gap-4 overflow-x-auto pb-4" tabIndex={0}>
      {COLUMNS.map((col) => {
        const colTasks = sortBoardTasks(tasks.filter((task) => task.status === col.key), boardSort);
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
                handleDragEnd();
              }
            }}
          >
            <div
              className={`flex items-center justify-between px-3 py-2 rounded-t-xl ${col.color}`}
            >
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-semibold text-fg-primary">
                  {t(`status.${col.key}`)}
                </span>
                <span className="text-xs font-medium text-fg-muted bg-fg-inverse/20 px-2 py-0.5 rounded-full">
                  {colTasks.length}
                </span>
              </div>
              {col.key === COLUMNS[0]!.key && (
                <select
                  value={boardSort}
                  onChange={(e) => setBoardSort(e.target.value as BoardSortKey)}
                  className="text-xs bg-transparent text-fg-muted border-none cursor-pointer focus:outline-none"
                  aria-label={t("sortBy")}
                >
                  <option value="dueDate">{t("sort.dueDate")}</option>
                  <option value="priority">{t("sort.priority")}</option>
                  <option value="title">{t("sort.title")}</option>
                </select>
              )}
            </div>
            <div className="space-y-2 p-2 min-h-[200px]" onDragOver={(e) => e.preventDefault()}>
              {colTasks.map((task) => (
                <div
                  key={task.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, task.id)}
                  onDragEnd={handleDragEnd}
                  className={`relative p-3 bg-bg-primary border border-border-primary rounded-lg cursor-grab active:cursor-grabbing transition-[opacity,transform,box-shadow] group ${
                    draggedId === task.id
                      ? "opacity-50 rotate-2 shadow-lg"
                      : "hover:border-border-strong hover:shadow-sm"
                  }`}
                >
                  <div
                    className="absolute top-1.5 end-1.5 z-10"
                    onDragStart={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                  >
                    <Menu
                      label={t("move")}
                      items={COLUMNS.filter((col) => col.key !== task.status).map((col) => ({
                        id: col.key,
                        label: t(`status.${col.key}`),
                        onSelect: () => moveTask(task.id, col.key),
                      }))}
                      triggerClassName="p-1 rounded-md opacity-0 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-1 focus-visible:ring-accent"
                    >
                      <Icon name="GripVertical" size={14} aria-hidden />
                      <span className="sr-only">{t("move")}</span>
                    </Menu>
                  </div>
                  <TaskCard task={task} variant="compact" showProject={showProject} />
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

import { useState, useCallback } from "react";
import { apiFetch } from "@/lib/api-fetch";
import type { BoardTask } from "./board";

export type UseBoardDndOptions = {
  initialTasks: BoardTask[];
  onMoveOptimistic?: (taskId: string, newStatus: string) => void;
  onMoveRevert?: (taskId: string, oldStatus: string) => void;
};

export type UseBoardDndReturn = {
  tasks: BoardTask[];
  setTasks: React.Dispatch<React.SetStateAction<BoardTask[]>>;
  draggedId: string | null;
  dragOverCol: string | null;
  moveTask: (taskId: string, newStatus: string) => void;
  handleDragStart: (e: React.DragEvent, taskId: string) => void;
  handleDragEnd: () => void;
  handleDragOver: (e: React.DragEvent, colKey: string) => void;
  handleDrop: (e: React.DragEvent, targetStatus: string) => void;
};

export function useBoardDnd({ initialTasks }: UseBoardDndOptions): UseBoardDndReturn {
  const [tasks, setTasks] = useState(initialTasks);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);

  const moveTask = useCallback(async (taskId: string, newStatus: string) => {
    setTasks((prev) =>
      prev.map((task) => (task.id === taskId ? { ...task, status: newStatus } : task)),
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
  }, [initialTasks]);

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

  return {
    tasks,
    setTasks,
    draggedId,
    dragOverCol,
    moveTask,
    handleDragStart,
    handleDragEnd,
    handleDragOver,
    handleDrop,
  };
}

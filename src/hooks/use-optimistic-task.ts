"use client";

import { useState, useCallback } from "react";
import type { AssigneeUser } from "@/components/task/assignee-stack";

export type Task = {
  id: string;
  title: string;
  status: string;
  priority: string;
  projectId: string;
  assignees: AssigneeUser[];
  dueDate: string | null;
  orderIndex: number;
};

export function useOptimisticTasks(initialTasks: Task[]) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);

  const toggleComplete = useCallback(async (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    const newStatus = task.status === "done" ? "open" : "done";

    // Optimistic update
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)),
    );

    try {
      const res = await fetch(`/api/v1/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("Failed");
    } catch {
      // Rollback
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status: task.status } : t)),
      );
    }
  }, [tasks]);

  const reorder = useCallback(async (taskId: string, projectId: string, newIndex: number) => {
    const prevTasks = [...tasks];

    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId ? { ...t, orderIndex: newIndex } : t,
      ),
    );

    try {
      const allIds = prevTasks.map((t) => t.id);
      const res = await fetch("/api/v1/tasks/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, taskIds: allIds }),
      });
      if (!res.ok) throw new Error("Failed");
    } catch {
      setTasks(prevTasks);
    }
  }, [tasks]);

  const softDelete = useCallback(async (taskId: string): Promise<() => void> => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return () => {};

    setTasks((prev) => prev.filter((t) => t.id !== taskId));

    try {
      const res = await fetch(`/api/v1/tasks/${taskId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
    } catch {
      setTasks((prev) => [...prev, task].sort((a, b) => a.orderIndex - b.orderIndex));
      return () => {};
    }

    return async () => {
      setTasks((prev) => [...prev, task].sort((a, b) => a.orderIndex - b.orderIndex));
      try {
        await fetch(`/api/v1/tasks/${taskId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deletedAt: null }),
        });
      } catch {
        // ignore
      }
    };
  }, [tasks]);

  return { tasks, setTasks, toggleComplete, reorder, softDelete };
}

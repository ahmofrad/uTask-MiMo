"use client";

import { useCallback, useState } from "react";
import { apiFetch } from "@/lib/api-fetch";
import type { TaskData } from "./task-mutations/types";

type Options = {
  taskId: string;
  initialSubtasks: TaskData["subtasks"];
};

/** Subtask list + toggle/add/rename/delete for the task detail page. */
export function useTaskSubtasks({ taskId, initialSubtasks }: Options) {
  const [subtasks, setSubtasks] = useState<TaskData["subtasks"]>(initialSubtasks);

  const toggleSubtask = useCallback(async (id: string, status: string) => {
    setSubtasks((prev) => prev.map((st) => st.id === id ? { ...st, status } : st));
    await apiFetch(`/api/v1/tasks/${taskId}/subtasks/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
  }, [taskId]);

  const addSubtask = useCallback(async (title: string) => {
    const res = await apiFetch(`/api/v1/tasks/${taskId}/subtasks`, {
      method: "POST",
      body: JSON.stringify({ title }),
    });
    if (res.ok) {
      const result = await res.json();
      setSubtasks((prev) => [...prev, result.data]);
    }
  }, [taskId]);

  const renameSubtask = useCallback(async (id: string, title: string) => {
    setSubtasks((prev) => prev.map((st) => st.id === id ? { ...st, title } : st));
    await apiFetch(`/api/v1/tasks/${taskId}/subtasks/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ title }),
    });
  }, [taskId]);

  const deleteSubtask = useCallback(async (id: string) => {
    setSubtasks((prev) => prev.filter((st) => st.id !== id));
    await apiFetch(`/api/v1/tasks/${taskId}/subtasks/${id}`, { method: "DELETE" });
  }, [taskId]);

  return { subtasks, toggleSubtask, addSubtask, renameSubtask, deleteSubtask };
}
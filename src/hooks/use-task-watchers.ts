"use client";

import { useCallback, useState } from "react";
import { apiFetch } from "@/lib/api-fetch";
import type { WatcherData, ProjectMember } from "./task-mutations/types";

type Options = {
  taskId: string;
  initialWatchers: WatcherData[];
  currentUserId: string;
  projectMembers: ProjectMember[];
};

/**
 * Watcher list + toggle/add/remove for the task detail page. `isWatching` is
 * derived from the watcher list so it never drifts from server state.
 */
export function useTaskWatchers({ taskId, initialWatchers, currentUserId, projectMembers }: Options) {
  const [watchers, setWatchers] = useState<WatcherData[]>(initialWatchers);

  const isWatching = watchers.some((w) => w.id === currentUserId);

  const toggleWatch = useCallback(async () => {
    if (isWatching) {
      const res = await apiFetch(`/api/v1/watchers/tasks/${taskId}`, { method: "DELETE" });
      if (res.ok) setWatchers((prev) => prev.filter((w) => w.id !== currentUserId));
    } else {
      const res = await apiFetch(`/api/v1/watchers/tasks/${taskId}`, { method: "POST" });
      if (res.ok) {
        setWatchers((prev) => [
          ...prev,
          { id: currentUserId, displayName: "", addedAt: new Date().toISOString() },
        ]);
      }
    }
  }, [currentUserId, isWatching, taskId]);

  const addWatcher = useCallback(async (userId: string) => {
    const res = await apiFetch(`/api/v1/watchers/tasks/${taskId}/add?userId=${userId}`, { method: "POST" });
    if (res.ok) {
      const member = projectMembers.find((m) => m.id === userId);
      setWatchers((prev) => [
        ...prev,
        { id: userId, displayName: member?.displayName ?? "", avatarUrl: member?.avatarUrl ?? null, addedAt: new Date().toISOString() },
      ]);
    }
  }, [projectMembers, taskId]);

  const removeWatcher = useCallback(async (userId: string) => {
    const res = await apiFetch(`/api/v1/watchers/tasks/${taskId}/remove?userId=${userId}`, { method: "DELETE" });
    if (res.ok) {
      setWatchers((prev) => prev.filter((x) => x.id !== userId));
    }
  }, [taskId]);

  return { watchers, isWatching, toggleWatch, addWatcher, removeWatcher };
}
"use client";

import { useEffect, useRef } from "react";
import { joinProject, leaveProject, getSocket } from "@/lib/realtime/client";

const TASK_EVENTS = ["task.created", "task.updated", "task.deleted"] as const;

type TaskEventPayload = {
  id?: string;
  actorUserId?: string;
};

/**
 * Subscribes to realtime task events for the given project rooms and calls
 * `onChange` whenever another user creates, updates, or deletes a task. Used
 * by views that render server-derived data (e.g. the Gantt report) so edits
 * made by other users appear without a manual reload. Events caused by the
 * current user's own mutations are ignored — those already reflect
 * optimistically in the UI.
 */
export function useProjectRealtime(
  projectIds: readonly string[],
  onChange: () => void,
  currentUserId?: string,
) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const projectIdsKey = projectIds.join(",");

  useEffect(() => {
    const ids = projectIdsKey ? projectIdsKey.split(",") : [];
    if (ids.length === 0) return;

    for (const projectId of ids) joinProject(projectId);

    const socket = getSocket();
    const handler = (_event: string, data: TaskEventPayload) => {
      if (currentUserId && data.actorUserId === currentUserId) return;
      onChangeRef.current();
    };
    for (const event of TASK_EVENTS) socket.on(event, handler);

    return () => {
      for (const projectId of ids) leaveProject(projectId);
      for (const event of TASK_EVENTS) socket.off(event, handler);
    };
  }, [projectIdsKey, currentUserId]);
}

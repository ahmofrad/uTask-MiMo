"use client";

import { useEffect, useRef } from "react";
import { joinProject, leaveProject, getSocket } from "@/lib/realtime/client";

const TASK_EVENTS = ["task.created", "task.updated", "task.deleted"] as const;

export type TaskEventPayload = {
  id?: string;
  projectId?: string;
  actorUserId?: string;
};

export type TaskEvent = (typeof TASK_EVENTS)[number];

// Params are only meaningful to callers; ESLint's no-unused-vars inspects the
// type signature too, so underscore-prefix to satisfy it.
type ProjectRealtimeHandler = (_event: TaskEvent, _data: TaskEventPayload) => void;

/**
 * Subscribes to realtime task events for the given project rooms and calls
 * `onChange(event, data)` whenever another user creates, updates, or deletes
 * a task. Used by views that render task-derived data (Gantt report, board,
 * task lists) so edits made by other users appear without a manual reload.
 * Events caused by the current user's own mutations are ignored — those
 * already reflect optimistically in the UI.
 */
export function useProjectRealtime(
  projectIds: readonly string[],
  onChange: ProjectRealtimeHandler,
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
    // Socket.IO passes only the emitted payload to the listener — not the
    // event name — so bind each event name to its own closure to keep the
    // event available to `onChange`.
    const handlers = TASK_EVENTS.map((event) => {
      const handler = (data: TaskEventPayload) => {
        if (currentUserId && data.actorUserId === currentUserId) return;
        onChangeRef.current(event, data);
      };
      socket.on(event, handler);
      return { event, handler };
    });

    return () => {
      for (const projectId of ids) leaveProject(projectId);
      for (const { event, handler } of handlers) socket.off(event, handler);
    };
  }, [projectIdsKey, currentUserId]);
}

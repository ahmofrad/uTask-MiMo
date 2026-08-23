"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api-fetch";
import { normalizeTaskDate } from "@/lib/date/task-date";
import { computeDuration, addDurationToDate } from "@/lib/date/duration";
import { encodeRecurrenceRule, type RecurrenceRule } from "@/lib/tasks/recurrence";
import { useTaskComments } from "./use-task-comments";
import { useTaskWatchers } from "./use-task-watchers";
import { useTaskSubtasks } from "./use-task-subtasks";
import { useTaskAttachments } from "./use-task-attachments";

export { computeDuration, addDurationToDate } from "@/lib/date/duration";
export type {
  TaskData,
  CustomFieldDef,
  CommentData,
  WatcherData,
  AttachmentData,
  ProjectMember,
  AutoScheduledChange,
  ToastLike,
  TranslateFn,
  UseTaskMutationsOptions,
  ActivityEventForTask,
} from "./task-mutations/types";
export type { RecurrenceRule } from "@/lib/tasks/recurrence";

import type {
  TaskData,
  UseTaskMutationsOptions,
} from "./task-mutations/types";

/**
 * Owns every task-detail mutation and the state it writes to. The page binds
 * controls to the returned handlers and renders the returned state; all fetch
 * + optimistic update + audit refresh + toast side effects concentrate here so
 * the mutation semantics are testable through one interface.
 *
 * The comments / watchers / subtasks / attachments state lives in focused
 * sub-hooks (use-task-comments, use-task-watchers, use-task-subtasks,
 * use-task-attachments); this hook composes them with the core task state.
 */
export function useTaskMutations({
  initialTask,
  initialComments,
  initialWatchers,
  initialAttachments,
  initialSubtasks,
  initialCFValues,
  initialTagIds,
  projectMembers,
  currentUserId,
  onAuditRefresh,
  addToast,
  t,
}: UseTaskMutationsOptions) {
  const router = useRouter();
  const [task, setTask] = useState(initialTask);
  const [taskTagIds, setTaskTagIds] = useState<string[]>(initialTagIds);
  const [cfValues, setCfValues] = useState(initialCFValues);
  const [durationDays, setDurationDays] = useState(() => {
    if (!initialTask.startDate || !initialTask.endDate) return 0;
    const { days } = computeDuration(initialTask.startDate, initialTask.endDate);
    return days;
  });
  const [durationHours, setDurationHours] = useState(() => {
    if (!initialTask.startDate || !initialTask.endDate) return 0;
    const { hours } = computeDuration(initialTask.startDate, initialTask.endDate);
    return hours;
  });
  const [deleted, setDeleted] = useState(false);

  const { comments, addComment, updateComment, deleteComment } = useTaskComments({
    taskId: task.id,
    initialComments,
    t,
  });

  const { watchers, isWatching, toggleWatch, addWatcher, removeWatcher } = useTaskWatchers({
    taskId: task.id,
    initialWatchers,
    currentUserId,
    projectMembers,
  });

  const { subtasks, toggleSubtask, addSubtask, renameSubtask, deleteSubtask } = useTaskSubtasks({
    taskId: task.id,
    initialSubtasks,
  });

  const { attachments, uploadAttachment, deleteAttachment } = useTaskAttachments({
    taskId: task.id,
    initialAttachments,
  });

  const updateTask = useCallback(async (updates: Record<string, unknown>) => {
    const normalizedUpdates = { ...updates };
    for (const field of ["startDate", "endDate", "dueDate"] as const) {
      const value = normalizedUpdates[field];
      if (typeof value === "string" || value === null) {
        normalizedUpdates[field] = normalizeTaskDate(value);
      }
    }
    const res = await apiFetch(`/api/v1/tasks/${task.id}`, {
      method: "PATCH",
      body: JSON.stringify(normalizedUpdates),
    });
    if (!res.ok) throw new Error(t("task.updateFailed"));
    const body = await res.json();
    if (body.data) setTask((prev) => ({ ...prev, ...body.data }));
    // Refresh audit events after mutation
    void onAuditRefresh();

    // If the date change pushed dependent tasks forward, offer to undo it.
    const autoScheduled = (body.data?.autoScheduled as { id: string; title: string; startDate: string | null; dueDate: string | null }[] | undefined) ?? [];
    if (autoScheduled.length > 0) {
      addToast({
        message: t("task.autoScheduledToast", { count: autoScheduled.length }),
        action: {
          label: t("common.undo"),
          onClick: async () => {
            await Promise.allSettled(
              autoScheduled.map((item) =>
                apiFetch(`/api/v1/tasks/${item.id}`, {
                  method: "PATCH",
                  body: JSON.stringify({ startDate: item.startDate, dueDate: item.dueDate }),
                }),
              ),
            );
            void onAuditRefresh();
          },
        },
      });
    }
    return body.data;
  }, [addToast, onAuditRefresh, task.id, t]);

  const handleSaveTitle = useCallback((title: string) => {
    if (!title.trim() || title === task.title) return;
    void updateTask({ title: title.trim() });
  }, [task.title, updateTask]);

  const handleSaveDescription = useCallback((val: string | null) => {
    if (val === task.description) return;
    void updateTask({ description: val });
  }, [task.description, updateTask]);

  const handleStatusChange = useCallback((status: string) => {
    setTask((prev) => ({ ...prev, status: status as TaskData["status"] }));
    void updateTask({ status });
  }, [updateTask]);

  const handlePriorityChange = useCallback((priority: string) => {
    setTask((prev) => ({ ...prev, priority: priority as TaskData["priority"] }));
    void updateTask({ priority });
  }, [updateTask]);

  const handleApprovalConfigChange = useCallback(
    (updates: { requiresApproval?: boolean; approverId?: string | null }) => {
      setTask((prev) => ({ ...prev, ...updates }));
      void updateTask(updates);
    },
    [updateTask],
  );

  const handleRecurrenceChange = useCallback((rule: RecurrenceRule | null) => {
    setTask((prev) => ({ ...prev, recurrenceRule: rule ? encodeRecurrenceRule(rule) : null }));
    void updateTask({ recurrence: rule });
  }, [updateTask]);

  const handleApprove = useCallback(async () => {
    const res = await apiFetch(`/api/v1/tasks/${task.id}/approve`, {
      method: "POST",
      body: JSON.stringify({}),
    });
    if (!res.ok) {
      addToast({ message: t("approval.decisionFailed") });
      return;
    }
    const body = await res.json();
    if (body.data) setTask((prev) => ({ ...prev, ...body.data }));
    void onAuditRefresh();
  }, [addToast, onAuditRefresh, task.id, t]);

  const handleReject = useCallback(
    async (reason: string) => {
      const res = await apiFetch(`/api/v1/tasks/${task.id}/reject`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) {
        addToast({ message: t("approval.decisionFailed") });
        return;
      }
      const body = await res.json();
      if (body.data) setTask((prev) => ({ ...prev, ...body.data }));
      void onAuditRefresh();
    },
    [addToast, onAuditRefresh, task.id, t],
  );

  const handleDelete = useCallback(async () => {
    const res = await apiFetch(`/api/v1/tasks/${task.id}`, { method: "DELETE" });
    if (res.ok) {
      setDeleted(true);
      setTimeout(() => router.push("/"), 2000);
    }
  }, [router, task.id]);

  const handleTagsChange = useCallback(async (ids: string[]) => {
    setTaskTagIds(ids);
    await apiFetch(`/api/v1/tasks/${task.id}`, {
      method: "PATCH",
      body: JSON.stringify({ tagIds: ids }),
    });
  }, [task.id]);

  const handleAssigneeChange = useCallback((ids: string[]) => {
    const next = projectMembers.filter((m) => ids.includes(m.id));
    setTask((prev) => ({ ...prev, assignees: next }));
    void updateTask({ assigneeIds: ids });
  }, [projectMembers, updateTask]);

  const handleGroupChange = useCallback(async (groupId: string | null) => {
    const res = await apiFetch(`/api/v1/tasks/${task.id}`, {
      method: "PATCH",
      body: JSON.stringify({ assigneeGroupId: groupId }),
    });
    if (!res.ok) return;
    // Re-fetch to sync the fanned-out assignee rows from the server.
    const fresh = await apiFetch(`/api/v1/tasks/${task.id}`);
    if (fresh.ok) {
      const body = await fresh.json();
      if (body.data) setTask((prev) => ({ ...prev, ...body.data }));
      void onAuditRefresh();
    }
  }, [onAuditRefresh, task.id]);

  const handleEstimatedChange = useCallback((val: number | null) => {
    setTask((prev) => ({ ...prev, estimatedHours: val }));
    void updateTask({ estimatedHours: val });
  }, [updateTask]);

  const handleSpentChange = useCallback((val: number | null) => {
    setTask((prev) => ({ ...prev, spentHours: val }));
    void updateTask({ spentHours: val });
  }, [updateTask]);

  const handleCustomFieldChange = useCallback(async (key: string, value: unknown) => {
    const prev = { ...cfValues };
    const next = { ...cfValues, [key]: value };
    setCfValues(next);
    try {
      const res = await apiFetch(`/api/v1/tasks/${task.id}`, {
        method: "PATCH",
        body: JSON.stringify({ customFields: { [key]: value } }),
      });
      if (res.ok) {
        const body = await res.json();
        if (body.data?.customFields) {
          setCfValues(body.data.customFields);
        }
      } else {
        setCfValues(prev);
      }
    } catch {
      setCfValues(prev);
    }
  }, [cfValues, task.id]);

  const handleStartDateChange = useCallback((val: string | null) => {
    setTask((prev) => ({ ...prev, startDate: val }));
    if (val && task.endDate) {
      const dur = computeDuration(val, task.endDate);
      setDurationDays(dur.days);
      setDurationHours(dur.hours);
      void updateTask({ startDate: val, endDate: task.endDate });
    } else if (val && (durationDays > 0 || durationHours > 0)) {
      const end = addDurationToDate(val, durationDays, durationHours);
      setTask((prev) => ({ ...prev, endDate: end }));
      void updateTask({ startDate: val, endDate: end });
    } else {
      void updateTask({ startDate: val });
    }
  }, [durationDays, durationHours, task.endDate, updateTask]);

  const handleEndDateChange = useCallback((val: string | null) => {
    setTask((prev) => ({ ...prev, endDate: val }));
    if (val && task.startDate) {
      const dur = computeDuration(task.startDate, val);
      setDurationDays(dur.days);
      setDurationHours(dur.hours);
    }
    void updateTask({ endDate: val });
  }, [task.startDate, updateTask]);

  const handleDurationChange = useCallback((days: number, hours: number) => {
    setDurationDays(days);
    setDurationHours(hours);
    if (task.startDate && (days > 0 || hours > 0)) {
      const end = addDurationToDate(task.startDate, days, hours);
      setTask((prev) => ({ ...prev, endDate: end }));
      void updateTask({ endDate: end });
    }
  }, [task.startDate, updateTask]);

  return {
    task,
    setTask,
    taskTagIds,
    cfValues,
    comments,
    watchers,
    attachments,
    subtasks,
    durationDays,
    durationHours,
    deleted,
    isWatching,
    updateTask,
    handleSaveTitle,
    handleSaveDescription,
    handleStatusChange,
    handlePriorityChange,
    addComment,
    updateComment,
    deleteComment,
    toggleWatch,
    handleDelete,
    handleSubtaskToggle: toggleSubtask,
    handleSubtaskAdd: addSubtask,
    handleSubtaskRename: renameSubtask,
    handleSubtaskDelete: deleteSubtask,
    handleTagsChange,
    handleAttachmentUpload: uploadAttachment,
    handleAttachmentDelete: deleteAttachment,
    handleAssigneeChange,
    handleGroupChange,
    handleEstimatedChange,
    handleSpentChange,
    handleApprovalConfigChange,
    handleRecurrenceChange,
    handleApprove,
    handleReject,
    handleCustomFieldChange,
    handleAddWatcher: addWatcher,
    handleRemoveWatcher: removeWatcher,
    handleStartDateChange,
    handleEndDateChange,
    handleDurationChange,
  };
}
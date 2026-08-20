"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api-fetch";
import { normalizeTaskDate } from "@/lib/date/task-date";
import type { ActivityEvent } from "@/lib/activity/types";

export type TaskData = {
  id: string;
  title: string;
  description?: string | null;
  status: "open" | "in_progress" | "pending_approval" | "done" | "cancelled";
  priority: "low" | "med" | "high" | "urgent";
  startDate: string | null;
  endDate: string | null;
  dueDate: string | null;
  estimatedHours?: number | null;
  spentHours?: number | null;
  requiresApproval?: boolean;
  approverId?: string | null;
  approvalNote?: string | null;
  projectId: string;
  projectName: string;
  assignees: { id: string; displayName: string; avatarUrl?: string | null }[];
  assigneeGroup: { id: string; name: string } | null;
  reporter: { id: string; displayName: string } | null;
  tags: { id: string; name: string }[];
  subtasks: { id: string; title: string; status: string; priority: string; assignees: { id: string; displayName: string; avatarUrl?: string | null }[] }[];
  createdAt: string;
  updatedAt: string;
};

export type CustomFieldDef = {
  id: string;
  key: string;
  name: string;
  type: "text" | "number" | "date" | "select" | "multi_select" | "user" | "checkbox" | "url";
  required: boolean;
  config: Record<string, unknown>;
};

export type CommentData = {
  id: string;
  body: string;
  createdAt: string;
  authorId?: string | undefined;
  author: { displayName: string; avatarUrl?: string | null };
  replies?: { id: string; body: string; createdAt: string; author: { displayName: string; avatarUrl?: string | null } }[];
};

export type WatcherData = {
  id: string;
  displayName: string;
  avatarUrl?: string | null;
  addedAt: string;
};

export type AttachmentData = {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
};

type AutoScheduledChange = {
  id: string;
  title: string;
  startDate: string | null;
  dueDate: string | null;
};

export type ProjectMember = {
  id: string;
  displayName: string;
  avatarUrl?: string | null;
};

export function computeDuration(start: string, end: string): { days: number; hours: number } {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms <= 0) return { days: 0, hours: 0 };
  const totalHours = Math.floor(ms / (1000 * 60 * 60));
  return { days: Math.floor(totalHours / 24), hours: totalHours % 24 };
}

export function addDurationToDate(start: string, days: number, hours: number): string {
  const d = new Date(start);
  d.setDate(d.getDate() + days);
  d.setHours(d.getHours() + hours);
  return d.toISOString();
}

type ToastLike = {
  message: string;
  action?: {
    label: string;
    onClick: () => void;
  };
};

type TranslateFn = (_key: string, _values?: Record<string, string | number | Date>) => string;

export type UseTaskMutationsOptions = {
  initialTask: TaskData;
  initialComments: CommentData[];
  initialWatchers: WatcherData[];
  initialAttachments: AttachmentData[];
  initialSubtasks: TaskData["subtasks"];
  initialCFValues: Record<string, unknown>;
  initialTagIds: string[];
  projectMembers: ProjectMember[];
  currentUserId: string;
  /** Refresh the task activity timeline after a mutation. */
  onAuditRefresh: () => Promise<void>;
  addToast: (_toast: ToastLike) => void;
  t: TranslateFn;
};

/**
 * Owns every task-detail mutation and the state it writes to. The page binds
 * controls to the returned handlers and renders the returned state; all fetch
 * + optimistic update + audit refresh + toast side effects concentrate here so
 * the mutation semantics are testable through one interface.
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
  const [comments, setComments] = useState(initialComments);
  const [watchers, setWatchers] = useState(initialWatchers);
  const [attachments, setAttachments] = useState(initialAttachments);
  const [subtasks, setSubtasks] = useState(initialSubtasks);
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

  const isWatching = watchers.some((w) => w.id === currentUserId);

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
    const autoScheduled = (body.data?.autoScheduled as AutoScheduledChange[] | undefined) ?? [];
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

  const addComment = useCallback(async (body: string) => {
    const res = await apiFetch(`/api/v1/tasks/${task.id}/comments`, {
      method: "POST",
      body: JSON.stringify({ bodyMarkdown: body }),
    });
    if (!res.ok) throw new Error(t("task.commentFailed"));
    const result = await res.json();
    setComments((prev) => [
      ...prev,
      {
        id: result.data.id,
        body: result.data.bodyMarkdown,
        createdAt: result.data.createdAt,
        authorId: result.data.authorId,
        author: { displayName: result.data.author.displayName, avatarUrl: result.data.author.avatarUrl },
      },
    ]);
  }, [task.id, t]);

  const updateComment = useCallback(async (id: string, body: string) => {
    const res = await apiFetch(`/api/v1/comments/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ bodyMarkdown: body }),
    });
    if (res.ok) {
      const result = await res.json();
      setComments((prev) => prev.map((c) => c.id === id ? { ...c, body: result.data.bodyMarkdown } : c));
    }
  }, []);

  const deleteComment = useCallback(async (id: string) => {
    const res = await apiFetch(`/api/v1/comments/${id}`, { method: "DELETE" });
    if (res.ok) setComments((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const toggleWatch = useCallback(async () => {
    if (isWatching) {
      const res = await apiFetch(`/api/v1/watchers/tasks/${task.id}`, { method: "DELETE" });
      if (res.ok) setWatchers((prev) => prev.filter((w) => w.id !== currentUserId));
    } else {
      const res = await apiFetch(`/api/v1/watchers/tasks/${task.id}`, { method: "POST" });
      if (res.ok) {
        setWatchers((prev) => [
          ...prev,
          { id: currentUserId, displayName: "", addedAt: new Date().toISOString() },
        ]);
      }
    }
  }, [currentUserId, isWatching, task.id]);

  const handleDelete = useCallback(async () => {
    const res = await apiFetch(`/api/v1/tasks/${task.id}`, { method: "DELETE" });
    if (res.ok) {
      setDeleted(true);
      setTimeout(() => router.push("/"), 2000);
    }
  }, [router, task.id]);

  const handleSubtaskToggle = useCallback(async (id: string, status: string) => {
    setSubtasks((prev) => prev.map((st) => st.id === id ? { ...st, status } : st));
    await apiFetch(`/api/v1/tasks/${task.id}/subtasks/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
  }, [task.id]);

  const handleSubtaskAdd = useCallback(async (title: string) => {
    const res = await apiFetch(`/api/v1/tasks/${task.id}/subtasks`, {
      method: "POST",
      body: JSON.stringify({ title }),
    });
    if (res.ok) {
      const result = await res.json();
      setSubtasks((prev) => [...prev, result.data]);
    }
  }, [task.id]);

  const handleSubtaskRename = useCallback(async (id: string, title: string) => {
    setSubtasks((prev) => prev.map((st) => st.id === id ? { ...st, title } : st));
    await apiFetch(`/api/v1/tasks/${task.id}/subtasks/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ title }),
    });
  }, [task.id]);

  const handleSubtaskDelete = useCallback(async (id: string) => {
    setSubtasks((prev) => prev.filter((st) => st.id !== id));
    await apiFetch(`/api/v1/tasks/${task.id}/subtasks/${id}`, { method: "DELETE" });
  }, [task.id]);

  const handleTagsChange = useCallback(async (ids: string[]) => {
    setTaskTagIds(ids);
    await apiFetch(`/api/v1/tasks/${task.id}`, {
      method: "PATCH",
      body: JSON.stringify({ tagIds: ids }),
    });
  }, [task.id]);

  const handleAttachmentUpload = useCallback(async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await apiFetch(`/api/v1/tasks/${task.id}/attachments`, {
      method: "POST",
      body: formData,
    });
    if (res.ok) {
      const result = await res.json();
      setAttachments((prev) => [result.data, ...prev]);
    }
  }, [task.id]);

  const handleAttachmentDelete = useCallback(async (attachmentId: string) => {
    const res = await apiFetch(`/api/v1/tasks/${task.id}/attachments/${attachmentId}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
    }
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

  const handleAddWatcher = useCallback(async (userId: string) => {
    const res = await apiFetch(`/api/v1/watchers/tasks/${task.id}/add?userId=${userId}`, { method: "POST" });
    if (res.ok) {
      const member = projectMembers.find((m) => m.id === userId);
      setWatchers((prev) => [
        ...prev,
        { id: userId, displayName: member?.displayName ?? "", avatarUrl: member?.avatarUrl ?? null, addedAt: new Date().toISOString() },
      ]);
    }
  }, [projectMembers, task.id]);

  const handleRemoveWatcher = useCallback(async (userId: string) => {
    const res = await apiFetch(`/api/v1/watchers/tasks/${task.id}/remove?userId=${userId}`, { method: "DELETE" });
    if (res.ok) {
      setWatchers((prev) => prev.filter((x) => x.id !== userId));
    }
  }, [task.id]);

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
    handleSubtaskToggle,
    handleSubtaskAdd,
    handleSubtaskRename,
    handleSubtaskDelete,
    handleTagsChange,
    handleAttachmentUpload,
    handleAttachmentDelete,
    handleAssigneeChange,
    handleGroupChange,
    handleEstimatedChange,
    handleSpentChange,
    handleApprovalConfigChange,
    handleApprove,
    handleReject,
    handleCustomFieldChange,
    handleAddWatcher,
    handleRemoveWatcher,
    handleStartDateChange,
    handleEndDateChange,
    handleDurationChange,
  };
}

export type ActivityEventForTask = ActivityEvent;

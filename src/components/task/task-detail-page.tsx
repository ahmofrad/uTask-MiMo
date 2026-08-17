"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { SubtaskList } from "@/components/task/subtask-list";
import { AttachmentList } from "@/components/task/attachment-list";
import { TaskDependencies } from "@/components/task/task-dependencies";
import { CommentThread } from "@/components/comment/comment-thread";
import { ActivityTimeline } from "@/components/task/activity-timeline";
import { TaskDetailHeaderCard } from "@/components/task/task-detail-header-card";
import { TaskDetailSidebar } from "@/components/task/task-detail-sidebar";
import { useToast } from "@/components/ui/toast";
import type { ActivityEvent } from "@/lib/activity/types";
import { apiFetch } from "@/lib/api-fetch";
import { normalizeTaskDate } from "@/lib/date/task-date";

type AutoScheduledChange = {
  id: string;
  title: string;
  startDate: string | null;
  dueDate: string | null;
};

type TaskData = {
  id: string;
  title: string;
  description?: string | null;
  status: "open" | "in_progress" | "done" | "cancelled";
  priority: "low" | "med" | "high" | "urgent";
  startDate: string | null;
  endDate: string | null;
  dueDate: string | null;
  estimatedHours?: number | null;
  spentHours?: number | null;
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

type CustomFieldDef = {
  id: string;
  key: string;
  name: string;
  type: "text" | "number" | "date" | "select" | "multi_select" | "user" | "checkbox" | "url";
  required: boolean;
  config: Record<string, unknown>;
};

type CommentData = {
  id: string;
  body: string;
  createdAt: string;
  authorId?: string | undefined;
  author: { displayName: string; avatarUrl?: string | null };
  replies?: { id: string; body: string; createdAt: string; author: { displayName: string; avatarUrl?: string | null } }[];
};

type WatcherData = {
  id: string;
  displayName: string;
  avatarUrl?: string | null;
  addedAt: string;
};

type AttachmentData = {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
};

type Props = {
  task: TaskData;
  customFieldSchema: CustomFieldDef[];
  customFieldValues: Record<string, unknown>;
  comments: CommentData[];
  watchers: WatcherData[];
  attachments: AttachmentData[];
  auditEvents: ActivityEvent[];
  auditHasMore?: boolean;
  auditNextCursor?: string | null;
  projectMembers: { id: string; displayName: string; avatarUrl?: string | null }[];
  currentUserId: string;
};

export function TaskDetailPage({
  task: initialTask,
  customFieldSchema,
  customFieldValues: initialCFValues,
  comments: initialComments,
  watchers: initialWatchers,
  attachments: initialAttachments,
  auditEvents: initialAuditEvents,
  auditHasMore: initialAuditHasMore,
  auditNextCursor: initialAuditCursor,
  projectMembers,
  currentUserId,
}: Props) {
  const t = useTranslations();
  const router = useRouter();
  const { addToast } = useToast();
  const [task, setTask] = useState(initialTask);
  const [taskTagIds, setTaskTagIds] = useState<string[]>(initialTask.tags.map((tg) => tg.id));
  const [cfValues, setCfValues] = useState(initialCFValues);
  const [comments, setComments] = useState(initialComments);
  const [watchers, setWatchers] = useState(initialWatchers);
  const [attachments, setAttachments] = useState(initialAttachments);
  const [subtasks, setSubtasks] = useState(initialTask.subtasks);
  const [auditEvents, setAuditEvents] = useState(initialAuditEvents);
  const [auditHasMore, setAuditHasMore] = useState(initialAuditHasMore ?? false);
  const [auditCursor, setAuditCursor] = useState<string | null | undefined>(initialAuditCursor);
  const [auditLimit, setAuditLimit] = useState(10);
  const [deleted, setDeleted] = useState(false);

  function computeInitialDuration() {
    if (!initialTask.startDate || !initialTask.endDate) return { days: 0, hours: 0 };
    const ms = new Date(initialTask.endDate).getTime() - new Date(initialTask.startDate).getTime();
    if (ms <= 0) return { days: 0, hours: 0 };
    const totalHours = Math.floor(ms / (1000 * 60 * 60));
    return { days: Math.floor(totalHours / 24), hours: totalHours % 24 };
  }
  const initDur = computeInitialDuration();
  const [durationDays, setDurationDays] = useState(initDur.days);
  const [durationHours, setDurationHours] = useState(initDur.hours);

  const isWatching = watchers.some((w) => w.id === currentUserId);

  const refreshAudit = useCallback(async (limit?: number) => {
    const res = await apiFetch(`/api/v1/activity/tasks/${task.id}?limit=${limit ?? auditLimit}`);
    if (res.ok) {
      const data = await res.json();
      setAuditEvents(data.items ?? []);
      setAuditHasMore(data.hasMore ?? false);
      setAuditCursor(data.nextCursor ?? null);
    }
  }, [task.id, auditLimit]);

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
    void refreshAudit();

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
            void refreshAudit();
          },
        },
      });
    }
    return body.data;
  }, [addToast, refreshAudit, task.id, t]);

  const loadMoreAudit = useCallback(async () => {
    if (!auditCursor || !auditHasMore) return;
    const res = await apiFetch(`/api/v1/activity/tasks/${task.id}?cursor=${encodeURIComponent(auditCursor)}&limit=50`);
    if (res.ok) {
      const data = await res.json();
      setAuditEvents((prev) => [...prev, ...(data.items ?? [])]);
      setAuditHasMore(data.hasMore ?? false);
      setAuditCursor(data.nextCursor ?? null);
    }
  }, [task.id, auditCursor, auditHasMore]);

  const handleSaveTitle = (title: string) => {
    if (!title.trim() || title === task.title) return;
    void updateTask({ title: title.trim() });
  };

  const handleSaveDescription = (val: string | null) => {
    if (val === task.description) return;
    void updateTask({ description: val });
  };

  const handleStatusChange = (status: string) => {
    setTask((prev) => ({ ...prev, status: status as TaskData["status"] }));
    void updateTask({ status });
  };

  const handlePriorityChange = (priority: string) => {
    setTask((prev) => ({ ...prev, priority: priority as TaskData["priority"] }));
    void updateTask({ priority });
  };


  const addComment = async (body: string) => {
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
  };

  const updateComment = async (id: string, body: string) => {
    const res = await apiFetch(`/api/v1/comments/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ bodyMarkdown: body }),
    });
    if (res.ok) {
      const result = await res.json();
      setComments((prev) => prev.map((c) => c.id === id ? { ...c, body: result.data.bodyMarkdown } : c));
    }
  };

  const deleteComment = async (id: string) => {
    const res = await apiFetch(`/api/v1/comments/${id}`, { method: "DELETE" });
    if (res.ok) setComments((prev) => prev.filter((c) => c.id !== id));
  };

  const toggleWatch = async () => {
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
  };

  const handleDelete = async () => {
    const res = await apiFetch(`/api/v1/tasks/${task.id}`, { method: "DELETE" });
    if (res.ok) {
      setDeleted(true);
      setTimeout(() => router.push("/"), 2000);
    }
  };

  const handleSubtaskToggle = async (id: string, status: string) => {
    setSubtasks((prev) => prev.map((st) => st.id === id ? { ...st, status } : st));
    await apiFetch(`/api/v1/tasks/${task.id}/subtasks/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
  };

  const handleSubtaskAdd = async (title: string) => {
    const res = await apiFetch(`/api/v1/tasks/${task.id}/subtasks`, {
      method: "POST",
      body: JSON.stringify({ title }),
    });
    if (res.ok) {
      const result = await res.json();
      setSubtasks((prev) => [...prev, result.data]);
    }
  };

  const handleSubtaskRename = async (id: string, title: string) => {
    setSubtasks((prev) => prev.map((st) => st.id === id ? { ...st, title } : st));
    await apiFetch(`/api/v1/tasks/${task.id}/subtasks/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ title }),
    });
  };

  const handleSubtaskDelete = async (id: string) => {
    setSubtasks((prev) => prev.filter((st) => st.id !== id));
    await apiFetch(`/api/v1/tasks/${task.id}/subtasks/${id}`, { method: "DELETE" });
  };

  const handleTagsChange = async (ids: string[]) => {
    setTaskTagIds(ids);
    await apiFetch(`/api/v1/tasks/${task.id}`, {
      method: "PATCH",
      body: JSON.stringify({ tagIds: ids }),
    });
  };

  const handleAttachmentUpload = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`/api/v1/tasks/${task.id}/attachments`, {
      method: "POST",
      body: formData,
    });
    if (res.ok) {
      const result = await res.json();
      setAttachments((prev) => [result.data, ...prev]);
    }
  };

  const handleAttachmentDelete = async (attachmentId: string) => {
    const res = await fetch(`/api/v1/tasks/${task.id}/attachments/${attachmentId}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
    }
  };

  const handleAssigneeChange = (ids: string[]) => {
    const next = projectMembers.filter((m) => ids.includes(m.id));
    setTask((prev) => ({ ...prev, assignees: next }));
    void updateTask({ assigneeIds: ids });
  };

  const handleGroupChange = async (groupId: string | null) => {
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
      void refreshAudit();
    }
  };

  const handleEstimatedChange = (val: number | null) => {
    setTask((prev) => ({ ...prev, estimatedHours: val }));
    void updateTask({ estimatedHours: val });
  };

  const handleSpentChange = (val: number | null) => {
    setTask((prev) => ({ ...prev, spentHours: val }));
    void updateTask({ spentHours: val });
  };

  const handleCustomFieldChange = async (key: string, value: unknown) => {
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
  };

  const handleAddWatcher = async (userId: string) => {
    const res = await apiFetch(`/api/v1/watchers/tasks/${task.id}/add?userId=${userId}`, { method: "POST" });
    if (res.ok) {
      const member = projectMembers.find((m) => m.id === userId);
      setWatchers((prev) => [
        ...prev,
        { id: userId, displayName: member?.displayName ?? "", avatarUrl: member?.avatarUrl ?? null, addedAt: new Date().toISOString() },
      ]);
    }
  };

  const handleRemoveWatcher = async (userId: string) => {
    const res = await apiFetch(`/api/v1/watchers/tasks/${task.id}/remove?userId=${userId}`, { method: "DELETE" });
    if (res.ok) {
      setWatchers((prev) => prev.filter((x) => x.id !== userId));
    }
  };

  const computeDuration = (start: string, end: string) => {
    const ms = new Date(end).getTime() - new Date(start).getTime();
    if (ms <= 0) return { days: 0, hours: 0 };
    const totalHours = Math.floor(ms / (1000 * 60 * 60));
    return { days: Math.floor(totalHours / 24), hours: totalHours % 24 };
  };

  const addDurationToDate = (start: string, days: number, hours: number) => {
    const d = new Date(start);
    d.setDate(d.getDate() + days);
    d.setHours(d.getHours() + hours);
    return d.toISOString();
  };

  const handleStartDateChange = (val: string | null) => {
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
  };

  const handleEndDateChange = (val: string | null) => {
    setTask((prev) => ({ ...prev, endDate: val }));
    if (val && task.startDate) {
      const dur = computeDuration(task.startDate, val);
      setDurationDays(dur.days);
      setDurationHours(dur.hours);
    }
    void updateTask({ endDate: val });
  };

  const handleDurationChange = (days: number, hours: number) => {
    setDurationDays(days);
    setDurationHours(hours);
    if (task.startDate && (days > 0 || hours > 0)) {
      const end = addDurationToDate(task.startDate, days, hours);
      setTask((prev) => ({ ...prev, endDate: end }));
      void updateTask({ endDate: end });
    }
  };

  if (deleted) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <p className="text-lg text-fg-muted mb-4">{t("task.taskDeleted")}</p>
        <Link href={`/projects/${task.projectId}`} className="text-accent hover:underline">{t("task.backToProject")}</Link>
      </div>
    );
  }

  return (
    <div className="px-6 py-6 space-y-4">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <Link
          href={`/projects/${task.projectId}`}
          className="inline-flex items-center gap-1 text-sm text-fg-muted hover:text-fg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          {t("task.backToProject")}
        </Link>
        <button
          onClick={handleDelete}
          className="text-sm text-destructive hover:text-destructive/80 transition-colors"
        >
          {t("task.deleteTask")}
        </button>
      </div>

      <TaskDetailHeaderCard
        title={task.title}
        description={task.description ?? null}
        status={task.status}
        priority={task.priority}
        projectName={task.projectName}
        onSaveTitle={handleSaveTitle}
        onSaveDescription={handleSaveDescription}
        onStatusChange={handleStatusChange}
        onPriorityChange={handlePriorityChange}
      />

      {/* Two-column layout */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Main column */}
        <div className="md:col-span-2 space-y-4">
          {/* Subtasks card */}
          <div className="border border-border-primary rounded-xl bg-bg-surface p-5">
            <SubtaskList
              subtasks={subtasks}
              onToggle={handleSubtaskToggle}
              onAdd={handleSubtaskAdd}
              onRename={handleSubtaskRename}
              onDelete={handleSubtaskDelete}
            />
          </div>

          {/* Attachments card */}
          <div className="border border-border-primary rounded-xl bg-bg-surface p-5">
            <AttachmentList
              attachments={attachments}
              onUpload={handleAttachmentUpload}
              onDelete={handleAttachmentDelete}
            />
          </div>

          {/* Dependencies card */}
          <div className="border border-border-primary rounded-xl bg-bg-surface p-5">
            <h3 className="text-xs font-medium text-fg-muted mb-4 uppercase tracking-wide">
              {t("task.dependencies.title")}
            </h3>
            <TaskDependencies projectId={task.projectId} taskId={task.id} />
          </div>

          {/* Comments card */}
          <div className="border border-border-primary rounded-xl bg-bg-surface p-5">
            <h3 className="text-xs font-medium text-fg-muted mb-4 uppercase tracking-wide">
              {t("task.comments")} ({comments.length})
            </h3>
            <CommentThread
              comments={comments.map((c) => ({
                id: c.id,
                body: c.body,
                createdAt: c.createdAt,
                authorId: c.authorId,
                author: c.author,
              }))}
              onAdd={addComment}
              onUpdate={updateComment}
              onDelete={deleteComment}
              currentUserId={currentUserId}
            />
          </div>

          {/* Activity card */}
          <div className="border border-border-primary rounded-xl bg-bg-surface p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-medium text-fg-muted uppercase tracking-wide">{t("task.activity")}</h3>
              <select
                value={auditLimit}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setAuditLimit(val);
                  void refreshAudit(val);
                }}
                className="text-xs bg-bg-primary border border-border rounded px-2 py-1 text-fg-muted"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
            <ActivityTimeline events={auditEvents} onLoadMore={loadMoreAudit} hasMore={auditHasMore} members={projectMembers} />
          </div>
        </div>

        {/* Sidebar */}
        <TaskDetailSidebar
          task={task}
          projectMembers={projectMembers}
          currentUserId={currentUserId}
          customFieldSchema={customFieldSchema}
          cfValues={cfValues}
          taskTagIds={taskTagIds}
          watchers={watchers}
          isWatching={isWatching}
          durationDays={durationDays}
          durationHours={durationHours}
          onAssigneeChange={handleAssigneeChange}
          onGroupChange={handleGroupChange}
          onEstimatedChange={handleEstimatedChange}
          onSpentChange={handleSpentChange}
          onStartDateChange={handleStartDateChange}
          onDueDateChange={(val) => {
            setTask((prev) => ({ ...prev, dueDate: val }));
            void updateTask({ dueDate: val });
          }}
          onEndDateChange={handleEndDateChange}
          onDurationChange={handleDurationChange}
          onTagsChange={handleTagsChange}
          onCustomFieldChange={handleCustomFieldChange}
          onToggleWatch={toggleWatch}
          onAddWatcher={handleAddWatcher}
          onRemoveWatcher={handleRemoveWatcher}
        />
      </div>
    </div>
  );
}

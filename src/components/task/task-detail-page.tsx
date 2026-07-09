"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/date/format";
import { TagPicker } from "@/components/tags/tag-picker";
import { SubtaskList } from "@/components/task/subtask-list";
import { AttachmentList } from "@/components/task/attachment-list";
import { JalaliDatePicker } from "@/components/ui/jalali-date-picker";
import { CustomFieldInput } from "@/components/custom-field/custom-field-input";
import { CommentThread } from "@/components/comment/comment-thread";
import { ActivityTimeline } from "@/components/task/activity-timeline";
import type { ActivityEvent } from "@/lib/activity/types";
import { Avatar } from "@/components/ui/avatar";
import { apiFetch } from "@/lib/api-fetch";

type TaskData = {
  id: string;
  title: string;
  description?: string | null;
  status: "open" | "in_progress" | "done" | "cancelled";
  priority: "low" | "med" | "high" | "urgent";
  dueDate: string | null;
  estimatedHours?: number | null;
  spentHours?: number | null;
  projectId: string;
  projectName: string;
  assignee: { id: string; displayName: string; avatarUrl?: string | null } | null;
  reporter: { id: string; displayName: string } | null;
  tags: { id: string; name: string }[];
  subtasks: { id: string; title: string; status: string; priority: string; assigneeId: string | null }[];
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
  const locale = useLocale() as "fa-IR" | "en-US";
  const router = useRouter();
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
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(task.title);
  const [editingDescription, setEditingDescription] = useState(false);
  const [descDraft, setDescDraft] = useState(task.description ?? "");
  const [deleted, setDeleted] = useState(false);

  const isWatching = watchers.some((w) => w.id === currentUserId);

  const updateTask = useCallback(async (updates: Record<string, unknown>) => {
    const res = await apiFetch(`/api/v1/tasks/${task.id}`, {
      method: "PATCH",
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error(t("task.updateFailed"));
    const body = await res.json();
    if (body.data) setTask((prev) => ({ ...prev, ...body.data }));
    // Refresh audit events after mutation
    refreshAudit();
    return body.data;
  }, [task.id, t]);

  const refreshAudit = useCallback(async (limit?: number) => {
    const res = await apiFetch(`/api/v1/activity/tasks/${task.id}?limit=${limit ?? auditLimit}`);
    if (res.ok) {
      const data = await res.json();
      setAuditEvents(data.items ?? []);
      setAuditHasMore(data.hasMore ?? false);
      setAuditCursor(data.nextCursor ?? null);
    }
  }, [task.id, auditLimit]);

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

  const saveTitle = async () => {
    setEditingTitle(false);
    if (!titleDraft.trim() || titleDraft === task.title) return;
    await updateTask({ title: titleDraft.trim() });
  };

  const saveDescription = async () => {
    const val = descDraft.trim() || null;
    if (val === task.description) { setEditingDescription(false); return; }
    await updateTask({ description: val });
    setEditingDescription(false);
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

  const handleTagsChange = async (ids: string[]) => {
    setTaskTagIds(ids);
    await apiFetch(`/api/v1/tasks/${task.id}`, {
      method: "PATCH",
      body: JSON.stringify({ tagIds: ids }),
    });
  };

  const handleSubtaskDelete = async (id: string) => {
    setSubtasks((prev) => prev.filter((st) => st.id !== id));
    await apiFetch(`/api/v1/tasks/${task.id}/subtasks/${id}`, { method: "DELETE" });
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

      {/* Header card */}
      <div className="border border-border-primary rounded-xl bg-bg-surface p-5 space-y-4">
        {/* Title */}
        <div>
          {editingTitle ? (
            <input
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              className="w-full text-2xl font-bold bg-transparent border-b-2 border-accent text-fg outline-none"
              autoFocus
              onBlur={saveTitle}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveTitle();
                if (e.key === "Escape") { setEditingTitle(false); setTitleDraft(task.title); }
              }}
            />
          ) : (
            <h1
              className="text-2xl font-bold text-fg cursor-pointer hover:text-accent transition-colors rounded-lg p-1 -m-1 hover:bg-bg-surface-2"
              onClick={() => setEditingTitle(true)}
            >
              {task.title}
            </h1>
          )}
        </div>

        {/* Controls row */}
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={task.status}
            onChange={(e) => {
              const newStatus = e.target.value;
              setTask((prev) => ({ ...prev, status: newStatus as TaskData["status"] }));
              updateTask({ status: newStatus });
            }}
            className="text-sm bg-bg-primary border border-border rounded-lg px-3 py-1.5 text-fg"
          >
            <option value="open">{t("task.status.open")}</option>
            <option value="in_progress">{t("task.status.in_progress")}</option>
            <option value="done">{t("task.status.done")}</option>
            <option value="cancelled">{t("task.status.cancelled")}</option>
          </select>
          <select
            value={task.priority}
            onChange={(e) => {
              const newPriority = e.target.value;
              setTask((prev) => ({ ...prev, priority: newPriority as TaskData["priority"] }));
              updateTask({ priority: newPriority });
            }}
            className="text-sm bg-bg-primary border border-border rounded-lg px-3 py-1.5 text-fg"
          >
            <option value="low">{t("task.priority.low")}</option>
            <option value="med">{t("task.priority.med")}</option>
            <option value="high">{t("task.priority.high")}</option>
            <option value="urgent">{t("task.priority.urgent")}</option>
          </select>
          <JalaliDatePicker
            value={task.dueDate?.split("T")[0] ?? null}
            onChange={(val) => {
              setTask((prev) => ({ ...prev, dueDate: val }));
              updateTask({ dueDate: val });
            }}
            className="w-40"
          />
          <span className="text-xs text-fg-muted bg-bg-secondary px-2.5 py-1 rounded-lg">
            {task.projectName}
          </span>
        </div>

        {/* Description */}
        <div className="pt-2 border-t border-border-secondary">
          <h3 className="text-xs font-medium text-fg-muted mb-2 uppercase tracking-wide">{t("task.fields.description")}</h3>
          {editingDescription ? (
            <textarea
              value={descDraft}
              onChange={(e) => setDescDraft(e.target.value)}
              onBlur={saveDescription}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); saveDescription(); }
                if (e.key === "Escape") { setEditingDescription(false); setDescDraft(task.description ?? ""); }
              }}
              rows={4}
              className="w-full text-sm bg-transparent border border-accent rounded-lg p-2 text-fg outline-none resize-none"
              autoFocus
              placeholder={t("task.fields.description")}
            />
          ) : (
            <div
              className="text-sm text-fg-secondary cursor-pointer hover:text-accent transition-colors min-h-[2rem] rounded-lg p-1 -m-1 hover:bg-bg-surface-2"
              onClick={() => { setEditingDescription(true); setDescDraft(task.description ?? ""); }}
            >
              {task.description ? (
                <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: task.description }} />
              ) : (
                <span className="text-fg-subtle italic">{t("task.fields.description")}</span>
              )}
            </div>
          )}
        </div>
      </div>

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
                  refreshAudit(val);
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
        <div className="space-y-4">
          {/* Details card */}
          <div className="border border-border-primary rounded-xl bg-bg-surface p-5 space-y-4">
            <h4 className="text-xs font-medium text-fg-muted uppercase tracking-wide">{t("task.fields.assignee")}</h4>
            <select
              value={task.assignee?.id ?? ""}
              onChange={(e) => {
                const val = e.target.value || null;
                setTask((prev) => ({
                  ...prev,
                  assignee: val ? projectMembers.find((m) => m.id === val) ?? { id: val, displayName: "" } : null,
                }));
                updateTask({ assigneeId: val });
              }}
              className="w-full text-sm bg-bg-primary border border-border rounded-lg px-3 py-1.5 text-fg"
            >
              <option value="">{t("task.unassigned")}</option>
              {projectMembers.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.displayName}
                </option>
              ))}
            </select>

            {task.reporter && (
              <>
                <div className="border-t border-border-secondary pt-3">
                  <h4 className="text-xs font-medium text-fg-muted mb-1">{t("task.reporter")}</h4>
                  <p className="text-sm text-fg">{task.reporter.displayName}</p>
                </div>
              </>
            )}

            <div className="border-t border-border-secondary pt-3 grid grid-cols-2 gap-3">
              {task.estimatedHours != null && (
                <div>
                  <h4 className="text-xs text-fg-muted font-medium mb-1">{t("task.estimated")}</h4>
                  <input
                    type="number"
                    value={task.estimatedHours ?? ""}
                    onChange={(e) => {
                      const val = e.target.value ? Number(e.target.value) : null;
                      setTask((prev) => ({ ...prev, estimatedHours: val }));
                      updateTask({ estimatedHours: val });
                    }}
                    className="w-full text-sm bg-bg-primary border border-border rounded-lg px-2 py-1 text-fg"
                  />
                </div>
              )}
              {task.spentHours != null && (
                <div>
                  <h4 className="text-xs text-fg-muted font-medium mb-1">{t("task.spent")}</h4>
                  <input
                    type="number"
                    value={task.spentHours ?? ""}
                    onChange={(e) => {
                      const val = e.target.value ? Number(e.target.value) : null;
                      setTask((prev) => ({ ...prev, spentHours: val }));
                      updateTask({ spentHours: val });
                    }}
                    className="w-full text-sm bg-bg-primary border border-border rounded-lg px-2 py-1 text-fg"
                  />
                </div>
              )}
            </div>

            <div className="border-t border-border-secondary pt-3 text-xs text-fg-muted space-y-1">
              <p>{t("task.createdAt")}: {formatDateTime(new Date(task.createdAt), locale)}</p>
              <p>{t("task.updatedAt")}: {formatDateTime(new Date(task.updatedAt), locale)}</p>
            </div>
          </div>

          {/* Tags card */}
          <div className="border border-border-primary rounded-xl bg-bg-surface p-5">
            <h4 className="text-xs font-medium text-fg-muted uppercase tracking-wide mb-2">{t("task.tags")}</h4>
            <TagPicker
              projectId={task.projectId}
              value={taskTagIds}
              onChange={handleTagsChange}
            />
          </div>

          {/* Custom Fields card */}
          {customFieldSchema.length > 0 && (
            <div className="border border-border-primary rounded-xl bg-bg-surface p-5">
              <h4 className="text-xs font-medium text-fg-muted uppercase tracking-wide mb-3">{t("task.customFields")}</h4>
              <div className="space-y-3">
                {customFieldSchema.map((field) => (
                  <CustomFieldInput
                    key={field.id}
                    field={field}
                    value={cfValues[field.key] ?? null}
                    onChange={async (value) => {
                      const prev = { ...cfValues };
                      const next = { ...cfValues, [field.key]: value };
                      setCfValues(next);
                      try {
                        const res = await apiFetch(`/api/v1/tasks/${task.id}`, {
                          method: "PATCH",
                          body: JSON.stringify({ customFields: { [field.key]: value } }),
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
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Watchers card */}
          <div className="border border-border-primary rounded-xl bg-bg-surface p-5">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-medium text-fg-muted uppercase tracking-wide">{t("task.watchers")}</h4>
              <div className="flex items-center gap-2">
                <select
                  onChange={async (e) => {
                    const userId = e.target.value;
                    e.target.value = "";
                    if (!userId) return;
                    const res = await apiFetch(`/api/v1/watchers/tasks/${task.id}/add?userId=${userId}`, { method: "POST" });
                    if (res.ok) {
                      const member = projectMembers.find((m) => m.id === userId);
                      setWatchers((prev) => [
                        ...prev,
                        { id: userId, displayName: member?.displayName ?? "", avatarUrl: member?.avatarUrl ?? null, addedAt: new Date().toISOString() },
                      ]);
                    }
                  }}
                  className="text-xs bg-transparent border border-border-primary rounded px-1.5 py-0.5 text-fg-muted"
                >
                  <option value="">+ {t("task.addWatcher")}</option>
                  {projectMembers
                    .filter((m) => !watchers.some((w) => w.id === m.id))
                    .map((m) => (
                      <option key={m.id} value={m.id}>{m.displayName}</option>
                    ))}
                </select>
                <button
                  onClick={toggleWatch}
                  className={cn(
                    "text-xs px-2 py-0.5 rounded-md border transition-colors",
                    isWatching
                      ? "border-accent/30 text-accent hover:bg-accent/10"
                      : "border-border text-fg-muted hover:text-fg hover:border-fg-muted",
                  )}
                >
                  {isWatching ? t("task.watching") : t("task.watch")}
                </button>
              </div>
            </div>
            {watchers.length > 0 ? (
              <div className="space-y-1.5">
                {watchers.map((w) => (
                  <div key={w.id} className="flex items-center gap-2 text-sm text-fg-muted group">
                    <Avatar initials={w.displayName.slice(0, 2).toUpperCase()} size="sm" />
                    <span className="truncate flex-1">{w.displayName || t("common.you")}</span>
                    {w.id !== currentUserId && (
                      <button
                        onClick={async () => {
                          const res = await apiFetch(`/api/v1/watchers/tasks/${task.id}/remove?userId=${w.id}`, { method: "DELETE" });
                          if (res.ok) {
                            setWatchers((prev) => prev.filter((x) => x.id !== w.id));
                          }
                        }}
                        className="text-xs text-fg-muted opacity-0 group-hover:opacity-100 hover:text-destructive transition-all"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-fg-subtle">{t("task.noWatchers")}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

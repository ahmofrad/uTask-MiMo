"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { SubtaskList } from "@/components/task/subtask-list";
import { AttachmentList } from "@/components/task/attachment-list";
import { TaskDependencies } from "@/components/task/task-dependencies";
import { CommentThread } from "@/components/comment/comment-thread";
import { ActivityTimeline } from "@/components/task/activity-timeline";
import { TaskDetailHeaderCard } from "@/components/task/task-detail-header-card";
import { TaskDetailSidebar } from "@/components/task/task-detail-sidebar";
import { TaskApprovalBanner } from "@/components/task/task-approval-banner";
import { useToast } from "@/components/ui/toast";
import type { ActivityEvent } from "@/lib/activity/types";
import { apiFetch } from "@/lib/api-fetch";
import {
  useTaskMutations,
  type AttachmentData,
  type CommentData,
  type CustomFieldDef,
  type TaskData,
  type WatcherData,
} from "@/hooks/use-task-mutations";

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
  canApprove: boolean;
  approverName?: string | null;
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
  canApprove,
  approverName,
}: Props) {
  const t = useTranslations();
  const { addToast } = useToast();
  const [auditEvents, setAuditEvents] = useState(initialAuditEvents);
  const [auditHasMore, setAuditHasMore] = useState(initialAuditHasMore ?? false);
  const [auditCursor, setAuditCursor] = useState<string | null | undefined>(initialAuditCursor);
  const [auditLimit, setAuditLimit] = useState(10);

  const refreshAudit = useCallback(async (limit?: number) => {
    const res = await apiFetch(`/api/v1/activity/tasks/${initialTask.id}?limit=${limit ?? auditLimit}`);
    if (res.ok) {
      const data = await res.json();
      setAuditEvents(data.items ?? []);
      setAuditHasMore(data.hasMore ?? false);
      setAuditCursor(data.nextCursor ?? null);
    }
  }, [auditLimit, initialTask.id]);

  const loadMoreAudit = useCallback(async () => {
    if (!auditCursor || !auditHasMore) return;
    const res = await apiFetch(`/api/v1/activity/tasks/${initialTask.id}?cursor=${encodeURIComponent(auditCursor)}&limit=50`);
    if (res.ok) {
      const data = await res.json();
      setAuditEvents((prev) => [...prev, ...(data.items ?? [])]);
      setAuditHasMore(data.hasMore ?? false);
      setAuditCursor(data.nextCursor ?? null);
    }
  }, [initialTask.id, auditCursor, auditHasMore]);

  const {
    task,
    setTask,
    updateTask,
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
    handleRecurrenceChange,
    handleApprove,
    handleReject,
    handleCustomFieldChange,
    handleAddWatcher,
    handleRemoveWatcher,
    handleStartDateChange,
    handleEndDateChange,
    handleDurationChange,
  } = useTaskMutations({
    initialTask,
    initialComments,
    initialWatchers,
    initialAttachments,
    initialSubtasks: initialTask.subtasks,
    initialCFValues,
    initialTagIds: initialTask.tags.map((tg) => tg.id),
    projectMembers,
    currentUserId,
    onAuditRefresh: refreshAudit,
    addToast,
    t,
  });

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

      {task.status === "pending_approval" && (
        <TaskApprovalBanner
          canApprove={canApprove}
          approverName={approverName ?? null}
          onApprove={handleApprove}
          onReject={handleReject}
        />
      )}

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
          onRequiresApprovalChange={(value) => handleApprovalConfigChange({ requiresApproval: value })}
          onApproverChange={(userId) => handleApprovalConfigChange({ approverId: userId })}
          onRecurrenceChange={handleRecurrenceChange}
        />
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { TaskDetailHeaderCard } from "@/components/task/task-detail-header-card";
import { TaskDetailSidebar } from "@/components/task/task-detail-sidebar";
import { TaskApprovalBanner } from "@/components/task/task-approval-banner";
import { TaskMainColumn } from "@/components/task/task-main-column";
import { useToast } from "@/components/ui/toast";
import type { ActivityEvent } from "@/lib/activity/types";
import {
  useTaskMutations,
  type AttachmentData,
  type CommentData,
  type CustomFieldDef,
  type TaskData,
  type WatcherData,
} from "@/hooks/use-task-mutations";
import { useTaskAudit } from "./use-task-audit";

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

  const audit = useTaskAudit({
    taskId: initialTask.id,
    initialEvents: initialAuditEvents,
    initialHasMore: initialAuditHasMore,
    initialNextCursor: initialAuditCursor,
  });

  const {
    task, setTask, updateTask, taskTagIds, cfValues, comments, watchers,
    attachments, subtasks, durationDays, durationHours, deleted, isWatching,
    handleSaveTitle, handleSaveDescription, handleStatusChange, handlePriorityChange,
    addComment, updateComment, deleteComment, toggleWatch, handleDelete,
    handleSubtaskToggle, handleSubtaskAdd, handleSubtaskRename, handleSubtaskDelete,
    handleTagsChange, handleAttachmentUpload, handleAttachmentDelete,
    handleAssigneeChange, handleGroupChange, handleEstimatedChange, handleSpentChange,
    handleApprovalConfigChange, handleRecurrenceChange, handleApprove, handleReject,
    handleCustomFieldChange, handleAddWatcher, handleRemoveWatcher,
    handleStartDateChange, handleEndDateChange, handleDurationChange,
  } = useTaskMutations({
    initialTask, initialComments, initialWatchers, initialAttachments,
    initialSubtasks: initialTask.subtasks, initialCFValues,
    initialTagIds: initialTask.tags.map((tg) => tg.id),
    projectMembers, currentUserId, onAuditRefresh: audit.refreshAudit, addToast, t,
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
      <div className="flex items-center justify-between">
        <Link href={`/projects/${task.projectId}`} className="inline-flex items-center gap-1 text-sm text-fg-muted hover:text-fg transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          {t("task.backToProject")}
        </Link>
        <button onClick={handleDelete} className="text-sm text-destructive hover:text-destructive/80 transition-colors">
          {t("task.deleteTask")}
        </button>
      </div>

      {task.status === "pending_approval" && (
        <TaskApprovalBanner canApprove={canApprove} approverName={approverName ?? null} onApprove={handleApprove} onReject={handleReject} />
      )}

      <TaskDetailHeaderCard
        title={task.title} description={task.description ?? null} status={task.status}
        priority={task.priority} projectName={task.projectName}
        onSaveTitle={handleSaveTitle} onSaveDescription={handleSaveDescription}
        onStatusChange={handleStatusChange} onPriorityChange={handlePriorityChange}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <TaskMainColumn
          task={task} comments={comments} attachments={attachments} subtasks={subtasks}
          audit={audit} projectMembers={projectMembers} currentUserId={currentUserId}
          onSubtaskToggle={handleSubtaskToggle} onSubtaskAdd={handleSubtaskAdd}
          onSubtaskRename={handleSubtaskRename} onSubtaskDelete={handleSubtaskDelete}
          onAttachmentUpload={handleAttachmentUpload} onAttachmentDelete={handleAttachmentDelete}
          onAddComment={addComment} onUpdateComment={updateComment} onDeleteComment={deleteComment}
        />

        <TaskDetailSidebar
          task={task} projectMembers={projectMembers} currentUserId={currentUserId}
          customFieldSchema={customFieldSchema} cfValues={cfValues} taskTagIds={taskTagIds}
          watchers={watchers} isWatching={isWatching} durationDays={durationDays} durationHours={durationHours}
          onAssigneeChange={handleAssigneeChange} onGroupChange={handleGroupChange}
          onEstimatedChange={handleEstimatedChange} onSpentChange={handleSpentChange}
          onStartDateChange={handleStartDateChange}
          onDueDateChange={(val) => { setTask((prev) => ({ ...prev, dueDate: val })); void updateTask({ dueDate: val }); }}
          onEndDateChange={handleEndDateChange} onDurationChange={handleDurationChange}
          onTagsChange={handleTagsChange} onCustomFieldChange={handleCustomFieldChange}
          onToggleWatch={toggleWatch} onAddWatcher={handleAddWatcher} onRemoveWatcher={handleRemoveWatcher}
          onRequiresApprovalChange={(value) => handleApprovalConfigChange({ requiresApproval: value })}
          onApproverChange={(userId) => handleApprovalConfigChange({ approverId: userId })}
          onRecurrenceChange={handleRecurrenceChange}
        />
      </div>
    </div>
  );
}

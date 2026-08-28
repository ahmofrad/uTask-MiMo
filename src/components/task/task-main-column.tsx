"use client";

import { useTranslations } from "next-intl";
import { SubtaskList } from "@/components/task/subtask-list";
import { AttachmentList } from "@/components/task/attachment-list";
import { TaskDependencies } from "@/components/task/task-dependencies";
import { CommentThread } from "@/components/comment/comment-thread";
import { ActivityTimeline } from "@/components/task/activity-timeline";
import type { ActivityEvent } from "@/lib/activity/types";
import type { AttachmentData, CommentData, TaskData } from "@/hooks/use-task-mutations";

type AuditState = {
  auditEvents: ActivityEvent[];
  auditHasMore: boolean;
  auditLimit: number;
  setAuditLimit: (n: number) => void;
  refreshAudit: (limit?: number) => Promise<void>;
  loadMoreAudit: () => Promise<void>;
};

type Props = {
  task: TaskData;
  comments: CommentData[];
  attachments: AttachmentData[];
  subtasks: TaskData["subtasks"];
  audit: AuditState;
  projectMembers: { id: string; displayName: string; avatarUrl?: string | null }[];
  currentUserId: string;
  // Subtask handlers
  onSubtaskToggle: (id: string, status: string) => void;
  onSubtaskAdd: (title: string) => void;
  onSubtaskRename: (id: string, title: string) => void;
  onSubtaskDelete: (id: string) => void;
  // Attachment handlers
  onAttachmentUpload: (file: File) => Promise<void>;
  onAttachmentDelete: (id: string) => void;
  // Comment handlers
  onAddComment: (body: string) => Promise<void>;
  onUpdateComment: (id: string, body: string) => Promise<void>;
  onDeleteComment: (id: string) => Promise<void>;
};

export function TaskMainColumn({
  task,
  comments,
  attachments,
  subtasks,
  audit,
  projectMembers,
  currentUserId,
  onSubtaskToggle,
  onSubtaskAdd,
  onSubtaskRename,
  onSubtaskDelete,
  onAttachmentUpload,
  onAttachmentDelete,
  onAddComment,
  onUpdateComment,
  onDeleteComment,
}: Props) {
  const t = useTranslations();

  return (
    <div className="md:col-span-2 space-y-4">
      <div className="border border-border-primary rounded-xl bg-bg-surface p-5">
        <SubtaskList
          subtasks={subtasks}
          onToggle={onSubtaskToggle}
          onAdd={onSubtaskAdd}
          onRename={onSubtaskRename}
          onDelete={onSubtaskDelete}
        />
      </div>

      <div className="border border-border-primary rounded-xl bg-bg-surface p-5">
        <AttachmentList
          attachments={attachments}
          onUpload={onAttachmentUpload}
          onDelete={onAttachmentDelete}
        />
      </div>

      <div className="border border-border-primary rounded-xl bg-bg-surface p-5">
        <h3 className="text-xs font-medium text-fg-muted mb-4 uppercase tracking-wide">
          {t("task.dependencies.title")}
        </h3>
        <TaskDependencies projectId={task.projectId} taskId={task.id} />
      </div>

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
          onAdd={onAddComment}
          onUpdate={onUpdateComment}
          onDelete={onDeleteComment}
          currentUserId={currentUserId}
        />
      </div>

      <div className="border border-border-primary rounded-xl bg-bg-surface p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-medium text-fg-muted uppercase tracking-wide">{t("task.activity")}</h3>
          <select
            value={audit.auditLimit}
            onChange={(e) => {
              const val = Number(e.target.value);
              audit.setAuditLimit(val);
              void audit.refreshAudit(val);
            }}
            className="text-xs bg-bg-primary border border-border rounded px-2 py-1 text-fg-muted"
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
        <ActivityTimeline events={audit.auditEvents} onLoadMore={audit.loadMoreAudit} hasMore={audit.auditHasMore} members={projectMembers} />
      </div>
    </div>
  );
}

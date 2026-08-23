"use client";

import { memo, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api-fetch";
import { TagPicker } from "@/components/tags/tag-picker";
import { TaskCustomFieldsCard } from "@/components/task/task-custom-fields-card";
import { TaskRecurrenceEditor } from "@/components/task/task-recurrence-editor";
import type { RecurrenceRule } from "@/lib/tasks/recurrence";
import { TaskWatchersCard } from "@/components/task/task-watchers-card";
import { TaskDetailsCard } from "@/components/task/task-detail-details-card";
import { TaskApprovalCard } from "@/components/task/task-detail-approval-card";
import { TaskDatesCard } from "@/components/task/task-detail-dates-card";

type TaskStatus = "open" | "in_progress" | "pending_approval" | "done" | "cancelled";
type TaskPriority = "low" | "med" | "high" | "urgent";

type Member = { id: string; displayName: string; avatarUrl?: string | null };

type CustomFieldDef = {
  id: string;
  key: string;
  name: string;
  type: "text" | "number" | "date" | "select" | "multi_select" | "user" | "checkbox" | "url";
  required: boolean;
  config: Record<string, unknown>;
};

type Watcher = { id: string; displayName: string; avatarUrl?: string | null; addedAt: string };

type TaskDetailSidebarProps = {
  task: {
    id: string;
    projectId: string;
    status: TaskStatus;
    priority: TaskPriority;
    startDate: string | null;
    endDate: string | null;
    dueDate: string | null;
    estimatedHours?: number | null;
    spentHours?: number | null;
    requiresApproval?: boolean;
    approverId?: string | null;
    recurrenceRule?: string | null;
    recurrenceParentId?: string | null;
    assignees: { id: string }[];
    assigneeGroup: { id: string; name: string } | null;
    reporter: { id: string; displayName: string } | null;
    createdAt: string;
    updatedAt: string;
  };
  projectMembers: Member[];
  currentUserId: string;
  customFieldSchema: CustomFieldDef[];
  cfValues: Record<string, unknown>;
  taskTagIds: string[];
  watchers: Watcher[];
  isWatching: boolean;
  durationDays: number;
  durationHours: number;
  onAssigneeChange: (_ids: string[]) => void;
  onGroupChange: (_groupId: string | null) => void;
  onEstimatedChange: (_value: number | null) => void;
  onSpentChange: (_value: number | null) => void;
  onRequiresApprovalChange: (_value: boolean) => void;
  onApproverChange: (_userId: string | null) => void;
  onRecurrenceChange: (_rule: RecurrenceRule | null) => void;
  onStartDateChange: (_value: string | null) => void;
  onDueDateChange: (_value: string | null) => void;
  onEndDateChange: (_value: string | null) => void;
  onDurationChange: (_days: number, _hours: number) => void;
  onTagsChange: (_ids: string[]) => void;
  onCustomFieldChange: (_key: string, _value: unknown) => Promise<void>;
  onToggleWatch: () => void;
  onAddWatcher: (_userId: string) => void;
  onRemoveWatcher: (_userId: string) => void;
};

export const TaskDetailSidebar = memo(function TaskDetailSidebar({
  task,
  projectMembers,
  currentUserId,
  customFieldSchema,
  cfValues,
  taskTagIds,
  watchers,
  isWatching,
  durationDays,
  durationHours,
  onAssigneeChange,
  onGroupChange,
  onEstimatedChange,
  onSpentChange,
  onRequiresApprovalChange,
  onApproverChange,
  onRecurrenceChange,
  onStartDateChange,
  onDueDateChange,
  onEndDateChange,
  onDurationChange,
  onTagsChange,
  onCustomFieldChange,
  onToggleWatch,
  onAddWatcher,
  onRemoveWatcher,
}: TaskDetailSidebarProps) {
  const t = useTranslations("task");
  const [groups, setGroups] = useState<{ id: string; name: string }[] | null>(null);

  // The group picker is available to users who can list groups (group:manage
  // or scoped managers); a 403 hides it. The current group is always shown.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await apiFetch("/api/v1/groups");
        if (res.ok) {
          const json = (await res.json()) as { data?: { id: string; name: string }[] };
          if (active) setGroups(json.data ?? []);
        } else if (active) {
          setGroups([]);
        }
      } catch {
        if (active) setGroups([]);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="space-y-4">
      {/* Details card */}
      <TaskDetailsCard
        assignees={task.assignees}
        assigneeGroup={task.assigneeGroup}
        groups={groups}
        reporter={task.reporter}
        spentHours={task.spentHours ?? null}
        projectMembers={projectMembers}
        onAssigneeChange={onAssigneeChange}
        onGroupChange={onGroupChange}
        onSpentChange={onSpentChange}
      />

      {/* Approval card */}
      <TaskApprovalCard
        requiresApproval={task.requiresApproval ?? false}
        approverId={task.approverId ?? null}
        projectMembers={projectMembers}
        onRequiresApprovalChange={onRequiresApprovalChange}
        onApproverChange={onApproverChange}
      />

      {/* Date & Duration card */}
      <TaskDatesCard
        startDate={task.startDate}
        endDate={task.endDate}
        dueDate={task.dueDate}
        estimatedHours={task.estimatedHours ?? null}
        durationDays={durationDays}
        durationHours={durationHours}
        createdAt={task.createdAt}
        updatedAt={task.updatedAt}
        onStartDateChange={onStartDateChange}
        onDueDateChange={onDueDateChange}
        onEndDateChange={onEndDateChange}
        onDurationChange={onDurationChange}
        onEstimatedChange={onEstimatedChange}
      />

      {/* Recurrence card */}
      <div className="border border-border-primary rounded-xl bg-bg-surface p-5">
        <h4 className="text-xs font-medium text-fg-muted uppercase tracking-wide mb-2">
          {t("recurrence.title")}
        </h4>
        <TaskRecurrenceEditor
          recurrenceRule={task.recurrenceRule ?? null}
          recurrenceParentId={task.recurrenceParentId ?? null}
          onRecurrenceChange={onRecurrenceChange}
        />
      </div>

      {/* Tags card */}
      <div className="border border-border-primary rounded-xl bg-bg-surface p-5">
        <h4 className="text-xs font-medium text-fg-muted uppercase tracking-wide mb-2">
          {t("tags")}
        </h4>
        <TagPicker projectId={task.projectId} value={taskTagIds} onChange={onTagsChange} />
      </div>

      {/* Custom Fields card */}
      <TaskCustomFieldsCard
        schema={customFieldSchema}
        values={cfValues}
        onChange={onCustomFieldChange}
      />

      {/* Watchers card */}
      <TaskWatchersCard
        watchers={watchers}
        projectMembers={projectMembers}
        currentUserId={currentUserId}
        isWatching={isWatching}
        onAddWatcher={onAddWatcher}
        onRemoveWatcher={onRemoveWatcher}
        onToggleWatch={onToggleWatch}
      />
    </div>
  );
});
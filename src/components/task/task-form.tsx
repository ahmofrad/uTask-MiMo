"use client";

import { memo, useState } from "react";
import { useTranslations } from "next-intl";
import { normalizeTaskDate } from "@/lib/date/task-date";
import { estimatedDaysToHours, estimatedHoursToDays } from "@/lib/date/estimated-time";
import { TagPicker } from "@/components/tags/tag-picker";
import { TaskScheduleFields } from "@/components/task/task-schedule-fields";
import { TaskDependencyPicker } from "@/components/task/task-dependency-picker";
import { TaskAssigneePanel } from "@/components/task/task-assignee-panel";
import { TaskFormFooter } from "@/components/task/task-form-footer";

type Member = { id: string; displayName: string; avatarUrl?: string | null };

type TaskFormProps = {
  projectId?: string;
  initialMembers?: Member[];
  initialData?: {
    title?: string;
    description?: string;
    status?: string;
    priority?: string;
    assigneeIds?: string[];
    assigneeGroupId?: string | null;
    dueDate?: string | null;
    estimatedHours?: number;
    tagIds?: string[];
  };
  onSubmit: (_data: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
};

const isCreateMode = (initialData?: TaskFormProps["initialData"]): boolean => !initialData;

export const TaskForm = memo(function TaskForm({
  projectId,
  initialMembers,
  initialData,
  onSubmit,
  onCancel,
}: TaskFormProps) {
  const t = useTranslations("task");
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState(initialData?.title ?? "");
  const [description, setDescription] = useState(initialData?.description ?? "");
  const [status, setStatus] = useState(initialData?.status ?? "open");
  const [priority, setPriority] = useState(initialData?.priority ?? "med");
  const [dueDate, setDueDate] = useState(initialData?.dueDate ?? "");
  const [estimatedDays, setEstimatedDays] = useState(
    estimatedHoursToDays(initialData?.estimatedHours)?.toString() ?? "",
  );
  const [tagIds, setTagIds] = useState<string[]>(initialData?.tagIds ?? []);
  const [assigneeIds, setAssigneeIds] = useState<string[]>(initialData?.assigneeIds ?? []);
  const [assigneeGroupId, setAssigneeGroupId] = useState<string | null>(
    initialData?.assigneeGroupId ?? null,
  );
  const [startDate, setStartDate] = useState("");
  const [dependsOnId, setDependsOnId] = useState("");
  const [suggestedByDependency, setSuggestedByDependency] = useState(false);
  const createMode = isCreateMode(initialData);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setLoading(true);
    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim() || null,
        projectId,
        status,
        priority,
        assigneeIds,
        assigneeGroupId,
        dueDate: normalizeTaskDate(dueDate || null),
        ...(createMode ? { startDate: normalizeTaskDate(startDate || null) } : {}),
        ...(createMode && dependsOnId ? { dependsOnId } : {}),
        estimatedHours: estimatedDaysToHours(estimatedDays ? Number(estimatedDays) : null),
        tagIds: tagIds.length > 0 ? tagIds : undefined,
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-fg-secondary mb-1.5">
          {t("fields.title")} *
        </label>
        <input
          type="text"
          data-testid="task-form-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full px-3 py-2 border border-border-primary rounded-lg bg-bg-surface text-fg-primary text-sm"
          autoFocus
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-fg-secondary mb-1.5">
          {t("fields.description")}
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 border border-border-primary rounded-lg bg-bg-surface text-fg-primary text-sm resize-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-fg-secondary mb-1.5">
            {t("fields.status")}
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full px-3 py-2 border border-border-primary rounded-lg bg-bg-surface text-fg-primary text-sm"
          >
            <option value="open">{t("status.open")}</option>
            <option value="in_progress">{t("status.in_progress")}</option>
            <option value="done">{t("status.done")}</option>
            <option value="cancelled">{t("status.cancelled")}</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-fg-secondary mb-1.5">
            {t("fields.priority")}
          </label>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="w-full px-3 py-2 border border-border-primary rounded-lg bg-bg-surface text-fg-primary text-sm"
          >
            <option value="low">{t("priority.low")}</option>
            <option value="med">{t("priority.med")}</option>
            <option value="high">{t("priority.high")}</option>
            <option value="urgent">{t("priority.urgent")}</option>
          </select>
        </div>
      </div>

      {createMode && projectId && (
        <TaskDependencyPicker
          projectId={projectId}
          value={dependsOnId}
          startDate={startDate}
          onChange={setDependsOnId}
          onStartDateSuggest={(s) => {
            setStartDate(s);
            setSuggestedByDependency(true);
          }}
        />
      )}

      <TaskScheduleFields
        createMode={createMode}
        startDate={startDate}
        dueDate={dueDate}
        estimatedDays={estimatedDays}
        suggestedByDependency={suggestedByDependency}
        onStartDateChange={(value) => {
          setStartDate(value ?? "");
          setSuggestedByDependency(false);
        }}
        onDueDateChange={(value) => setDueDate(value ?? "")}
        onEstimatedDaysChange={setEstimatedDays}
      />

      {projectId && (
        <div>
          <label className="block text-sm font-medium text-fg-secondary mb-1.5">
            {t("fields.tags")}
          </label>
          <TagPicker projectId={projectId} value={tagIds} onChange={setTagIds} />
        </div>
      )}

      {projectId && (
        <TaskAssigneePanel
          projectId={projectId}
          initialMembers={initialMembers}
          assigneeIds={assigneeIds}
          assigneeGroupId={assigneeGroupId}
          onAssigneeIdsChange={setAssigneeIds}
          onAssigneeGroupIdChange={setAssigneeGroupId}
        />
      )}

      <TaskFormFooter
        loading={loading}
        disabled={loading || !title.trim()}
        onCancel={onCancel}
      />
    </form>
  );
});

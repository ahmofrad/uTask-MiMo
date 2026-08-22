"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api-fetch";
import { normalizeTaskDate } from "@/lib/date/task-date";
import { estimatedDaysToHours, estimatedHoursToDays } from "@/lib/date/estimated-time";
import { JalaliDatePicker } from "@/components/ui/jalali-date-picker";
import { TagPicker } from "@/components/tags/tag-picker";
import { AssigneeSelect } from "@/components/task/assignee-select";

type Member = { id: string; displayName: string; avatarUrl?: string | null };
type GroupOption = { id: string; name: string };
type TaskCandidate = { id: string; title: string; startDate: string | null; dueDate: string | null };

// Only shown when creating a task (not when editing an existing one).
const isCreateMode = (initialData?: TaskFormProps["initialData"]): boolean => !initialData;

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

export function TaskForm({ projectId, initialMembers, initialData, onSubmit, onCancel }: TaskFormProps) {
  const t = useTranslations("task");
  const tc = useTranslations("common");
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
  const [assigneeGroupId, setAssigneeGroupId] = useState<string | null>(initialData?.assigneeGroupId ?? null);
  const [members, setMembers] = useState<Member[]>(initialMembers ?? []);
  const [groups, setGroups] = useState<GroupOption[] | null>(null);
  const [startDate, setStartDate] = useState("");
  const [dependsOnId, setDependsOnId] = useState("");
  const [taskCandidates, setTaskCandidates] = useState<TaskCandidate[]>([]);
  const [suggestedByDependency, setSuggestedByDependency] = useState(false);
  const createMode = isCreateMode(initialData);

  useEffect(() => {
    if (initialMembers) {
      setMembers(initialMembers);
      return;
    }
    if (!projectId) return;
    let active = true;
    (async () => {
      try {
        const res = await apiFetch(`/api/v1/projects/${projectId}/members`);
        const json = (await res.json()) as {
          data?: { user: { id: string; displayName: string; avatarUrl?: string | null } }[];
        };
        if (active) setMembers((json.data ?? []).map((m) => m.user));
      } catch {
        /* non-fatal: assignee picker stays empty */
      }
    })();
    return () => {
      active = false;
    };
  }, [projectId, initialMembers]);

  // When creating a task inside a project, load sibling tasks so the user can
  // pick a predecessor; choosing one suggests a start date from its end.
  useEffect(() => {
    if (!createMode || !projectId) return;
    let active = true;
    (async () => {
      try {
        const res = await apiFetch(`/api/v1/tasks?projectId=${projectId}&limit=200`);
        if (res.ok) {
          const json = (await res.json()) as { data?: TaskCandidate[] };
          if (active) setTaskCandidates(json.data ?? []);
        }
      } catch {
        /* non-fatal: predecessor picker stays empty */
      }
    })();
    return () => {
      active = false;
    };
  }, [createMode, projectId]);

  const handleDependsOnChange = (value: string) => {
    setDependsOnId(value);
    if (!value) return;
    const candidate = taskCandidates.find((c) => c.id === value);
    // Suggest the earliest moment the dependency allows: right after the
    // predecessor finishes (its due date, falling back to its start).
    const end = candidate?.dueDate ?? candidate?.startDate ?? null;
    if (end) {
      setStartDate(end);
      setSuggestedByDependency(true);
    }
  };

  // Group picker is available to users who can list groups (group:manage or
  // scoped managers); a 403 hides it silently.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await apiFetch("/api/v1/groups");
        if (res.ok) {
          const json = (await res.json()) as { data?: GroupOption[] };
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

      {createMode && (
        <div>
          <label className="block text-sm font-medium text-fg-secondary mb-1.5">
            {t("dependsOn")}
          </label>
          <select
            data-testid="task-form-depends-on"
            value={dependsOnId}
            onChange={(e) => handleDependsOnChange(e.target.value)}
            className="w-full px-3 py-2 border border-border-primary rounded-lg bg-bg-surface text-fg-primary text-sm"
          >
            <option value="">{t("noDependsOn")}</option>
            {taskCandidates.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.title}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        {createMode && (
          <div>
            <label className="block text-sm font-medium text-fg-secondary mb-1.5">
              {t("fields.startDate")}
            </label>
            <JalaliDatePicker
              testId="task-form-start-date"
              value={startDate}
              onChange={(val) => {
                setStartDate(val ?? "");
                setSuggestedByDependency(false);
              }}
            />
            {suggestedByDependency && (
              <span data-testid="task-form-suggested-date" className="text-xs text-accent block mt-1">
                {t("suggestedFromDependency")}
              </span>
            )}
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-fg-secondary mb-1.5">
            {t("fields.dueDate")}
          </label>
          <JalaliDatePicker
            value={dueDate}
            onChange={(val) => setDueDate(val ?? "")}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-fg-secondary mb-1.5">
            {t("fields.estimatedHours")}
          </label>
          <input
            type="number"
            value={estimatedDays}
            onChange={(e) => setEstimatedDays(e.target.value)}
            min="0"
            step="0.5"
            className="w-full px-3 py-2 border border-border-primary rounded-lg bg-bg-surface text-fg-primary text-sm"
          />
          <span className="text-xs text-fg-subtle block mt-0.5">{t("days")}</span>
        </div>
      </div>

      {projectId && (
        <div>
          <label className="block text-sm font-medium text-fg-secondary mb-1.5">
            {t("fields.tags")}
          </label>
          <TagPicker projectId={projectId} value={tagIds} onChange={setTagIds} />
        </div>
      )}

      {projectId && (
        <div>
          <label className="block text-sm font-medium text-fg-secondary mb-1.5">
            {t("fields.assignees")}
          </label>
          {members.length === 0 ? (
            <p className="text-xs text-fg-muted">{t("noMembers")}</p>
          ) : (
            <AssigneeSelect
              members={members}
              value={assigneeIds}
              onChange={setAssigneeIds}
              placeholder={t("searchMembers")}
            />
          )}
        </div>
      )}

      {projectId && groups !== null && (
        <div>
          <label className="block text-sm font-medium text-fg-secondary mb-1.5">
            {t("fields.assigneeGroup")}
          </label>
          <select
            value={assigneeGroupId ?? ""}
            onChange={(e) => setAssigneeGroupId(e.target.value || null)}
            className="w-full px-3 py-2 border border-border-primary rounded-lg bg-bg-surface text-fg-primary text-sm"
          >
            <option value="">{t("fields.noAssigneeGroup")}</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>{group.name}</option>
            ))}
          </select>
        </div>
      )}

      <div className="flex justify-end gap-3 pt-4 border-t border-border-primary">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium rounded-md border border-border-primary text-fg-secondary hover:bg-bg-surface transition-colors"
        >
          {tc("cancel")}
        </button>
        <button
          type="submit"
          disabled={loading || !title.trim()}
          className="px-4 py-2 text-sm font-medium rounded-md bg-accent text-fg-inverse hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {loading ? tc("loading") : tc("save")}
        </button>
      </div>
    </form>
  );
}

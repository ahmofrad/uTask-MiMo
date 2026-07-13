"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api-fetch";
import { JalaliDatePicker } from "@/components/ui/jalali-date-picker";
import { TagPicker } from "@/components/tags/tag-picker";
import { AssigneeSelect } from "@/components/task/assignee-select";

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
  const [estimatedHours, setEstimatedHours] = useState(initialData?.estimatedHours?.toString() ?? "");
  const [tagIds, setTagIds] = useState<string[]>(initialData?.tagIds ?? []);
  const [assigneeIds, setAssigneeIds] = useState<string[]>(initialData?.assigneeIds ?? []);
  const [members, setMembers] = useState<Member[]>(initialMembers ?? []);

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
        const json = (await res.json()) as { data?: Member[] };
        if (active) setMembers(json.data ?? []);
      } catch {
        /* non-fatal: assignee picker stays empty */
      }
    })();
    return () => {
      active = false;
    };
  }, [projectId, initialMembers]);

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
        dueDate: dueDate || null,
        estimatedHours: estimatedHours ? Number(estimatedHours) : null,
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

      <div className="grid grid-cols-2 gap-4">
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
            value={estimatedHours}
            onChange={(e) => setEstimatedHours(e.target.value)}
            min="0"
            step="0.5"
            className="w-full px-3 py-2 border border-border-primary rounded-lg bg-bg-surface text-fg-primary text-sm"
          />
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

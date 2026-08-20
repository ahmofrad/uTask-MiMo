"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import { apiFetch } from "@/lib/api-fetch";
import { formatDateTime } from "@/lib/date/format";
import { estimatedDaysToHours, estimatedHoursToDays } from "@/lib/date/estimated-time";
import { TagPicker } from "@/components/tags/tag-picker";
import { JalaliDatePicker } from "@/components/ui/jalali-date-picker";
import { CustomFieldInput } from "@/components/custom-field/custom-field-input";
import { AssigneeSelect } from "@/components/task/assignee-select";
import { Avatar } from "@/components/ui/avatar";

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

export function TaskDetailSidebar({
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
  const t = useTranslations();
  const locale = useLocale() as "fa-IR" | "en-US";
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
      <div className="border border-border-primary rounded-xl bg-bg-surface p-5 space-y-4">
        <h4 className="text-xs font-medium text-fg-muted uppercase tracking-wide">
          {t("task.fields.assignees")}
        </h4>
        <AssigneeSelect
          members={projectMembers}
          value={task.assignees.map((a) => a.id)}
          onChange={onAssigneeChange}
          placeholder={t("task.searchMembers")}
        />

        {groups !== null && (
          <div className="border-t border-border-secondary pt-3">
            <h4 className="text-xs text-fg-muted font-medium mb-1">
              {t("task.fields.assigneeGroup")}
            </h4>
            <select
              value={task.assigneeGroup?.id ?? ""}
              onChange={(e) => onGroupChange(e.target.value || null)}
              className="w-full text-sm bg-bg-primary border border-border rounded-lg px-2 py-1.5 text-fg"
            >
              <option value="">{t("task.noAssigneeGroup")}</option>
              {groups.some(
                (group) => group.id === task.assigneeGroup?.id,
              ) ? null : task.assigneeGroup ? (
                <option key={task.assigneeGroup.id} value={task.assigneeGroup.id}>
                  {task.assigneeGroup.name}
                </option>
              ) : null}
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {task.reporter && (
          <>
            <div className="border-t border-border-secondary pt-3">
              <h4 className="text-xs font-medium text-fg-muted mb-1">{t("task.reporter")}</h4>
              <p className="text-sm text-fg">{task.reporter.displayName}</p>
            </div>
          </>
        )}

        {task.spentHours != null && (
          <div className="border-t border-border-secondary pt-3">
            <h4 className="text-xs text-fg-muted font-medium mb-1">{t("task.spent")}</h4>
            <input
              type="number"
              value={task.spentHours ?? ""}
              onChange={(e) => {
                const val = e.target.value ? Number(e.target.value) : null;
                onSpentChange(val);
              }}
              className="w-full text-sm bg-bg-primary border border-border rounded-lg px-2 py-1 text-fg"
            />
          </div>
        )}
      </div>

      {/* Approval card */}
      <div className="border border-border-primary rounded-xl bg-bg-surface p-5 space-y-3">
        <h4 className="text-xs font-medium text-fg-muted uppercase tracking-wide">
          {t("approval.title")}
        </h4>
        <label className="flex items-center gap-2 text-sm text-fg cursor-pointer">
          <input
            type="checkbox"
            checked={task.requiresApproval ?? false}
            onChange={(e) => onRequiresApprovalChange(e.target.checked)}
            className="w-4 h-4 accent-[var(--accent)]"
          />
          {t("approval.requiresApproval")}
        </label>
        {task.requiresApproval && (
          <div>
            <label className="text-xs text-fg-muted block mb-1">{t("approval.approver")}</label>
            <select
              value={task.approverId ?? ""}
              onChange={(e) => onApproverChange(e.target.value || null)}
              className="w-full text-sm bg-bg-primary border border-border rounded-lg px-2 py-1 text-fg"
            >
              <option value="">{t("approval.anyFinalizer")}</option>
              {projectMembers.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.displayName}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Date & Duration card */}
      <div className="border border-border-primary rounded-xl bg-bg-surface p-5 space-y-3">
        <h4 className="text-xs font-medium text-fg-muted uppercase tracking-wide">
          {t("task.dateAndDuration")}
        </h4>
        <div className="space-y-2">
          <div>
            <label className="text-xs text-fg-muted block mb-1">{t("task.startDate")}</label>
            <JalaliDatePicker
              value={task.startDate?.split("T")[0] ?? null}
              onChange={onStartDateChange}
              placeholder={t("task.selectDate")}
              className="w-full"
            />
          </div>
          <div>
            <label className="text-xs text-fg-muted block mb-1">{t("task.fields.dueDate")}</label>
            <JalaliDatePicker
              value={task.dueDate?.split("T")[0] ?? null}
              onChange={onDueDateChange}
              placeholder={t("task.selectDate")}
              className="w-full"
            />
          </div>
          <div>
            <label className="text-xs text-fg-muted block mb-1">{t("task.endDate")}</label>
            <JalaliDatePicker
              value={task.endDate?.split("T")[0] ?? null}
              onChange={onEndDateChange}
              placeholder={t("task.selectDate")}
              className="w-full"
            />
          </div>
        </div>
        <div className="border-t border-border-secondary pt-2">
          <label className="text-xs text-fg-muted block mb-1">{t("task.duration")}</label>
          <div className="flex gap-2">
            <div className="flex-1">
              <input
                type="number"
                min={0}
                value={durationDays}
                onChange={(e) => {
                  const days = Math.max(0, Number(e.target.value) || 0);
                  onDurationChange(days, durationHours);
                }}
                className="w-full text-sm bg-bg-primary border border-border rounded-lg px-2 py-1.5 text-fg"
                placeholder="0"
              />
              <span className="text-xs text-fg-subtle block mt-0.5">{t("task.days")}</span>
            </div>
            <div className="flex-1">
              <input
                type="number"
                min={0}
                max={23}
                value={durationHours}
                onChange={(e) => {
                  const hours = Math.max(0, Math.min(23, Number(e.target.value) || 0));
                  onDurationChange(durationDays, hours);
                }}
                className="w-full text-sm bg-bg-primary border border-border rounded-lg px-2 py-1.5 text-fg"
                placeholder="0"
              />
              <span className="text-xs text-fg-subtle block mt-0.5">{t("task.hours")}</span>
            </div>
          </div>
        </div>
        {task.estimatedHours != null && (
          <div className="border-t border-border-secondary pt-3">
            <h4 className="text-xs text-fg-muted font-medium mb-1">{t("task.estimated")}</h4>
            <input
              type="number"
              min={0}
              step={0.5}
              value={estimatedHoursToDays(task.estimatedHours) ?? ""}
              onChange={(e) => {
                const days = e.target.value ? Number(e.target.value) : null;
                const val = estimatedDaysToHours(days) ?? null;
                onEstimatedChange(val);
              }}
              className="w-full text-sm bg-bg-primary border border-border rounded-lg px-2 py-1 text-fg"
            />
            <span className="text-xs text-fg-subtle block mt-0.5">{t("task.days")}</span>
          </div>
        )}
        <div className="border-t border-border-secondary pt-3 text-xs text-fg-muted space-y-1">
          <p>
            {t("task.createdAt")}: {formatDateTime(new Date(task.createdAt), locale)}
          </p>
          <p>
            {t("task.updatedAt")}: {formatDateTime(new Date(task.updatedAt), locale)}
          </p>
        </div>
      </div>

      {/* Tags card */}
      <div className="border border-border-primary rounded-xl bg-bg-surface p-5">
        <h4 className="text-xs font-medium text-fg-muted uppercase tracking-wide mb-2">
          {t("task.tags")}
        </h4>
        <TagPicker projectId={task.projectId} value={taskTagIds} onChange={onTagsChange} />
      </div>

      {/* Custom Fields card */}
      {customFieldSchema.length > 0 && (
        <div className="border border-border-primary rounded-xl bg-bg-surface p-5">
          <h4 className="text-xs font-medium text-fg-muted uppercase tracking-wide mb-3">
            {t("task.customFields")}
          </h4>
          <div className="space-y-3">
            {customFieldSchema.map((field) => (
              <CustomFieldInput
                key={field.id}
                field={field}
                value={cfValues[field.key] ?? null}
                onChange={(value) => void onCustomFieldChange(field.key, value)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Watchers card */}
      <div className="border border-border-primary rounded-xl bg-bg-surface p-5">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs font-medium text-fg-muted uppercase tracking-wide">
            {t("task.watchers")}
          </h4>
          <div className="flex items-center gap-2">
            <select
              onChange={(e) => {
                const userId = e.target.value;
                e.target.value = "";
                if (userId) onAddWatcher(userId);
              }}
              className="text-xs bg-transparent border border-border-primary rounded px-1.5 py-0.5 text-fg-muted"
            >
              <option value="">+ {t("task.addWatcher")}</option>
              {projectMembers
                .filter((m) => !watchers.some((w) => w.id === m.id))
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.displayName}
                  </option>
                ))}
            </select>
            <button
              onClick={onToggleWatch}
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
                    onClick={() => onRemoveWatcher(w.id)}
                    className="text-xs text-fg-muted opacity-0 group-hover:opacity-100 hover:text-destructive transition-[opacity,color]"
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
  );
}

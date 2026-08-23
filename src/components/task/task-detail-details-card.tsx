"use client";

import { useTranslations } from "next-intl";
import { AssigneeSelect } from "@/components/task/assignee-select";

type Member = { id: string; displayName: string; avatarUrl?: string | null };
type Group = { id: string; name: string };

type Props = {
  assignees: { id: string }[];
  assigneeGroup: Group | null;
  groups: Group[] | null;
  reporter: { id: string; displayName: string } | null;
  spentHours: number | null;
  projectMembers: Member[];
  onAssigneeChange: (_ids: string[]) => void;
  onGroupChange: (_groupId: string | null) => void;
  onSpentChange: (_value: number | null) => void;
};

export function TaskDetailsCard({
  assignees,
  assigneeGroup,
  groups,
  reporter,
  spentHours,
  projectMembers,
  onAssigneeChange,
  onGroupChange,
  onSpentChange,
}: Props) {
  const t = useTranslations("task");

  return (
    <div className="border border-border-primary rounded-xl bg-bg-surface p-5 space-y-4">
      <h4 className="text-xs font-medium text-fg-muted uppercase tracking-wide">
        {t("fields.assignees")}
      </h4>
      <AssigneeSelect
        members={projectMembers}
        value={assignees.map((a) => a.id)}
        onChange={onAssigneeChange}
        placeholder={t("searchMembers")}
      />

      {groups !== null && (
        <div className="border-t border-border-secondary pt-3">
          <h4 className="text-xs text-fg-muted font-medium mb-1">{t("fields.assigneeGroup")}</h4>
          <select
            value={assigneeGroup?.id ?? ""}
            onChange={(e) => onGroupChange(e.target.value || null)}
            className="w-full text-sm bg-bg-primary border border-border rounded-lg px-2 py-1.5 text-fg"
          >
            <option value="">{t("fields.noAssigneeGroup")}</option>
            {groups.some((group) => group.id === assigneeGroup?.id) ? null : assigneeGroup ? (
              <option key={assigneeGroup.id} value={assigneeGroup.id}>
                {assigneeGroup.name}
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

      {reporter && (
        <div className="border-t border-border-secondary pt-3">
          <h4 className="text-xs font-medium text-fg-muted mb-1">{t("reporter")}</h4>
          <p className="text-sm text-fg">{reporter.displayName}</p>
        </div>
      )}

      {spentHours != null && (
        <div className="border-t border-border-secondary pt-3">
          <h4 className="text-xs text-fg-muted font-medium mb-1">{t("spent")}</h4>
          <input
            type="number"
            value={spentHours}
            onChange={(e) => {
              const val = e.target.value ? Number(e.target.value) : null;
              onSpentChange(val);
            }}
            className="w-full text-sm bg-bg-primary border border-border rounded-lg px-2 py-1 text-fg"
          />
        </div>
      )}
    </div>
  );
}
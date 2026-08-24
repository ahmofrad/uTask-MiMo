"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api-fetch";
import { AssigneeSelect } from "@/components/task/assignee-select";

type Member = { id: string; displayName: string; avatarUrl?: string | null };
type GroupOption = { id: string; name: string };

type TaskAssigneePanelProps = {
  projectId: string;
  initialMembers?: Member[] | undefined;
  assigneeIds: string[];
  assigneeGroupId: string | null;
  onAssigneeIdsChange: (_ids: string[]) => void;
  onAssigneeGroupIdChange: (_id: string | null) => void;
};

export function TaskAssigneePanel({
  projectId,
  initialMembers,
  assigneeIds,
  assigneeGroupId,
  onAssigneeIdsChange,
  onAssigneeGroupIdChange,
}: TaskAssigneePanelProps) {
  const t = useTranslations("task");
  const [members, setMembers] = useState<Member[]>(initialMembers ?? []);
  const [groups, setGroups] = useState<GroupOption[] | null>(null);

  // Load members
  useEffect(() => {
    if (initialMembers) {
      setMembers(initialMembers);
      return;
    }
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

  // Load groups
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

  return (
    <>
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
            onChange={onAssigneeIdsChange}
            placeholder={t("searchMembers")}
          />
        )}
      </div>

      {groups !== null && (
        <div>
          <label className="block text-sm font-medium text-fg-secondary mb-1.5">
            {t("fields.assigneeGroup")}
          </label>
          <select
            value={assigneeGroupId ?? ""}
            onChange={(e) => onAssigneeGroupIdChange(e.target.value || null)}
            className="w-full px-3 py-2 border border-border-primary rounded-lg bg-bg-surface text-fg-primary text-sm"
          >
            <option value="">{t("fields.noAssigneeGroup")}</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>{group.name}</option>
            ))}
          </select>
        </div>
      )}
    </>
  );
}

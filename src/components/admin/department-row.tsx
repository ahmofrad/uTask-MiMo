"use client";

import { memo } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export type Department = {
  id: string;
  name: string;
  parentId: string | null;
  managerUserId: string | null;
  managerSource?: "ad" | "manual" | null;
  managerName?: string | null;
  source?: "manual" | "ldap";
  ldapSyncGroupId?: string | null;
  projectsCount: number;
  memberCount: number;
};

export type ManagerCandidate = {
  id: string;
  displayName: string;
  email: string;
};

export type DepartmentMember = {
  id: string;
  displayName: string;
  email: string;
};

type Props = {
  department: Department;
  level: number;
  managerCandidates: Record<string, ManagerCandidate[]>;
  parentOptionsMap: Map<string, Department[]>;
  expandedMembers: Set<string>;
  deptMembers: Record<string, DepartmentMember[]>;
  allUsers: DepartmentMember[];
  childrenOf: (_parentId: string | null) => Department[];
  onSaveParent: (_id: string, _value: string) => void;
  onSaveManager: (_id: string, _value: string) => void;
  onRemoveDepartment: (_id: string) => void;
  onToggleMembers: (_id: string) => void;
  onAddMember: (_id: string, _userId: string) => void;
  onRemoveMember: (_id: string, _userId: string) => void;
  onRenderChild: (_department: Department, _level: number) => React.ReactNode;
};

export const DepartmentRow = memo(function DepartmentRow({
  department,
  level,
  managerCandidates,
  parentOptionsMap,
  expandedMembers,
  deptMembers,
  allUsers,
  childrenOf,
  onSaveParent,
  onSaveManager,
  onRemoveDepartment,
  onToggleMembers,
  onAddMember,
  onRemoveMember,
  onRenderChild,
}: Props) {
  const t = useTranslations("admin");
  const candidates = managerCandidates[department.id] ?? [];
  const managerOptions =
    department.managerUserId && !candidates.some((candidate) => candidate.id === department.managerUserId)
      ? [
          {
            id: department.managerUserId,
            displayName: department.managerName ?? "…",
            email: "",
          },
          ...candidates,
        ]
      : candidates;

  return (
    <div key={department.id}>
      <div
        className="flex flex-col gap-3 rounded-lg border border-border-primary p-3 sm:flex-row sm:items-center sm:justify-between"
        style={{ marginInlineStart: `${level * 24}px` }}
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-fg-primary">{department.name}</span>
            <span className="text-xs text-fg-tertiary">
              {department.ldapSyncGroupId ? t("ldapDepartment") : t("manualDepartment")}
            </span>
            {department.memberCount > 0 && (
              <span className="text-xs text-fg-tertiary">
                {t("membersCount", { count: department.memberCount })}
              </span>
            )}
            <span className="text-sm text-fg-secondary">
              {t("projectsCount", { count: department.projectsCount })}
            </span>
            {department.parentId && (
              <span className="text-xs text-fg-tertiary">{t("subgroup")}</span>
            )}
          </div>
          {department.managerName && (
            <p className="mt-1 text-xs text-fg-secondary">
              {department.managerName}
              {department.managerSource === "ad" && ` · ${t("managerFromAd")}`}
              {department.managerSource === "manual" && ` · ${t("managerManual")}`}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={department.parentId ?? ""}
            onChange={(e) => onSaveParent(department.id, e.target.value)}
            aria-label={`${t("moveToParent")}: ${department.name}`}
            className="max-w-56 rounded-md border border-border-primary bg-bg-primary px-2 py-1 text-sm text-fg-primary"
          >
            <option value="">{t("noParent")}</option>
            {(parentOptionsMap.get(department.id) ?? []).map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
          <select
            value={department.managerUserId ?? ""}
            onChange={(e) => onSaveManager(department.id, e.target.value)}
            aria-label={`${t("assignManager")}: ${department.name}`}
            title={t("managerHint")}
            className="max-w-64 rounded-md border border-border-primary bg-bg-primary px-2 py-1 text-sm text-fg-primary"
          >
            <option value="">{t("noManager")}</option>
            {managerOptions.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.displayName}
                {candidate.email ? ` (${candidate.email})` : ""}
              </option>
            ))}
          </select>
          <Button variant="ghost" size="sm" onClick={() => onRemoveDepartment(department.id)}>
            {t("archiveDepartment")}
          </Button>
        </div>
      </div>

      {/* Members Section — for non-LDAP departments only */}
      {!department.ldapSyncGroupId && (
        <div
          className="border-t border-border-primary mt-2 pt-2"
          style={{ marginInlineStart: `${level * 24}px` }}
        >
          <button
            type="button"
            onClick={() => onToggleMembers(department.id)}
            className="text-xs text-accent hover:underline"
          >
            {expandedMembers.has(department.id)
              ? t("hideMembers")
              : t("showMembers")}
          </button>
          {expandedMembers.has(department.id) && (
            <div className="mt-2 space-y-2">
              {/* Add member picker */}
              <select
                className="w-full max-w-64 rounded-md border border-border-primary bg-bg-primary px-2 py-1 text-sm text-fg-primary"
                value=""
                onChange={(e) => {
                  if (e.target.value) {
                    onAddMember(department.id, e.target.value);
                    e.target.value = "";
                  }
                }}
                aria-label={t("addMember")}
              >
                <option value="">{t("addMember")}…</option>
                {allUsers
                  .filter((u) => !(deptMembers[department.id] ?? []).some((m) => m.id === u.id))
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.displayName} ({u.email})
                    </option>
                  ))}
              </select>

              {/* Member list */}
              {(deptMembers[department.id] ?? []).length === 0 ? (
                <p className="text-xs text-fg-muted">{t("noGroupMembers")}</p>
              ) : (
                <div className="space-y-1">
                  {(deptMembers[department.id] ?? []).map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between gap-2 text-sm"
                    >
                      <span className="text-fg-primary truncate">
                        {member.displayName}
                        <span className="text-fg-muted text-xs ms-2">{member.email}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => onRemoveMember(department.id, member.id)}
                        title={t("removeMember", { name: member.displayName })}
                        className="text-xs text-destructive hover:underline shrink-0"
                      >
                        {t("remove")}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {childrenOf(department.id).map((child) => onRenderChild(child, level + 1))}
    </div>
  );
});
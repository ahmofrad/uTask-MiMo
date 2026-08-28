"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { DepartmentRow, type Department, type DepartmentMember, type ManagerCandidate } from "./department-row";
import { useDepartmentTree } from "./use-department-tree";

type Props = {
  departments: Department[];
};

/** All department ids at or below `rootId` (used to block cycle-creating moves). */
function collectSubtree(departments: Department[], rootId: string): Set<string> {
  const byParent = new Map<string | null, Department[]>();
  for (const department of departments) {
    const list = byParent.get(department.parentId) ?? [];
    list.push(department);
    byParent.set(department.parentId, list);
  }
  const result = new Set<string>([rootId]);
  const stack = [rootId];
  while (stack.length > 0) {
    const id = stack.pop()!;
    for (const child of byParent.get(id) ?? []) {
      if (!result.has(child.id)) {
        result.add(child.id);
        stack.push(child.id);
      }
    }
  }
  return result;
}

function parentOptions(departments: Department[], departmentId: string): Department[] {
  const excluded = collectSubtree(departments, departmentId);
  return departments.filter((department) => !excluded.has(department.id));
}

export function DepartmentTree({ departments: initial }: Props) {
  const t = useTranslations("admin");
  const {
    departments,
    newName,
    setNewName,
    newParentId,
    setNewParentId,
    managerCandidates,
    expandedMembers,
    deptMembers,
    allUsers,
    saveMessage,
    addDepartment,
    saveManager,
    saveParent,
    removeDepartment,
    toggleMembers,
    addMember,
    removeMember,
  } = useDepartmentTree({ initialDepartments: initial });

  const childrenOf = useMemo(() => {
    const fn = (parentId: string | null): Department[] =>
      departments
        .filter((department) => department.parentId === parentId)
        .sort((a, b) => a.name.localeCompare(b.name));
    return fn;
  }, [departments]);

  const roots = useMemo(() => childrenOf(null), [childrenOf]);

  const parentOptionsMap = useMemo(() => {
    const map = new Map<string, Department[]>();
    for (const department of departments) {
      map.set(department.id, parentOptions(departments, department.id));
    }
    return map;
  }, [departments]);

  const renderDepartment = (department: Department, level: number) => (
    <DepartmentRow
      key={department.id}
      department={department}
      level={level}
      managerCandidates={managerCandidates}
      parentOptionsMap={parentOptionsMap}
      expandedMembers={expandedMembers}
      deptMembers={deptMembers}
      allUsers={allUsers}
      childrenOf={childrenOf}
      onSaveParent={(id, value) => void saveParent(id, value)}
      onSaveManager={(id, value) => void saveManager(id, value)}
      onRemoveDepartment={(id) => void removeDepartment(id)}
      onToggleMembers={(id) => toggleMembers(id)}
      onAddMember={(id, userId) => void addMember(id, userId)}
      onRemoveMember={(id, userId) => void removeMember(id, userId)}
      onRenderChild={(child, childLevel) => renderDepartment(child, childLevel)}
    />
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder={t("newDepartment")}
          className="rounded-md border border-border-primary bg-bg-primary px-3 py-2 text-fg-primary"
          onKeyDown={(e) => e.key === "Enter" && addDepartment()}
        />
        <select
          value={newParentId}
          onChange={(e) => setNewParentId(e.target.value)}
          aria-label={t("parentDepartment")}
          className="rounded-md border border-border-primary bg-bg-primary px-3 py-2 text-fg-primary"
        >
          <option value="">{t("noParent")}</option>
          {departments.map((department) => (
            <option key={department.id} value={department.id}>{department.name}</option>
          ))}
        </select>
        <Button onClick={addDepartment}>{t("add")}</Button>
      </div>
      {saveMessage && <p className="text-sm text-status-success">{saveMessage}</p>}
      <div className="space-y-2">
        {roots.map((department) => renderDepartment(department, 0))}
        {departments.length === 0 && (
          <p className="text-sm text-fg-tertiary">{t("noDepartments")}</p>
        )}
      </div>
    </div>
  );
}

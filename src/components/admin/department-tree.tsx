"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-fetch";
import { DepartmentRow, type Department, type DepartmentMember, type ManagerCandidate } from "./department-row";

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
  const [departments, setDepartments] = useState(initial);
  const [newName, setNewName] = useState("");
  const [newParentId, setNewParentId] = useState("");
  const [managerCandidates, setManagerCandidates] = useState<Record<string, ManagerCandidate[]>>({});
  const [saveMessage, setSaveMessage] = useState("");
  const [expandedMembers, setExpandedMembers] = useState<Set<string>>(new Set());
  const [deptMembers, setDeptMembers] = useState<Record<string, DepartmentMember[]>>({});
  const [allUsers, setAllUsers] = useState<DepartmentMember[]>([]);
  const usersLoadStarted = useRef(false);

  useEffect(() => {
    if (usersLoadStarted.current) return;
    usersLoadStarted.current = true;
    apiFetch("/api/v1/users/search?q&limit=500")
      .then((r) => r.json())
      .then((j) => {
        const users: DepartmentMember[] = (j.data ?? []).map(
          (u: { id: string; displayName: string; email: string }) => ({ id: u.id, displayName: u.displayName, email: u.email }),
        );
        setAllUsers(users);
      })
      .catch(() => {});
  }, []);

  async function loadMembers(departmentId: string) {
    const res = await apiFetch(`/api/v1/departments/${departmentId}/members`);
    if (res.ok) {
      const body = (await res.json()) as { data?: DepartmentMember[] };
      setDeptMembers((prev) => ({ ...prev, [departmentId]: body.data ?? [] }));
    }
  }

  async function addMember(departmentId: string, userId: string) {
    await apiFetch(`/api/v1/departments/${departmentId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    await loadMembers(departmentId);
    setDepartments((prev) =>
      prev.map((d) =>
        d.id === departmentId ? { ...d, memberCount: d.memberCount + 1 } : d,
      ),
    );
  }

  async function removeMember(departmentId: string, userId: string) {
    await apiFetch(`/api/v1/departments/${departmentId}/members`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    await loadMembers(departmentId);
    setDepartments((prev) =>
      prev.map((d) =>
        d.id === departmentId ? { ...d, memberCount: Math.max(0, d.memberCount - 1) } : d,
      ),
    );
  }

  function toggleMembers(departmentId: string) {
    setExpandedMembers((prev) => {
      const next = new Set(prev);
      if (next.has(departmentId)) {
        next.delete(departmentId);
      } else {
        next.add(departmentId);
        void loadMembers(departmentId);
      }
      return next;
    });
  }

  useEffect(() => {
    let cancelled = false;
    void Promise.all(
      departments.map(async (department) => {
        const response = await apiFetch(`/api/v1/departments/${department.id}/manager-candidates`);
        if (!response.ok) return [department.id, []] as const;
        const body = (await response.json()) as { data?: ManagerCandidate[] };
        return [department.id, body.data ?? []] as const;
      }),
    ).then((entries) => {
      if (!cancelled) setManagerCandidates(Object.fromEntries(entries));
    });
    return () => {
      cancelled = true;
    };
  }, [departments]);

  async function addDepartment() {
    if (!newName.trim()) return;
    const body = {
      name: newName.trim(),
      ...(newParentId ? { parentId: newParentId } : {}),
    };
    const res = await apiFetch("/api/v1/departments", {
      method: "POST",
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const json = await res.json();
      setDepartments((prev) => [...prev, json.data]);
      setNewName("");
      setNewParentId("");
    }
  }

  async function saveManager(departmentId: string, value: string) {
    const res = await apiFetch(`/api/v1/departments/${departmentId}`, {
      method: "PATCH",
      body: JSON.stringify({ managerUserId: value || null }),
    });
    if (res.ok) {
      const json = await res.json();
      setDepartments((prev) => prev.map((department) => (
        department.id === departmentId
          ? {
              ...department,
              managerUserId: json.data.managerUserId,
              managerSource: json.data.managerSource ?? null,
            }
          : department
      )));
      setSaveMessage(t("managerSaved"));
      window.setTimeout(() => setSaveMessage(""), 2000);
    }
  }

  async function saveParent(departmentId: string, value: string) {
    const res = await apiFetch(`/api/v1/departments/${departmentId}`, {
      method: "PATCH",
      body: JSON.stringify({ parentId: value || null }),
    });
    if (res.ok) {
      const json = await res.json();
      setDepartments((prev) => prev.map((department) => (
        department.id === departmentId
          ? { ...department, parentId: json.data.parentId }
          : department
      )));
    }
  }

  async function removeDepartment(id: string) {
    const res = await apiFetch(`/api/v1/departments/${id}`, { method: "DELETE" });
    if (res.ok) {
      setDepartments((prev) => prev.filter((department) => department.id !== id));
    }
  }

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

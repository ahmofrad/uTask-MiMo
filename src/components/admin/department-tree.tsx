"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-fetch";

type Department = {
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

type ManagerCandidate = {
  id: string;
  displayName: string;
  email: string;
};

type DepartmentMember = {
  id: string;
  displayName: string;
  email: string;
};

let allUsersCache: DepartmentMember[] | null = null;

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

  useEffect(() => {
    if (allUsers.length > 0) return;
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

  function renderRow(department: Department, level: number) {
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
              onChange={(e) => void saveParent(department.id, e.target.value)}
              aria-label={`${t("moveToParent")}: ${department.name}`}
              className="max-w-56 rounded-md border border-border-primary bg-bg-primary px-2 py-1 text-sm text-fg-primary"
            >
              <option value="">{t("noParent")}</option>
              {parentOptions(departments, department.id).map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
            <select
              value={department.managerUserId ?? ""}
              onChange={(e) => void saveManager(department.id, e.target.value)}
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
            <Button variant="ghost" size="sm" onClick={() => void removeDepartment(department.id)}>
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
              onClick={() => toggleMembers(department.id)}
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
                      void addMember(department.id, e.target.value);
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
                          onClick={() => void removeMember(department.id, member.id)}
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

        {childrenOf(department.id).map((child) => renderRow(child, level + 1))}
      </div>
    );
  }

  function childrenOf(parentId: string | null): Department[] {
    return departments
      .filter((department) => department.parentId === parentId)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  const roots = childrenOf(null);

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
        {roots.map((department) => renderRow(department, 0))}
        {departments.length === 0 && (
          <p className="text-sm text-fg-tertiary">{t("noDepartments")}</p>
        )}
      </div>
    </div>
  );
}

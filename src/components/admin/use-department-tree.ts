"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api-fetch";
import type { Department, DepartmentMember, ManagerCandidate } from "./department-row";

export type UseDepartmentTreeOptions = {
  initialDepartments: Department[];
};

export type UseDepartmentTreeReturn = {
  departments: Department[];
  newName: string;
  setNewName: (name: string) => void;
  newParentId: string;
  setNewParentId: (id: string) => void;
  managerCandidates: Record<string, ManagerCandidate[]>;
  expandedMembers: Set<string>;
  deptMembers: Record<string, DepartmentMember[]>;
  allUsers: DepartmentMember[];
  saveMessage: string;
  addDepartment: () => Promise<void>;
  saveManager: (id: string, value: string) => Promise<void>;
  saveParent: (id: string, value: string) => Promise<void>;
  removeDepartment: (id: string) => Promise<void>;
  toggleMembers: (id: string) => void;
  addMember: (deptId: string, userId: string) => Promise<void>;
  removeMember: (deptId: string, userId: string) => Promise<void>;
};

export function useDepartmentTree({ initialDepartments }: UseDepartmentTreeOptions): UseDepartmentTreeReturn {
  const t = useTranslations("admin");
  const [departments, setDepartments] = useState(initialDepartments);
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
    apiFetch("/api/v1/departments/member-candidates")
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

  async function addMember(departmentId: string, userId: string) {
    const res = await apiFetch(`/api/v1/departments/${departmentId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    if (!res.ok) return;
    await loadMembers(departmentId);
    const body = (await res.json()) as { data?: { created?: boolean } };
    if (body.data?.created !== false) {
      setDepartments((prev) =>
        prev.map((d) =>
          d.id === departmentId ? { ...d, memberCount: d.memberCount + 1 } : d,
        ),
      );
    }
  }

  async function removeMember(departmentId: string, userId: string) {
    const res = await apiFetch(`/api/v1/departments/${departmentId}/members`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    if (!res.ok) return;
    await loadMembers(departmentId);
    setDepartments((prev) =>
      prev.map((d) =>
        d.id === departmentId ? { ...d, memberCount: Math.max(0, d.memberCount - 1) } : d,
      ),
    );
  }

  return {
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
  };
}

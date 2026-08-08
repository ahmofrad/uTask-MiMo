"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

type Department = {
  id: string;
  name: string;
  parentId: string | null;
  managerUserId: string | null;
  source?: "manual" | "ldap";
  ldapSyncGroupId?: string | null;
  _count: { projects: number };
};

type ManagerCandidate = {
  id: string;
  displayName: string;
  email: string;
};

type Props = {
  departments: Department[];
};

export function DepartmentTree({ departments: initial }: Props) {
  const t = useTranslations("admin");
  const [departments, setDepartments] = useState(initial);
  const [newName, setNewName] = useState("");
  const [parentId, setParentId] = useState("");
  const [managerCandidates, setManagerCandidates] = useState<Record<string, ManagerCandidate[]>>({});
  const [saveMessage, setSaveMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    const ldapDepartments = departments.filter((department) => department.ldapSyncGroupId);
    void Promise.all(
      ldapDepartments.map(async (department) => {
        const response = await fetch(`/api/v1/departments/${department.id}/manager-candidates`);
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
      ...(parentId ? { parentId } : {}),
    };
    const res = await fetch("/api/v1/departments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const json = await res.json();
      setDepartments((prev) => [...prev, json.data]);
      setNewName("");
      setParentId("");
    }
  }

  async function saveManager(departmentId: string, value: string) {
    const res = await fetch(`/api/v1/departments/${departmentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ managerUserId: value || null }),
    });
    if (res.ok) {
      const json = await res.json();
      setDepartments((prev) => prev.map((department) => (
        department.id === departmentId ? { ...department, managerUserId: json.data.managerUserId } : department
      )));
      setSaveMessage(t("managerSaved"));
      window.setTimeout(() => setSaveMessage(""), 2000);
    }
  }

  async function removeDepartment(id: string) {
    const res = await fetch(`/api/v1/departments/${id}`, { method: "DELETE" });
    if (res.ok) {
      setDepartments((prev) => prev.filter((department) => department.id !== id));
    }
  }

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
          value={parentId}
          onChange={(e) => setParentId(e.target.value)}
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
        {departments.map((department) => {
          const candidates = managerCandidates[department.id] ?? [];
          return (
            <div
              key={department.id}
              className="flex flex-col gap-3 rounded-lg border border-border-primary p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <span className="font-medium text-fg-primary">{department.name}</span>
                <span className="ms-3 text-sm text-fg-secondary">
                  {t("projectsCount", { count: department._count.projects })}
                </span>
                <span className="ms-3 text-xs text-fg-tertiary">
                  {department.ldapSyncGroupId ? t("ldapDepartment") : t("manualDepartment")}
                </span>
                {department.parentId && (
                  <span className="ms-3 text-xs text-fg-tertiary">{t("parentDepartment")}</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {department.ldapSyncGroupId && (
                  <select
                    value={department.managerUserId ?? ""}
                    onChange={(e) => void saveManager(department.id, e.target.value)}
                    aria-label={`${t("assignManager")}: ${department.name}`}
                    className="max-w-64 rounded-md border border-border-primary bg-bg-primary px-2 py-1 text-sm text-fg-primary"
                  >
                    <option value="">{t("noManager")}</option>
                    {candidates.map((candidate) => (
                      <option key={candidate.id} value={candidate.id}>
                        {candidate.displayName} ({candidate.email})
                      </option>
                    ))}
                  </select>
                )}
                <Button variant="ghost" size="sm" onClick={() => void removeDepartment(department.id)}>
                  {t("archiveDepartment")}
                </Button>
              </div>
            </div>
          );
        })}
        {departments.length === 0 && (
          <p className="text-sm text-fg-tertiary">{t("noDepartments")}</p>
        )}
      </div>
    </div>
  );
}

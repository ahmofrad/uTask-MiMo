"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api-fetch";

type LinkableDepartment = {
  id: string;
  name: string;
  parentId: string | null;
  source: "manual" | "ldap";
};

type LinkRequest = {
  id: string;
  status: "pending" | "approved" | "rejected" | "cancelled" | "revoked";
  departmentId: string;
  department: { id: string; name: string };
  requestedBy: { id: string; displayName: string };
};

type Props = {
  projectId: string;
  canManage: boolean;
};

export function ProjectDepartmentLinks({ projectId, canManage }: Props) {
  const t = useTranslations("project.departmentLinks");
  const [departments, setDepartments] = useState<LinkableDepartment[]>([]);
  const [requests, setRequests] = useState<LinkRequest[]>([]);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!canManage) return;
    let active = true;
    setLoading(true);
    void Promise.all([
      apiFetch(`/api/v1/departments/for-project-link?projectId=${projectId}`),
      apiFetch(`/api/v1/projects/${projectId}/department-link-requests`),
    ])
      .then(async ([departmentResponse, requestResponse]) => {
        if (!active) return;
        if (departmentResponse.ok) {
          const body = (await departmentResponse.json()) as { data?: LinkableDepartment[] };
          setDepartments(body.data ?? []);
        }
        if (requestResponse.ok) {
          const body = (await requestResponse.json()) as { data?: LinkRequest[] };
          setRequests(body.data ?? []);
        }
      })
      .catch(() => {
        if (active) setError(t("loadError"));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [canManage, projectId, t]);

  if (!canManage) return null;

  async function requestLink() {
    if (!selectedDepartmentId) return;
    setSaving(true);
    setError(null);
    try {
      const response = await apiFetch(`/api/v1/projects/${projectId}/department-link-requests`, {
        method: "POST",
        body: JSON.stringify({ departmentId: selectedDepartmentId }),
      });
      if (!response.ok) {
        setError(t("requestError"));
        return;
      }
      const body = (await response.json()) as { data: LinkRequest };
      setRequests((current) => [body.data, ...current]);
      setDepartments((current) => current.filter((department) => department.id !== selectedDepartmentId));
      setSelectedDepartmentId("");
    } catch {
      setError(t("requestError"));
    } finally {
      setSaving(false);
    }
  }

  async function decide(requestId: string, decision: "approved" | "rejected" | "cancelled") {
    setError(null);
    try {
      const response = await apiFetch(`/api/v1/projects/${projectId}/department-link-requests/${requestId}`, {
        method: "PATCH",
        body: JSON.stringify({ decision }),
      });
      if (!response.ok) {
        setError(t("decisionError"));
        return;
      }
      const body = (await response.json()) as { data: LinkRequest };
      setRequests((current) => current.map((request) => (request.id === requestId ? body.data : request)));
    } catch {
      setError(t("decisionError"));
    }
  }

  return (
    <section className="mb-6 space-y-3 rounded-lg border border-border-primary bg-bg-surface-1 p-4" aria-labelledby="department-links-title">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="department-links-title" className="font-medium text-fg-primary">{t("title")}</h2>
        {loading && <span className="text-xs text-fg-muted">{t("loading")}</span>}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <select
          value={selectedDepartmentId}
          onChange={(event) => setSelectedDepartmentId(event.target.value)}
          aria-label={t("selectDepartment")}
          className="flex-1 rounded-md border border-border-primary bg-bg-primary px-3 py-2 text-sm text-fg-primary"
          disabled={loading || saving || departments.length === 0}
        >
          <option value="">{departments.length > 0 ? t("selectDepartment") : t("noDepartments")}</option>
          {departments.map((department) => (
            <option key={department.id} value={department.id}>{department.name}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => void requestLink()}
          disabled={!selectedDepartmentId || saving}
          className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-fg-inverse disabled:opacity-50"
        >
          {saving ? t("saving") : t("request")}
        </button>
      </div>
      {error && <p className="text-sm text-status-danger" role="alert">{error}</p>}
      {requests.length > 0 && (
        <ul className="space-y-2">
          {requests.map((request) => (
            <li key={request.id} className="flex flex-col gap-2 rounded-md border border-border-secondary p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-fg-secondary">
                <span className="font-medium text-fg-primary">{request.department.name}</span>
                <span className="ms-2">{t("requestedBy", { user: request.requestedBy.displayName })}</span>
                <span className="ms-2 text-xs text-fg-muted">{t(`status.${request.status}`)}</span>
              </div>
              {request.status === "pending" && (
                <div className="flex gap-2">
                  <button type="button" onClick={() => void decide(request.id, "approved")} className="text-sm text-status-success hover:underline">
                    {t("approve")}
                  </button>
                  <button type="button" onClick={() => void decide(request.id, "rejected")} className="text-sm text-status-danger hover:underline">
                    {t("reject")}
                  </button>
                  <button type="button" onClick={() => void decide(request.id, "cancelled")} className="text-sm text-fg-muted hover:underline">
                    {t("cancel")}
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api-fetch";
import { TaskCard, type TaskCardData } from "@/components/task/task-card";

export type CustomFieldFilterDef = {
  id: string;
  name: string;
  key: string;
  type: string;
  configJson?: { options?: { value: string; label?: string; color?: string }[] } | null;
};

type Clause = { key: string; operator: string; value: string | number | boolean };

type ProjectTaskListProps = {
  projectId: string;
  initialTasks: TaskCardData[];
  fields: CustomFieldFilterDef[];
};

function optionList(field: CustomFieldFilterDef): { value: string; label: string }[] {
  return (field.configJson?.options ?? []).map((o) => ({ value: o.value, label: o.label ?? o.value }));
}

/** Map a /api/v1/tasks list row onto the TaskCard shape. */
function mapTask(raw: Record<string, unknown>): TaskCardData {
  const assignees =
    (raw.assignees as { id: string; displayName: string; avatarUrl?: string | null }[] | undefined) ?? [];
  const tags =
    (raw.tags as { tag: { id: string; name: string; color?: string | null } }[] | undefined) ?? [];
  const count = (raw._count as { subtasks?: number } | undefined) ?? {};
  return {
    id: String(raw.id),
    title: String(raw.title),
    description: (raw.description as string | null) ?? null,
    status: String(raw.status),
    priority: String(raw.priority),
    assignees: assignees.map((a) => ({ id: a.id, displayName: a.displayName, avatarUrl: a.avatarUrl ?? null })),
    dueDate: (raw.dueDate as string | null) ?? null,
    startDate: (raw.startDate as string | null) ?? null,
    tags: tags.map((tt) => ({ id: tt.tag.id, name: tt.tag.name })),
    subtaskCount: count.subtasks ?? 0,
    subtaskDone: 0,
    blockedBy: [],
  };
}

export function ProjectTaskList({ projectId, initialTasks, fields }: ProjectTaskListProps) {
  const t = useTranslations("task");
  const [tasks, setTasks] = useState<TaskCardData[]>(initialTasks);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const activeClauses = useMemo<Clause[]>(() => {
    const clauses: Clause[] = [];
    for (const field of fields) {
      const raw = filters[field.key];
      if (raw === undefined || raw === "") continue;
      if (field.type === "text" || field.type === "url") {
        clauses.push({ key: field.key, operator: "contains", value: String(raw) });
      } else if (field.type === "number") {
        clauses.push({ key: field.key, operator: "eq", value: Number(raw) });
      } else if (field.type === "checkbox") {
        clauses.push({ key: field.key, operator: "eq", value: raw === "true" });
      } else if (field.type === "select") {
        clauses.push({ key: field.key, operator: "eq", value: String(raw) });
      } else if (field.type === "multi_select") {
        clauses.push({ key: field.key, operator: "array_contains", value: String(raw) });
      } else if (field.type === "date") {
        clauses.push({ key: field.key, operator: "eq", value: String(raw) });
      }
    }
    return clauses;
  }, [fields, filters]);

  useEffect(() => {
    if (activeClauses.length === 0) {
      setTasks(initialTasks);
      setError(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(false);
    const query = new URLSearchParams({ projectId, limit: "200", customFields: JSON.stringify(activeClauses) });
    apiFetch(`/api/v1/tasks?${query.toString()}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((json: { data?: unknown[] }) => {
        if (cancelled) return;
        setTasks((json.data ?? []).map((task) => mapTask(task as Record<string, unknown>)));
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeClauses, initialTasks, projectId]);

  const setFilter = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const selectClass =
    "text-xs bg-bg-primary border border-border rounded px-1.5 py-1 text-fg-primary";

  function fieldInput(field: CustomFieldFilterDef) {
    const value = filters[field.key] ?? "";
    const testId = `cf-filter-${field.key}`;
    switch (field.type) {
      case "text":
      case "url":
        return (
          <input
            type="text"
            data-testid={testId}
            value={value}
            onChange={(e) => setFilter(field.key, e.target.value)}
            placeholder={t("customFieldContains")}
            className="w-40 text-xs bg-bg-primary border border-border rounded px-1.5 py-1 text-fg-primary placeholder:text-fg-tertiary"
          />
        );
      case "number":
        return (
          <input
            type="number"
            data-testid={testId}
            value={value}
            onChange={(e) => setFilter(field.key, e.target.value)}
            className="w-24 text-xs bg-bg-primary border border-border rounded px-1.5 py-1 text-fg-primary"
          />
        );
      case "checkbox":
        return (
          <select data-testid={testId} value={value} onChange={(e) => setFilter(field.key, e.target.value)} className={selectClass}>
            <option value="">{t("customFieldAny")}</option>
            <option value="true">{t("customFieldYes")}</option>
            <option value="false">{t("customFieldNo")}</option>
          </select>
        );
      case "select":
      case "multi_select":
        return (
          <select data-testid={testId} value={value} onChange={(e) => setFilter(field.key, e.target.value)} className={selectClass}>
            <option value="">{t("customFieldAny")}</option>
            {optionList(field).map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        );
      case "date":
        return (
          <input
            type="date"
            data-testid={testId}
            value={value}
            onChange={(e) => setFilter(field.key, e.target.value)}
            className="text-xs bg-bg-primary border border-border rounded px-1.5 py-1 text-fg-primary"
          />
        );
      default:
        return null;
    }
  }

  const filtered = activeClauses.length > 0;

  return (
    <div className="space-y-3">
      {fields.length > 0 && (
        <div data-testid="task-cf-filters" className="rounded-lg border border-border-primary bg-bg-surface p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-fg-muted">{t("customFieldFilter")}</span>
            {filtered && (
              <button
                type="button"
                data-testid="task-cf-clear"
                onClick={() => setFilters({})}
                className="text-xs font-medium text-accent hover:underline"
              >
                {t("customFieldClear")}
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {fields.map((field) => (
              <label key={field.id} className="flex items-center gap-2 text-xs text-fg-secondary">
                <span className="shrink-0">{field.name}</span>
                {fieldInput(field)}
              </label>
            ))}
          </div>
          {loading && <p className="mt-2 text-xs text-fg-muted">{t("loading")}</p>}
          {error && <p className="mt-2 text-xs text-destructive">{t("customFieldFilterError")}</p>}
        </div>
      )}

      {filtered && tasks.length === 0 && !loading && !error ? (
        <div className="text-center py-8">
          <p className="text-sm text-fg-muted">{t("customFieldNoMatches")}</p>
          <button
            type="button"
            data-testid="task-cf-clear-empty"
            onClick={() => setFilters({})}
            className="mt-2 text-sm font-medium text-accent hover:underline"
          >
            {t("customFieldClear")}
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} variant="list" />
          ))}
          {tasks.length === 0 && !filtered && (
            <p className="text-sm text-fg-muted text-center py-8">{t("noTasks")}</p>
          )}
        </div>
      )}
    </div>
  );
}

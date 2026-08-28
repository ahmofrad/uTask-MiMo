"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api-fetch";
import { useProjectRealtime } from "@/hooks/use-project-realtime";
import { TaskCard, type TaskCardData } from "@/components/task/task-card";
import { mapTaskListRow } from "@/lib/tasks/serialize";
import { BulkActionsBar } from "@/components/task/bulk-actions";
import { TaskFilters } from "./task-filters";

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

export function ProjectTaskList({ projectId, initialTasks, fields }: ProjectTaskListProps) {
  const t = useTranslations("task");
  const [tasks, setTasks] = useState<TaskCardData[]>(initialTasks);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

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

  const loadTasks = useCallback(async () => {
    const query = new URLSearchParams({ projectId, limit: "200" });
    if (activeClauses.length > 0) {
      query.set("customFields", JSON.stringify(activeClauses));
    }
    setLoading(true);
    setError(false);
    try {
      const res = await apiFetch(`/api/v1/tasks?${query.toString()}`);
      if (!res.ok) throw new Error("load failed");
      const json = (await res.json()) as { data?: unknown[] };
      setTasks((json.data ?? []).map((task) => mapTaskListRow(task as Record<string, unknown>) as TaskCardData));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [activeClauses, projectId]);

  useEffect(() => {
    if (activeClauses.length === 0) {
      setTasks(initialTasks);
      setError(false);
      return;
    }
    void loadTasks();
  }, [activeClauses, initialTasks, projectId, loadTasks]);

  useProjectRealtime([projectId], () => {
    void loadTasks();
  });

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function refresh() {
    window.location.reload();
  }

  const filtered = activeClauses.length > 0;
  const cfSchemaForBulk = fields.map((f) => ({
    id: f.id,
    key: f.key,
    name: f.name,
    type: f.type as "text" | "number" | "date" | "select" | "multi_select" | "user" | "checkbox" | "url",
    required: false,
    configJson: f.configJson ?? null,
  }));

  return (
    <div className="space-y-3">
      <BulkActionsBar
        selectedIds={Array.from(selectedIds)}
        onClear={() => setSelectedIds(new Set())}
        onRefresh={refresh}
        projectId={projectId}
        customFieldSchema={cfSchemaForBulk}
      />
      {fields.length > 0 && (
        <TaskFilters
          fields={fields}
          filters={filters}
          onFilter={(key, value) => setFilters((prev) => ({ ...prev, [key]: value }))}
          onClear={() => setFilters({})}
          loading={loading}
          error={error}
        />
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
            <div key={task.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={selectedIds.has(task.id)}
                onChange={() => toggleSelect(task.id)}
                className="shrink-0 rounded border-border-primary"
                aria-label={t("task.selectTask", { defaultValue: `Select ${task.title}` })}
              />
              <div className="flex-1 min-w-0">
                <TaskCard task={task} variant="list" />
              </div>
            </div>
          ))}
          {tasks.length === 0 && !filtered && (
            <p className="text-sm text-fg-muted text-center py-8">{t("noTasks")}</p>
          )}
        </div>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

export type Filters = {
  status?: string;
  priority?: string;
  assigneeId?: string;
  search?: string;
};

type TaskFiltersProps = {
  filters: Filters;
  onChange: (_nextFilters: Filters) => void;
  projectMembers?: { id: string; displayName: string }[];
};

export function TaskFilters({ filters, onChange, projectMembers = [] }: TaskFiltersProps) {
  const t = useTranslations("task");
  const tc = useTranslations("common");
  const [expanded, setExpanded] = useState(false);

  const activeCount = Object.values(filters).filter(Boolean).length;

  function updateFilter(key: keyof Filters, value: string) {
    const next = { ...filters };
    if (value === "") {
      delete next[key];
    } else {
      next[key] = value;
    }
    onChange(next);
  }

  return (
    <div className="mb-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-md border border-border-primary text-fg-secondary hover:bg-bg-surface transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
        </svg>
        {tc("filters")}
        {activeCount > 0 && (
          <span className="px-1.5 py-0.5 text-xs rounded-full bg-accent text-fg-inverse">
            {activeCount}
          </span>
        )}
      </button>

      {expanded && (
        <div className="mt-3 p-4 bg-bg-surface border border-border-primary rounded-lg grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-fg-muted mb-1">{t("fields.status")}</label>
            <select
              value={filters.status ?? ""}
              onChange={(e) => updateFilter("status", e.target.value)}
              className="w-full px-2 py-1.5 text-sm border border-border-primary rounded-md bg-bg-primary text-fg-primary"
            >
              <option value="">{tc("all")}</option>
              <option value="open">{t("status.open")}</option>
              <option value="in_progress">{t("status.in_progress")}</option>
              <option value="done">{t("status.done")}</option>
              <option value="cancelled">{t("status.cancelled")}</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-fg-muted mb-1">{t("fields.priority")}</label>
            <select
              value={filters.priority ?? ""}
              onChange={(e) => updateFilter("priority", e.target.value)}
              className="w-full px-2 py-1.5 text-sm border border-border-primary rounded-md bg-bg-primary text-fg-primary"
            >
              <option value="">{tc("all")}</option>
              <option value="low">{t("priority.low")}</option>
              <option value="med">{t("priority.med")}</option>
              <option value="high">{t("priority.high")}</option>
              <option value="urgent">{t("priority.urgent")}</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-fg-muted mb-1">{t("fields.assignee")}</label>
            <select
              value={filters.assigneeId ?? ""}
              onChange={(e) => updateFilter("assigneeId", e.target.value)}
              className="w-full px-2 py-1.5 text-sm border border-border-primary rounded-md bg-bg-primary text-fg-primary"
            >
              <option value="">{tc("all")}</option>
              {projectMembers.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.displayName}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-fg-muted mb-1">{tc("search")}</label>
            <input
              type="text"
              value={filters.search ?? ""}
              onChange={(e) => updateFilter("search", e.target.value)}
              placeholder={tc("filterByTitle")}
              className="w-full px-2 py-1.5 text-sm border border-border-primary rounded-md bg-bg-primary text-fg-primary placeholder:text-fg-subtle"
            />
          </div>

          {activeCount > 0 && (
            <button
              onClick={() => onChange({})}
              className="text-xs text-accent hover:underline"
            >
              {tc("clearFilters")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

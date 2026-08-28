"use client";

import { useTranslations } from "next-intl";
import type { CustomFieldFilterDef } from "./project-task-list";

type TaskFiltersProps = {
  fields: CustomFieldFilterDef[];
  filters: Record<string, string>;
  onFilter: (key: string, value: string) => void;
  onClear: () => void;
  loading: boolean;
  error: boolean;
};

const SELECT_CLASS = "text-xs bg-bg-primary border border-border rounded px-1.5 py-1 text-fg-primary";

function optionList(field: CustomFieldFilterDef): { value: string; label: string }[] {
  return (field.configJson?.options ?? []).map((o) => ({ value: o.value, label: o.label ?? o.value }));
}

function fieldInput(field: CustomFieldFilterDef, value: string, onFilter: (key: string, value: string) => void, t: (key: string) => string) {
  const testId = `cf-filter-${field.key}`;
  switch (field.type) {
    case "text":
    case "url":
      return (
        <input
          type="text"
          data-testid={testId}
          value={value}
          onChange={(e) => onFilter(field.key, e.target.value)}
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
          onChange={(e) => onFilter(field.key, e.target.value)}
          className="w-24 text-xs bg-bg-primary border border-border rounded px-1.5 py-1 text-fg-primary"
        />
      );
    case "checkbox":
      return (
        <select data-testid={testId} value={value} onChange={(e) => onFilter(field.key, e.target.value)} className={SELECT_CLASS}>
          <option value="">{t("customFieldAny")}</option>
          <option value="true">{t("customFieldYes")}</option>
          <option value="false">{t("customFieldNo")}</option>
        </select>
      );
    case "select":
    case "multi_select":
      return (
        <select data-testid={testId} value={value} onChange={(e) => onFilter(field.key, e.target.value)} className={SELECT_CLASS}>
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
          onChange={(e) => onFilter(field.key, e.target.value)}
          className="text-xs bg-bg-primary border border-border rounded px-1.5 py-1 text-fg-primary"
        />
      );
    default:
      return null;
  }
}

export function TaskFilters({ fields, filters, onFilter, onClear, loading, error }: TaskFiltersProps) {
  const t = useTranslations("task");
  const filtered = Object.values(filters).some((v) => v !== "");

  return (
    <div data-testid="task-cf-filters" className="rounded-lg border border-border-primary bg-bg-surface p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-fg-muted">{t("customFieldFilter")}</span>
        {filtered && (
          <button type="button" data-testid="task-cf-clear" onClick={onClear} className="text-xs font-medium text-accent hover:underline">
            {t("customFieldClear")}
          </button>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {fields.map((field) => (
          <label key={field.id} className="flex items-center gap-2 text-xs text-fg-secondary">
            <span className="shrink-0">{field.name}</span>
            {fieldInput(field, filters[field.key] ?? "", onFilter, t)}
          </label>
        ))}
      </div>
      {loading && <p className="mt-2 text-xs text-fg-muted">{t("loading")}</p>}
      {error && <p className="mt-2 text-xs text-destructive">{t("customFieldFilterError")}</p>}
    </div>
  );
}

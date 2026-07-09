"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api-fetch";
import { CustomFieldEditForm, type CustomFieldConfig } from "./custom-field-edit-form";

type Props = {
  projectId: string;
  initialFields: CustomFieldConfig[];
};

const FIELD_TYPES = ["text", "number", "date", "select", "multi_select", "user", "checkbox", "url"];

export function CustomFieldsManager({ projectId, initialFields }: Props) {
  const t = useTranslations("customField");
  const tc = useTranslations("common");
  const [fields, setFields] = useState(initialFields);
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("text");
  const [newRequired, setNewRequired] = useState(false);
  const [selectOptions, setSelectOptions] = useState<string[]>([]);
  const [optionInput, setOptionInput] = useState("");
  const [newMaxLength, setNewMaxLength] = useState<string>("");
  const [newMin, setNewMin] = useState<string>("");
  const [newMax, setNewMax] = useState<string>("");
  const [newIncludeTime, setNewIncludeTime] = useState(false);

  async function handleCreate() {
    if (!newName.trim()) return;
    let configJson: Record<string, unknown> | undefined;
    if (newType === "select" || newType === "multi_select") {
      configJson = selectOptions.length > 0 ? { options: selectOptions } : undefined;
    } else if (newType === "text") {
      configJson = newMaxLength ? { maxLength: Number(newMaxLength) } : undefined;
    } else if (newType === "number") {
      configJson = {
        ...(newMin !== "" ? { min: Number(newMin) } : {}),
        ...(newMax !== "" ? { max: Number(newMax) } : {}),
      };
    } else if (newType === "date") {
      configJson = newIncludeTime ? { includeTime: true } : undefined;
    }
    try {
      const res = await apiFetch(`/api/v1/projects/${projectId}/custom-fields`, {
        method: "POST",
        body: JSON.stringify({
          name: newName.trim(),
          key: newName.trim().toLowerCase().replace(/\s+/g, "_"),
          type: newType,
          required: newRequired,
          configJson,
        }),
      });
      if (res.ok) {
        const result = await res.json();
        setFields((prev) => [...prev, result.data]);
        resetForm();
      }
    } catch {
      // error handled silently
    }
  }

  function resetForm() {
    setNewName("");
    setNewType("text");
    setNewRequired(false);
    setSelectOptions([]);
    setOptionInput("");
    setNewMaxLength("");
    setNewMin("");
    setNewMax("");
    setNewIncludeTime(false);
    setShowForm(false);
  }

  function addOption() {
    const trimmed = optionInput.trim();
    if (trimmed && !selectOptions.includes(trimmed)) {
      setSelectOptions((prev) => [...prev, trimmed]);
      setOptionInput("");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 text-sm font-medium rounded-md bg-accent text-fg-inverse hover:opacity-90 transition-opacity"
        >
          {t("addField")}
        </button>
      </div>

      {showForm && (
        <div className="p-4 bg-bg-surface border border-border rounded-xl space-y-3">
          <div>
            <label className="block text-xs text-fg-muted mb-1">{t("fieldName")}</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full px-3 py-2 border border-border-primary rounded-lg bg-bg-primary text-fg-primary text-sm"
              placeholder={t("fieldNamePlaceholder")}
              autoFocus
            />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs text-fg-muted mb-1">{t("type")}</label>
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value)}
                className="w-full px-3 py-2 border border-border-primary rounded-lg bg-bg-primary text-fg-primary text-sm"
              >
                {FIELD_TYPES.map((ft) => (
                  <option key={ft} value={ft}>{ft}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm text-fg-primary">
                <input
                  type="checkbox"
                  checked={newRequired}
                  onChange={(e) => setNewRequired(e.target.checked)}
                  className="accent-accent"
                />
                {t("required")}
              </label>
            </div>
          </div>

          {newType === "select" || newType === "multi_select" ? (
            <div>
              <label className="block text-xs text-fg-muted mb-1">{t("options")}</label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {selectOptions.map((opt) => (
                  <span key={opt} className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-accent-bg text-accent rounded-full">
                    {opt}
                    <button type="button" onClick={() => setSelectOptions((prev) => prev.filter((o) => o !== opt))} className="hover:text-destructive ms-0.5">&times;</button>
                  </span>
                ))}
              </div>
              <input
                type="text"
                value={optionInput}
                onChange={(e) => setOptionInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addOption(); } }}
                placeholder={t("optionPlaceholder")}
                className="w-full px-3 py-2 border border-border-primary rounded-lg bg-bg-primary text-fg-primary text-sm"
              />
              </div>
          ) : null}

          {newType === "text" && (
            <div>
              <label className="block text-xs text-fg-muted mb-1">{t("maxLength")}</label>
              <input
                type="number" min="1" placeholder="255"
                value={newMaxLength}
                onChange={(e) => setNewMaxLength(e.target.value)}
                className="w-32 px-3 py-2 border border-border-primary rounded-lg bg-bg-primary text-fg-primary text-sm"
              />
            </div>
          )}
          {newType === "number" && (
            <div className="flex gap-3">
              <div>
                <label className="block text-xs text-fg-muted mb-1">{t("min")}</label>
                <input
                  type="number" value={newMin} onChange={(e) => setNewMin(e.target.value)}
                  className="w-24 px-3 py-2 border border-border-primary rounded-lg bg-bg-primary text-fg-primary text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-fg-muted mb-1">{t("max")}</label>
                <input
                  type="number" value={newMax} onChange={(e) => setNewMax(e.target.value)}
                  className="w-24 px-3 py-2 border border-border-primary rounded-lg bg-bg-primary text-fg-primary text-sm"
                />
              </div>
            </div>
          )}
          {newType === "date" && (
            <label className="flex items-center gap-2 text-sm text-fg-primary">
              <input
                type="checkbox"
                checked={newIncludeTime}
                onChange={(e) => setNewIncludeTime(e.target.checked)}
                className="accent-accent"
              />
              {t("includeTime")}
            </label>
          )}

          <div className="flex justify-end gap-2">
            <button onClick={resetForm} className="px-3 py-1.5 text-sm rounded-md border border-border-primary text-fg-secondary hover:bg-bg-surface">
              {tc("cancel")}
            </button>
            <button onClick={handleCreate} disabled={!newName.trim()} className="px-3 py-1.5 text-sm font-medium rounded-md bg-accent text-fg-inverse hover:opacity-90 disabled:opacity-50">
              {t("create")}
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {fields.map((field) => (
          <CustomFieldRow
            key={field.id}
            field={field}
            projectId={projectId}
            onChanged={(updated) =>
              setFields((prev) => prev.map((f) => (f.id === updated.id ? updated : f)))
            }
            onDeleted={(id) => setFields((prev) => prev.filter((f) => f.id !== id))}
          />
        ))}
        {fields.length === 0 && (
          <p className="text-sm text-fg-muted text-center py-8">{t("noFields")}</p>
        )}
      </div>
    </div>
  );
}

type RowProps = {
  field: CustomFieldConfig;
  projectId: string;
  onChanged: (_updated: CustomFieldConfig) => void;
  onDeleted: (_id: string) => void;
};

function CustomFieldRow({ field, projectId, onChanged, onDeleted }: RowProps) {
  const t = useTranslations("customField");
  const [editing, setEditing] = useState(false);

  async function remove() {
    if (!window.confirm(t("confirmDelete", { name: field.name }))) return;
    const res = await apiFetch(
      `/api/v1/projects/${projectId}/custom-fields/${field.id}`,
      { method: "DELETE" },
    );
    if (res.ok) onDeleted(field.id);
  }

  if (editing) {
    return (
      <CustomFieldEditForm
        field={field}
        projectId={projectId}
        onChanged={(updated) => { onChanged(updated); setEditing(false); }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  return (
    <div className="flex items-center gap-4 p-4 bg-bg-surface border border-border-primary rounded-lg">
      <div className="w-5 h-5 rounded bg-bg-surface-2 flex items-center justify-center text-fg-muted text-xs">≡</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-fg-primary">{field.name}</p>
        <p className="text-xs text-fg-muted">{field.type} · {field.required ? t("required") : t("optional")}</p>
      </div>
      <button
        onClick={() => setEditing(true)}
        className="text-xs text-fg-muted hover:text-accent transition-colors"
      >
        {t("edit")}
      </button>
      <button
        onClick={remove}
        className="text-xs text-fg-muted hover:text-destructive transition-colors"
      >
        {t("delete")}
      </button>
    </div>
  );
}

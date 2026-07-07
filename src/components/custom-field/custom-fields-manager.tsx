"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api-fetch";

type CustomField = {
  id: string;
  name: string;
  key: string;
  type: string;
  required: boolean;
};

type Props = {
  projectId: string;
  initialFields: CustomField[];
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

  async function handleCreate() {
    if (!newName.trim()) return;
    const res = await apiFetch(`/api/v1/projects/${projectId}/custom-fields`, {
      method: "POST",
      body: JSON.stringify({
        name: newName.trim(),
        key: newName.trim().toLowerCase().replace(/\s+/g, "_"),
        type: newType,
        required: newRequired,
        configJson: newType === "select" && selectOptions.length > 0 ? { options: selectOptions } : undefined,
      }),
    });
    if (res.ok) {
      const result = await res.json();
      setFields((prev) => [...prev, result.data]);
      resetForm();
    }
  }

  function resetForm() {
    setNewName("");
    setNewType("text");
    setNewRequired(false);
    setSelectOptions([]);
    setOptionInput("");
    setShowForm(false);
  }

  function addOption() {
    const trimmed = optionInput.trim();
    if (trimmed && !selectOptions.includes(trimmed)) {
      setSelectOptions((prev) => [...prev, trimmed]);
      setOptionInput("");
    }
  }

  function removeOption(opt: string) {
    setSelectOptions((prev) => prev.filter((o) => o !== opt));
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

          {newType === "select" && (
            <div>
              <label className="block text-xs text-fg-muted mb-1">{t("options")}</label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {selectOptions.map((opt) => (
                  <span key={opt} className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-accent-bg text-accent rounded-full">
                    {opt}
                    <button type="button" onClick={() => removeOption(opt)} className="hover:text-destructive ml-0.5">&times;</button>
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
          )}

          {newType === "text" && (
            <div>
              <label className="block text-xs text-fg-muted mb-1">{t("maxLength")}</label>
              <input type="number" min="1" placeholder="255" className="w-32 px-3 py-2 border border-border-primary rounded-lg bg-bg-primary text-fg-primary text-sm" />
            </div>
          )}
          {newType === "number" && (
            <div className="flex gap-3">
              <div>
                <label className="block text-xs text-fg-muted mb-1">{t("min")}</label>
                <input type="number" className="w-24 px-3 py-2 border border-border-primary rounded-lg bg-bg-primary text-fg-primary text-sm" />
              </div>
              <div>
                <label className="block text-xs text-fg-muted mb-1">{t("max")}</label>
                <input type="number" className="w-24 px-3 py-2 border border-border-primary rounded-lg bg-bg-primary text-fg-primary text-sm" />
              </div>
            </div>
          )}
          {newType === "date" && (
            <div className="text-xs text-fg-muted py-2">{t("dateHint")}</div>
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
          <div key={field.id} className="flex items-center gap-4 p-4 bg-bg-surface border border-border-primary rounded-lg">
            <div className="w-5 h-5 rounded bg-bg-surface-2 flex items-center justify-center text-fg-muted text-xs">≡</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-fg-primary">{field.name}</p>
              <p className="text-xs text-fg-muted">{field.type} · {field.required ? t("required") : t("optional")}</p>
            </div>
          </div>
        ))}
        {fields.length === 0 && (
          <p className="text-sm text-fg-muted text-center py-8">{t("noFields")}</p>
        )}
      </div>
    </div>
  );
}

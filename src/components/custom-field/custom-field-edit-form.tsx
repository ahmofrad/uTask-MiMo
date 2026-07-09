"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api-fetch";

export type CustomFieldConfig = {
  id: string;
  name: string;
  key: string;
  type: string;
  required: boolean;
  configJson?: unknown;
};

type Props = {
  field: CustomFieldConfig;
  projectId: string;
  onChanged: (updated: CustomFieldConfig) => void;
  onCancel: () => void;
};

function readConfig(configJson: unknown) {
  const cfg = (configJson ?? {}) as Record<string, unknown>;
  const optionsRaw = (cfg.options as unknown[]) ?? [];
  const options = optionsRaw.map((o) =>
    typeof o === "string" ? o : String((o as Record<string, unknown>).value ?? ""),
  );
  return {
    options: options.filter(Boolean),
    maxLength: cfg.maxLength != null ? Number(cfg.maxLength) : undefined,
    min: cfg.min != null ? Number(cfg.min) : undefined,
      max: cfg.max != null ? Number(cfg.max) : undefined,
      includeTime: Boolean(cfg.includeTime),
  };
}

export function CustomFieldEditForm({ field, projectId, onChanged, onCancel }: Props) {
  const t = useTranslations("customField");
  const tc = useTranslations("common");
  const initial = readConfig(field.configJson);

  const [name, setName] = useState(field.name);
  const [required, setRequired] = useState(field.required);
  const [selectOptions, setSelectOptions] = useState<string[]>(initial.options);
  const [optionInput, setOptionInput] = useState("");
  const [maxLength, setMaxLength] = useState<string>(initial.maxLength != null ? String(initial.maxLength) : "");
  const [min, setMin] = useState<string>(initial.min != null ? String(initial.min) : "");
  const [max, setMax] = useState<string>(initial.max != null ? String(initial.max) : "");
  const [includeTime, setIncludeTime] = useState<boolean>(Boolean(initial.includeTime));
  const [saving, setSaving] = useState(false);

  function addOption() {
    const trimmed = optionInput.trim();
    if (trimmed && !selectOptions.includes(trimmed)) {
      setSelectOptions((prev) => [...prev, trimmed]);
      setOptionInput("");
    }
  }

  function buildConfigJson(): Record<string, unknown> | undefined {
    switch (field.type) {
      case "text":
        return maxLength ? { maxLength: Number(maxLength) } : undefined;
      case "number":
        return {
          ...(min !== "" ? { min: Number(min) } : {}),
          ...(max !== "" ? { max: Number(max) } : {}),
        };
      case "select":
      case "multi_select":
        return selectOptions.length > 0 ? { options: selectOptions } : undefined;
      case "date":
        return includeTime ? { includeTime: true } : undefined;
      default:
        return undefined;
    }
  }

  async function save() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const res = await apiFetch(
        `/api/v1/projects/${projectId}/custom-fields/${field.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            name: name.trim(),
            required,
            configJson: buildConfigJson(),
          }),
        },
      );
      if (res.ok) {
        const result = await res.json();
        onChanged({
          id: field.id,
          name: result.data.name,
          key: field.key,
          type: field.type,
          required: result.data.required,
          configJson: result.data.configJson ?? undefined,
        });
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-4 bg-bg-surface border border-border-primary rounded-lg space-y-3">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full px-3 py-2 border border-border-primary rounded-lg bg-bg-primary text-fg-primary text-sm"
      />
      <label className="flex items-center gap-2 text-sm text-fg-primary">
        <input
          type="checkbox"
          checked={required}
          onChange={(e) => setRequired(e.target.checked)}
          className="accent-accent"
        />
        {t("required")}
      </label>

      {field.type === "select" || field.type === "multi_select" ? (
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

      {field.type === "date" && (
        <label className="flex items-center gap-2 text-sm text-fg-primary">
          <input
            type="checkbox"
            checked={includeTime}
            onChange={(e) => setIncludeTime(e.target.checked)}
            className="accent-accent"
          />
          {t("includeTime")}
        </label>
      )}

      {field.type === "text" && (
        <div>
          <label className="block text-xs text-fg-muted mb-1">{t("maxLength")}</label>
          <input
            type="number" min="1"
            value={maxLength}
            onChange={(e) => setMaxLength(e.target.value)}
            placeholder="255"
            className="w-32 px-3 py-2 border border-border-primary rounded-lg bg-bg-primary text-fg-primary text-sm"
          />
        </div>
      )}

      {field.type === "number" && (
        <div className="flex gap-3">
          <div>
            <label className="block text-xs text-fg-muted mb-1">{t("min")}</label>
            <input type="number" value={min} onChange={(e) => setMin(e.target.value)} className="w-24 px-3 py-2 border border-border-primary rounded-lg bg-bg-primary text-fg-primary text-sm" />
          </div>
          <div>
            <label className="block text-xs text-fg-muted mb-1">{t("max")}</label>
            <input type="number" value={max} onChange={(e) => setMax(e.target.value)} className="w-24 px-3 py-2 border border-border-primary rounded-lg bg-bg-primary text-fg-primary text-sm" />
          </div>
        </div>
      )}

      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="px-3 py-1.5 text-sm rounded-md border border-border-primary text-fg-secondary hover:bg-bg-surface">
          {tc("cancel")}
        </button>
        <button onClick={save} disabled={saving || !name.trim()} className="px-3 py-1.5 text-sm font-medium rounded-md bg-accent text-fg-inverse hover:opacity-90 disabled:opacity-50">
          {t("save")}
        </button>
      </div>
    </div>
  );
}

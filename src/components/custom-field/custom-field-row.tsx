"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api-fetch";
import { CustomFieldEditForm, type CustomFieldConfig } from "./custom-field-edit-form";

type RowProps = {
  field: CustomFieldConfig;
  projectId: string;
  onChanged: (_updated: CustomFieldConfig) => void;
  onDeleted: (_id: string) => void;
};

export function CustomFieldRow({ field, projectId, onChanged, onDeleted }: RowProps) {
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

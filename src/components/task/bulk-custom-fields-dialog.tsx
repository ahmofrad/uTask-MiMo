"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-fetch";
import { useToast } from "@/components/ui/toast";

type CustomFieldDef = {
  id: string;
  key: string;
  name: string;
  type: "text" | "number" | "date" | "select" | "multi_select" | "user" | "checkbox" | "url";
  required: boolean;
  configJson?: Record<string, unknown> | null;
};

type BulkCustomFieldsDialogProps = {
  open: boolean;
  onClose: () => void;
  selectedIds: string[];
  projectId: string;
  customFieldSchema: CustomFieldDef[];
  onApplied: () => void;
};

export function BulkCustomFieldsDialog({
  open,
  onClose,
  selectedIds,
  projectId,
  customFieldSchema,
  onApplied,
}: BulkCustomFieldsDialogProps) {
  const t = useTranslations();
  const { addToast } = useToast();
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [submitting, setSubmitting] = useState(false);

  function updateField(key: string, value: unknown) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit() {
    if (submitting) return;
    const entries = Object.entries(values).filter(([, v]) => v !== undefined && v !== "" && v !== null);
    if (entries.length === 0) {
      onClose();
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiFetch("/api/v1/tasks/bulk-custom-fields", {
        method: "POST",
        body: JSON.stringify({
          taskIds: selectedIds,
          projectId,
          customFields: Object.fromEntries(entries),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        addToast({
          message: t("task.bulkCustomFieldApplied", {
            succeeded: json.data.succeeded,
            total: json.data.total,
          }),
        });
        onApplied();
        onClose();
      } else {
        addToast({ message: json.error?.message ?? t("task.bulkFailed") });
      }
    } catch {
      addToast({ message: t("task.bulkFailed") });
    } finally {
      setSubmitting(false);
    }
  }

  function renderFieldInput(field: CustomFieldDef) {
    const currentValue = values[field.key];

    switch (field.type) {
      case "text":
      case "url":
        return (
          <input
            className="w-full px-3 py-2 border border-border-primary rounded-lg bg-bg-primary text-fg-primary text-sm focus:outline-none focus:ring-1 focus:ring-accent"
            value={typeof currentValue === "string" ? currentValue : ""}
            onChange={(e) => updateField(field.key, e.target.value)}
            placeholder={field.type === "url" ? "https://" : ""}
          />
        );
      case "number":
        return (
          <input
            type="number"
            className="w-full px-3 py-2 border border-border-primary rounded-lg bg-bg-primary text-fg-primary text-sm focus:outline-none focus:ring-1 focus:ring-accent"
            value={typeof currentValue === "number" ? currentValue : ""}
            onChange={(e) => {
              const val = e.target.value;
              updateField(field.key, val === "" ? null : Number(val));
            }}
          />
        );
      case "date":
        return (
          <input
            type="date"
            className="w-full px-3 py-2 border border-border-primary rounded-lg bg-bg-primary text-fg-primary text-sm focus:outline-none focus:ring-1 focus:ring-accent"
            value={typeof currentValue === "string" ? currentValue : ""}
            onChange={(e) => updateField(field.key, e.target.value || null)}
          />
        );
      case "checkbox":
        return (
          <button
            type="button"
            onClick={() => updateField(field.key, currentValue === true ? false : true)}
            className="inline-flex items-center gap-2 text-sm text-fg-primary"
          >
            <span className={`w-5 h-5 rounded border flex items-center justify-center ${currentValue === true ? "bg-accent border-accent text-fg-inverse" : "border-border-primary bg-bg-primary"}`}>
              {currentValue === true && (
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </span>
            {currentValue === true ? t("customFieldYes") : t("customFieldNo")}
          </button>
        );
      case "select": {
        const options = (field.configJson as { options?: string[] })?.options ?? [];
        return (
          <select
            className="w-full px-3 py-2 border border-border-primary rounded-lg bg-bg-primary text-fg-primary text-sm focus:outline-none focus:ring-1 focus:ring-accent"
            value={typeof currentValue === "string" ? currentValue : ""}
            onChange={(e) => updateField(field.key, e.target.value || null)}
          >
            <option value="">{t("task.customFieldAny")}</option>
            {options.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        );
      }
      case "multi_select": {
        const options = (field.configJson as { options?: string[] })?.options ?? [];
        const selected = Array.isArray(currentValue) ? currentValue : [];
        return (
          <div className="flex flex-wrap gap-1.5">
            {options.map((opt) => {
              const isSelected = selected.includes(opt);
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => {
                    const next = isSelected ? selected.filter((s) => s !== opt) : [...selected, opt];
                    updateField(field.key, next.length > 0 ? next : null);
                  }}
                  className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                    isSelected
                      ? "bg-accent/10 border-accent/30 text-accent"
                      : "border-border-primary text-fg-secondary hover:bg-bg-secondary"
                  }`}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        );
      }
      case "user":
        return (
          <p className="text-xs text-fg-muted italic">{t("task.customFieldUserSelectHint", { defaultValue: "User selection not available in bulk edit" })}</p>
        );
      default:
        return null;
    }
  }

  return (
    <Dialog open={open} onClose={onClose}>
      <div className="p-5 space-y-4 max-w-lg">
        <div>
          <h3 className="text-lg font-semibold text-fg-primary">{t("task.bulkCustomFieldTitle")}</h3>
          <p className="text-sm text-fg-muted mt-1">
            {t("task.bulkCustomFieldDescription", { count: selectedIds.length })}
          </p>
        </div>

        {customFieldSchema.length === 0 ? (
          <p className="text-sm text-fg-muted italic">{t("task.customFieldNoFields")}</p>
        ) : (
          <div className="space-y-4">
            {customFieldSchema.map((field) => (
              <div key={field.key}>
                <label className="block text-sm font-medium text-fg-secondary mb-1.5">
                  {field.name}
                  {field.required && <span className="text-destructive ms-1">*</span>}
                </label>
                {renderFieldInput(field)}
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            {t("common.cancel")}
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={submitting}>
            {submitting ? t("common.loading") : t("common.apply")}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

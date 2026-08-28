"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { RagStatus } from "./project-detail-header";

type RagHealthEditorProps = {
  initialStatus: RagStatus;
  initialReason: string;
  onSave: (status: RagStatus, reason: string | null) => Promise<Response>;
  onCancel: () => void;
};

export function RagHealthEditor({ initialStatus, initialReason, onSave, onCancel }: RagHealthEditorProps) {
  const t = useTranslations("rag");
  const [healthStatus, setHealthStatus] = useState<RagStatus>(initialStatus);
  const [healthReason, setHealthReason] = useState(initialReason);
  const [saving, setSaving] = useState(false);

  return (
    <div
      data-testid="project-rag-editor"
      className="mt-3 flex flex-wrap items-center gap-2 border border-border-primary rounded-lg bg-bg-surface-2 p-3"
    >
      <label className="flex flex-col gap-1 text-xs text-fg-secondary">
        {t("status")}
        <select
          data-testid="project-rag-status"
          value={healthStatus}
          onChange={(e) => setHealthStatus(e.target.value as RagStatus)}
          className="px-2 py-1.5 border border-border-primary rounded-md bg-bg-primary text-sm text-fg-primary"
        >
          <option value="GREEN">{t("green")}</option>
          <option value="AMBER">{t("amber")}</option>
          <option value="RED">{t("red")}</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs text-fg-secondary flex-1 min-w-48">
        {t("reason")}
        <input
          type="text"
          data-testid="project-rag-reason"
          value={healthReason}
          maxLength={500}
          onChange={(e) => setHealthReason(e.target.value)}
          placeholder={t("reasonPlaceholder")}
          className="px-2 py-1.5 border border-border-primary rounded-md bg-bg-primary text-sm text-fg-primary placeholder:text-fg-tertiary"
        />
      </label>
      <button
        type="button"
        data-testid="project-rag-save"
        disabled={saving}
        onClick={async () => {
          setSaving(true);
          try {
            await onSave(healthStatus, healthReason.trim() || null);
          } finally {
            setSaving(false);
          }
        }}
        className="px-3 py-1.5 bg-accent text-fg-inverse rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-50"
      >
        {saving ? t("saving") : t("save")}
      </button>
      <button
        type="button"
        data-testid="project-rag-cancel"
        onClick={onCancel}
        className="px-3 py-1.5 border border-border-primary rounded-md text-sm text-fg-secondary hover:bg-bg-surface"
      >
        {t("cancel")}
      </button>
    </div>
  );
}

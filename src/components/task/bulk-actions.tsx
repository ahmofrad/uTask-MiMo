"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api-fetch";
import { BulkCustomFieldsDialog } from "@/components/task/bulk-custom-fields-dialog";

type CustomFieldDef = {
  id: string;
  key: string;
  name: string;
  type: "text" | "number" | "date" | "select" | "multi_select" | "user" | "checkbox" | "url";
  required: boolean;
  configJson?: Record<string, unknown> | null;
};

type BulkActionsProps = {
  selectedIds: string[];
  onClear: () => void;
  onRefresh: () => void;
  projectId?: string;
  customFieldSchema?: CustomFieldDef[];
};

type BulkResult = {
  updated: number;
  failed: { taskId: string; code: string }[];
};

async function bulkUpdate(ids: string[], patch: Record<string, unknown>): Promise<BulkResult> {
  const res = await apiFetch("/api/v1/tasks/bulk", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ taskIds: ids, patch }),
  });
  if (!res.ok) throw new Error(`Bulk update failed: ${res.status}`);
  const json = (await res.json()) as { data: BulkResult };
  return json.data;
}

export function BulkActionsBar({ selectedIds, onClear, onRefresh, projectId, customFieldSchema }: BulkActionsProps) {
  const t = useTranslations();
  const [busy, setBusy] = useState(false);
  const [cfDialogOpen, setCfDialogOpen] = useState(false);
  const { addToast } = useToast();

  if (selectedIds.length === 0) return null;

  async function bulkAction(action: string, patch?: Record<string, unknown>) {
    setBusy(true);
    const ids = [...selectedIds];
    try {
      const result = await bulkUpdate(ids, patch ?? { status: action });
      const succeeded = result.updated;
      addToast({
        message: t("task.bulkUpdated", { succeeded, total: ids.length }),
        action: {
          label: t("common.undo"),
          onClick: async () => {
            await bulkUpdate(ids, { status: "open" }).catch(() => {});
            onRefresh();
          },
        },
      });
      onRefresh();
      onClear();
    } catch {
      addToast({ message: t("task.bulkFailed") });
    }
    setBusy(false);
  }

  async function bulkDelete() {
    setBusy(true);
    const ids = [...selectedIds];
    try {
      const result = await bulkUpdate(ids, { deletedAt: new Date().toISOString() });
      const succeeded = result.updated;
      const failed = ids.length - succeeded;
      addToast({
        message: failed > 0
          ? t("task.bulkPartialDelete", { succeeded, failed })
          : t("task.tasksDeleted", { count: ids.length }),
        action: {
          label: t("common.undo"),
          onClick: async () => {
            await bulkUpdate(ids, { deletedAt: null }).catch(() => {});
            onRefresh();
          },
        },
      });
      onRefresh();
      onClear();
    } catch {
      addToast({ message: t("task.bulkFailed") });
    }
    setBusy(false);
  }

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-accent/10 border border-accent/20 rounded-lg text-sm">
      <span className="text-fg-secondary font-medium">
        {t("task.selected", { count: selectedIds.length })}
      </span>
      <div className="flex gap-2 ms-auto">
        <button
          onClick={() => bulkAction("done", { status: "done" })}
          disabled={busy}
          className="px-3 py-1 rounded-md bg-accent text-fg-inverse text-xs font-medium hover:opacity-90 disabled:opacity-50"
        >
          {t("task.actions.complete")}
        </button>
        <button
          onClick={() => bulkAction("cancelled", { status: "cancelled" })}
          disabled={busy}
          className="px-3 py-1 rounded-md bg-bg-secondary border border-border-primary text-fg-secondary text-xs hover:bg-bg-tertiary disabled:opacity-50"
        >
          {t("common.cancel")}
        </button>
        <button
          onClick={bulkDelete}
          disabled={busy}
          className="px-3 py-1 rounded-md text-destructive-fg border border-destructive-border text-xs hover:bg-destructive-bg disabled:opacity-50"
        >
          {t("common.delete")}
        </button>
        {projectId && customFieldSchema && customFieldSchema.length > 0 && (
          <button
            onClick={() => setCfDialogOpen(true)}
            disabled={busy}
            className="px-3 py-1 rounded-md bg-bg-secondary border border-border-primary text-fg-secondary text-xs hover:bg-bg-tertiary disabled:opacity-50"
          >
            {t("task.customFields")}
          </button>
        )}
        <button
          onClick={onClear}
          className="px-3 py-1 rounded-md text-fg-tertiary text-xs hover:text-fg-secondary"
        >
          {t("common.close")}
        </button>
      </div>
      {projectId && customFieldSchema && (
        <BulkCustomFieldsDialog
          open={cfDialogOpen}
          onClose={() => setCfDialogOpen(false)}
          selectedIds={selectedIds}
          projectId={projectId}
          customFieldSchema={customFieldSchema}
          onApplied={onRefresh}
        />
      )}
    </div>
  );
}

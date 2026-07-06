"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useToast } from "@/components/ui/toast";

type BulkActionsProps = {
  selectedIds: string[];
  onClear: () => void;
  onRefresh: () => void;
};

export function BulkActionsBar({ selectedIds, onClear, onRefresh }: BulkActionsProps) {
  const t = useTranslations();
  const [busy, setBusy] = useState(false);
  const { addToast } = useToast();

  if (selectedIds.length === 0) return null;

  async function bulkAction(action: string, body?: Record<string, unknown>) {
    setBusy(true);
    try {
      const results = await Promise.allSettled(
        selectedIds.map((id) =>
          fetch(`/api/v1/tasks/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body ?? { status: action }),
          }),
        ),
      );
      const succeeded = results.filter((r) => r.status === "fulfilled").length;
      const ids = [...selectedIds];
      addToast({
        message: t("task.bulkUpdated", { succeeded, total: ids.length }),
        action: {
          label: t("common.undo"),
          onClick: async () => {
            await Promise.allSettled(
              ids.map((id) =>
                fetch(`/api/v1/tasks/${id}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ status: "open" }),
                }),
              ),
            );
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
      const results = await Promise.allSettled(
        ids.map((id) =>
          fetch(`/api/v1/tasks/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ deletedAt: new Date().toISOString() }),
          }),
        ),
      );
      const succeeded = results.filter((r) => r.status === "fulfilled").length;
      const failed = ids.length - succeeded;
      addToast({
        message: failed > 0
          ? t("task.bulkPartialDelete", { succeeded, failed })
          : t("task.tasksDeleted", { count: ids.length }),
        action: {
          label: t("common.undo"),
          onClick: async () => {
            await Promise.allSettled(
              ids.map((id) =>
                fetch(`/api/v1/tasks/${id}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ deletedAt: null }),
                }),
              ),
            );
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
        <button
          onClick={onClear}
          className="px-3 py-1 rounded-md text-fg-tertiary text-xs hover:text-fg-secondary"
        >
          {t("common.close")}
        </button>
      </div>
    </div>
  );
}

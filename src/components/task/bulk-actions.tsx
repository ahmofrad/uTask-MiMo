"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/toast";

type BulkActionsProps = {
  selectedIds: string[];
  onClear: () => void;
  onRefresh: () => void;
};

export function BulkActionsBar({ selectedIds, onClear, onRefresh }: BulkActionsProps) {
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
      addToast({
        message: `${succeeded} of ${selectedIds.length} tasks updated`,
        action: { label: "Undo", onClick: () => {} },
      });
      onRefresh();
      onClear();
    } catch {
      addToast({ message: "Bulk action failed" });
    }
    setBusy(false);
  }

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-accent/10 border border-accent/20 rounded-lg text-sm">
      <span className="text-fg-secondary font-medium">
        {selectedIds.length} selected
      </span>
      <div className="flex gap-2 ms-auto">
        <button
          onClick={() => bulkAction("done", { status: "done" })}
          disabled={busy}
          className="px-3 py-1 rounded-md bg-accent text-fg-inverse text-xs font-medium hover:opacity-90 disabled:opacity-50"
        >
          Complete
        </button>
        <button
          onClick={() => bulkAction("cancelled", { status: "cancelled" })}
          disabled={busy}
          className="px-3 py-1 rounded-md bg-bg-secondary border border-border-primary text-fg-secondary text-xs hover:bg-bg-tertiary disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={() => {
            selectedIds.forEach((id) =>
              fetch(`/api/v1/tasks/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ deletedAt: new Date().toISOString() }),
              }),
            );
            addToast({
              message: `${selectedIds.length} tasks deleted`,
              action: { label: "Undo", onClick: () => {} },
            });
            onRefresh();
            onClear();
          }}
          disabled={busy}
          className="px-3 py-1 rounded-md text-destructive-fg border border-destructive-border text-xs hover:bg-destructive-bg disabled:opacity-50"
        >
          Delete
        </button>
        <button
          onClick={onClear}
          className="px-3 py-1 rounded-md text-fg-tertiary text-xs hover:text-fg-secondary"
        >
          Clear
        </button>
      </div>
    </div>
  );
}

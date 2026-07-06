"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";

type ConfirmDialogProps = {
  open: boolean;
  titleKey: string;
  descriptionKey?: string;
  confirmLabelKey?: string;
  cancelLabelKey?: string;
  variant?: "danger" | "default";
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  titleKey,
  descriptionKey,
  confirmLabelKey = "common.confirm",
  cancelLabelKey = "common.cancel",
  variant = "danger",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const t = useTranslations();
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className="backdrop:bg-black/50 rounded-xl border border-border bg-bg-primary p-0 w-full max-w-md"
      onClose={onCancel}
    >
      <div className="p-6">
        <h2 className="text-lg font-semibold text-fg-primary mb-2">{t(titleKey)}</h2>
        {descriptionKey && (
          <p className="text-sm text-fg-muted">{t(descriptionKey)}</p>
        )}
      </div>
      <div className="flex justify-end gap-3 px-6 pb-6">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium rounded-md border border-border text-fg-secondary hover:bg-bg-surface transition-colors"
        >
          {t(cancelLabelKey)}
        </button>
        <button
          onClick={onConfirm}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            variant === "danger"
              ? "bg-destructive text-fg-inverse hover:opacity-90"
              : "bg-accent text-fg-inverse hover:opacity-90"
          }`}
        >
          {t(confirmLabelKey)}
        </button>
      </div>
    </dialog>
  );
}

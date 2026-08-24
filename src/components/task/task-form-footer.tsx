"use client";

import { useTranslations } from "next-intl";

type TaskFormFooterProps = {
  loading: boolean;
  disabled: boolean;
  onCancel: () => void;
};

export function TaskFormFooter({ loading, disabled, onCancel }: TaskFormFooterProps) {
  const t = useTranslations("common");

  return (
    <div className="flex justify-end gap-3 pt-4 border-t border-border-primary">
      <button
        type="button"
        onClick={onCancel}
        className="px-4 py-2 text-sm font-medium rounded-md border border-border-primary text-fg-secondary hover:bg-bg-surface transition-colors"
      >
        {t("cancel")}
      </button>
      <button
        type="submit"
        disabled={disabled}
        className="px-4 py-2 text-sm font-medium rounded-md bg-accent text-fg-inverse hover:opacity-90 disabled:opacity-50 transition-opacity"
      >
        {loading ? t("loading") : t("save")}
      </button>
    </div>
  );
}

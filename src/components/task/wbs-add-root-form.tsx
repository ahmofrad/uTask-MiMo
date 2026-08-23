"use client";

import { memo } from "react";
import { useTranslations } from "next-intl";

type Props = {
  busy: boolean;
  title: string;
  onTitle: (_v: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
};

export const WbsAddRootForm = memo(function WbsAddRootForm({
  busy,
  title,
  onTitle,
  onSubmit,
  onCancel,
}: Props) {
  const t = useTranslations("task");

  return (
    <form
      data-testid="wbs-root-form"
      className="flex flex-wrap items-center gap-2 rounded-xl border border-accent/30 bg-accent-bg p-3"
      onSubmit={(e) => { e.preventDefault(); onSubmit(); }}
    >
      <input
        data-testid="wbs-root-title"
        autoFocus
        value={title}
        onChange={(e) => onTitle(e.target.value)}
        placeholder={t("wbsAddRootPlaceholder")}
        className="min-w-[16rem] flex-1 rounded-md border border-border bg-bg-surface px-3 py-2 text-sm text-fg-primary outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
      />
      <button type="submit" disabled={busy || !title.trim()} className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-fg disabled:opacity-50">
        {t("add")}
      </button>
      <button type="button" onClick={onCancel} className="rounded-md px-3 py-2 text-sm text-fg-muted hover:bg-bg-surface">
        {t("wbsCancel")}
      </button>
    </form>
  );
});
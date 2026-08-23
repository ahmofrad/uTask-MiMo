"use client";

import { memo } from "react";
import { useTranslations } from "next-intl";

type EditorProps = {
  search: string;
  onSearch: (_v: string) => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  onAddRoot: () => void;
};

export const WbsToolbar = memo(function WbsToolbar({
  search,
  onSearch,
  onExpandAll,
  onCollapseAll,
  onAddRoot,
}: EditorProps) {
  const t = useTranslations("task");

  return (
    <div data-testid="wbs-toolbar" className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-bg-surface p-3 shadow-xs">
      <div className="relative min-w-[16rem] flex-1">
        <svg className="pointer-events-none absolute inset-s-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m21 21-4.35-4.35m2.35-5.65a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z" />
        </svg>
        <input
          data-testid="wbs-search"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder={t("wbsSearchPlaceholder")}
          aria-label={t("wbsSearch")}
          className="w-full rounded-md border border-border bg-bg-surface-2 py-2 ps-9 pe-3 text-sm text-fg-primary outline-none placeholder:text-fg-subtle focus:border-accent focus:ring-2 focus:ring-accent/20"
        />
      </div>
      <button type="button" data-testid="wbs-expand-all" onClick={onExpandAll} className="rounded-md border border-border px-3 py-2 text-sm text-fg-muted hover:bg-bg-surface-2 hover:text-fg-primary">
        {t("wbsExpandAll")}
      </button>
      <button type="button" data-testid="wbs-collapse-all" onClick={onCollapseAll} className="rounded-md border border-border px-3 py-2 text-sm text-fg-muted hover:bg-bg-surface-2 hover:text-fg-primary">
        {t("wbsCollapseAll")}
      </button>
      <button type="button" data-testid="wbs-add-root" onClick={onAddRoot} className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-fg hover:bg-accent-hover">
        + {t("wbsAddRoot")}
      </button>
    </div>
  );
});
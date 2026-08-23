"use client";

import { useTranslations } from "next-intl";

export function GanttLegend() {
  const t = useTranslations("task");

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-fg-muted pt-1">
      <span className="font-medium text-fg-primary">{t("ganttLegend")}</span>
      <span className="flex items-center gap-1.5">
        <span className="w-3 h-3 rounded-sm bg-info" />
        {t("status.open")}
      </span>
      <span className="flex items-center gap-1.5">
        <span className="w-3 h-3 rounded-sm bg-warning" />
        {t("status.in_progress")}
      </span>
      <span className="flex items-center gap-1.5">
        <span className="w-3 h-3 rounded-sm bg-success" />
        {t("status.done")}
      </span>
      <span className="flex items-center gap-1.5">
        <span className="w-3 h-3 rounded-sm bg-fg-subtle" />
        {t("status.cancelled")}
      </span>
      <span className="flex items-center gap-1.5">
        <span className="w-3 h-3 rounded-sm ring-2 ring-danger" />
        {t("ganttCriticalPath")}
      </span>
      <span className="flex items-center gap-1.5">
        <span className="w-3 h-3 rounded-sm bg-fg-subtle ring-2 ring-danger" />
        {t("ganttDelayed")}
      </span>
      <span className="flex items-center gap-1.5 text-danger">
        <span className="w-3 h-0.5 bg-danger" />
        {t("ganttInvalidDeps")}
      </span>
      <span className="flex items-center gap-1.5">
        <span className="w-3 h-3 rounded-sm bg-danger-bg border border-danger/40" />
        {t("holiday")}
      </span>
      <span className="flex items-center gap-1.5">
        <span className="w-3 h-3 rounded-sm bg-bg-surface-2 border border-border-primary" />
        {t("nonWorkingDay")}
      </span>
    </div>
  );
}
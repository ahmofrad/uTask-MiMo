"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import type { Locale } from "@/lib/date/format";
import { formatFloatDays } from "@/lib/gantt/float";
import { useFormattedDate } from "@/lib/date/useFormattedDate";
import type { GanttRow } from "@/lib/gantt-types";

type CriticalRow = GanttRow;

type Props = {
  criticalRows: CriticalRow[];
  dateFor: (_r: GanttRow) => { start: Date | null; end: Date | null };
  criticalChainInfo: (_row: GanttRow) => string;
  floatPhrase: (_days: number) => string;
};

export function GanttCriticalPanel({ criticalRows, dateFor, criticalChainInfo, floatPhrase }: Props) {
  const t = useTranslations("task");
  const locale = useLocale() as Locale;
  const { shortDate } = useFormattedDate();

  return (
    <div data-testid="gantt-critical-panel" className="rounded-lg border border-border-primary p-3 text-sm">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-fg-muted">
          {t("ganttCriticalPath")} ({criticalRows.length})
        </span>
      </div>
      <p className="mb-2 text-xs text-fg-muted">{t("ganttFloatHint")}</p>
      <ul className="space-y-1.5">
        {criticalRows.map((row) => {
          const floatDays = row.floatDays ?? 0;
          const { start, end } = dateFor(row);
          const chainInfo = criticalChainInfo(row);
          const showDates = start != null && end != null;
          return (
            <li
              key={row.id}
              data-testid="gantt-critical-row"
              data-task-id={row.id}
              className="rounded-md border border-border-secondary/60 bg-bg-secondary/40 px-2.5 py-1.5"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="min-w-0 truncate text-xs">
                  <span className="font-mono text-fg-subtle">{row.wbsCode}</span>
                  <Link
                    href={`/tasks/${row.id}`}
                    className="ms-1.5 font-medium text-fg-primary hover:text-accent truncate"
                    title={row.title}
                  >
                    {row.title}
                  </Link>
                </span>
                <span
                  data-testid="gantt-critical-float"
                  title={floatPhrase(floatDays)}
                  className={`shrink-0 rounded-full px-2 py-0.5 font-mono text-[11px] font-semibold ${
                    floatDays < 0 ? "bg-danger-bg text-danger" : "bg-warning-bg text-warning"
                  }`}
                >
                  {formatFloatDays(floatDays)}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-fg-muted">
                {showDates && (
                  <span data-testid="gantt-critical-dates" dir={locale === "fa-IR" ? "rtl" : "ltr"}>
                    {shortDate(start!.toISOString())} – {shortDate(end!.toISOString())}
                  </span>
                )}
                {chainInfo && (
                  <>
                    {showDates && <span className="text-fg-subtle">·</span>}
                    <span data-testid="gantt-critical-chain" className="truncate">
                      {chainInfo}
                    </span>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
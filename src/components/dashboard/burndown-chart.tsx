"use client";

import { useMemo, memo } from "react";
import { useTranslations } from "next-intl";

type BurndownChartProps = {
  data: { date: string; remaining: number; ideal: number }[];
};

export const BurndownChart = memo(function BurndownChart({ data }: BurndownChartProps) {
  const t = useTranslations("dashboard");

  const max = useMemo(() => Math.max(...data.map((d) => Math.max(d.remaining, d.ideal)), 0), [data]);

  if (data.length === 0) {
    return (
      <div className="bg-bg-surface border border-border-primary rounded-xl p-6">
        <h2 className="text-lg font-semibold text-fg-primary mb-4">{t("burndown")}</h2>
        <p className="text-sm text-fg-muted text-center py-8">{t("noData")}</p>
      </div>
    );
  }

  return (
    <div className="bg-bg-surface border border-border-primary rounded-xl p-6">
      <h2 className="text-lg font-semibold text-fg-primary mb-4">{t("burndownRange")}</h2>
      <div className="flex items-end gap-1 h-32">
        {data.map((d, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div
              className="w-full bg-accent rounded-t"
              style={{ height: `${(d.remaining / max) * 100}%` }}
            />
            <div
              className="w-full bg-tone-violet rounded-t opacity-60"
              style={{ height: `${(d.ideal / max) * 100}%` }}
            />
          </div>
        ))}
      </div>
      <div className="flex justify-between mt-2">
        <span className="text-xs text-fg-muted">{data[0]?.date}</span>
        <span className="text-xs text-fg-muted">{data[data.length - 1]?.date}</span>
      </div>
    </div>
  );
});

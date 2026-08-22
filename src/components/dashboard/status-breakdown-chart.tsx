"use client";

import { useTranslations } from "next-intl";

type StatusBreakdownProps = {
  data: { label: string; count: number; color: string }[];
};

export function StatusBreakdownChart({ data }: StatusBreakdownProps) {
  const t = useTranslations("project");
  const total = data.reduce((sum, d) => sum + d.count, 0);

  return (
    <div className="bg-bg-surface border border-border-primary rounded-xl p-6">
      <h2 className="text-lg font-semibold text-fg-primary mb-4">{t("dashboard.statusBreakdown")}</h2>
      <div className="space-y-3">
        {data.map((item) => (
          <div key={item.label} className="flex items-center gap-3">
            <span className="text-sm text-fg-secondary w-24">{item.label}</span>
            <div className="flex-1 h-2 bg-bg-surface-2 rounded-full overflow-hidden">
              <div
                className={`h-full ${item.color} rounded-full transition-[width]`}
                style={{ width: `${total > 0 ? (item.count / total) * 100 : 0}%` }}
              />
            </div>
            <span className="text-sm text-fg-muted w-8 text-end">{item.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

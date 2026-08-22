"use client";

import { memo } from "react";
import { useTranslations } from "next-intl";

type Props = {
  entityType: string;
  entityId: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  onClose: () => void;
};

export const LogDiffDetails = memo(function LogDiffDetails({ entityType, entityId, before, after, onClose }: Props) {
  const t = useTranslations("audit");
  const allKeys = [...new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])];

  return (
    <div className="rounded-lg border border-border-primary bg-bg-surface p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-fg-secondary">
          {t("diff.field")}: {entityType} · {entityId.slice(0, 8)}…
        </span>
        <button type="button" onClick={onClose} className="text-xs text-fg-muted hover:text-fg-primary">
          {t("hideDetails")}
        </button>
      </div>
      {allKeys.length === 0 ? (
        <p className="text-xs text-fg-muted italic">{t("diff.noChanges")}</p>
      ) : (
        <div className="space-y-1">
          {allKeys.map((key) => {
            const b = before?.[key];
            const a = after?.[key];
            if (b === a) return null;
            return (
              <div key={key} className="flex items-start gap-2 text-xs">
                <span className="font-medium text-fg-muted shrink-0 w-24 truncate">{key}</span>
                <span className="text-fg-muted truncate max-w-[40%]">{formatJsonVal(b)}</span>
                <span className="text-fg-subtle">→</span>
                <span className="text-fg-primary truncate max-w-[40%]">{formatJsonVal(a)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});

export function formatJsonVal(val: unknown): string {
  if (val === undefined || val === null) return "—";
  if (typeof val === "object") return JSON.stringify(val);
  const str = String(val);
  return str.length > 80 ? str.slice(0, 80) + "…" : str;
}

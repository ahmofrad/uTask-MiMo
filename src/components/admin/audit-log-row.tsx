"use client";

import { useTranslations } from "next-intl";
import { useFormattedDate } from "@/lib/date/useFormattedDate";

type AuditEntry = {
  id: string;
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  beforeJson: unknown;
  afterJson: unknown;
  occurredAt: string;
  actor?: { id: string; displayName: string; email: string } | null;
};

type AuditLogRowProps = {
  log: AuditEntry;
  isExpanded: boolean;
  onToggleExpand: (_id: string) => void;
};

export function AuditLogRow({ log, isExpanded, onToggleExpand }: AuditLogRowProps) {
  const t = useTranslations("audit");
  const { dateTime } = useFormattedDate();

  const actionLabel = t.has(`actions.${log.action}`)
    ? t(`actions.${log.action}` as never)
    : log.action.replace(/_/g, " ");
  const hasChanges = log.beforeJson != null || log.afterJson != null;

  return (
    <tr className="border-b border-border-primary hover:bg-bg-secondary/50">
      <td className="p-2 text-fg-primary whitespace-nowrap font-mono text-xs">
        {dateTime(log.occurredAt)}
      </td>
      <td className="p-2 text-fg-primary whitespace-nowrap">
        {log.actor?.displayName ?? log.actor?.email ?? "system"}
      </td>
      <td className="p-2">
        <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-accent/10 text-accent">
          {actionLabel}
        </span>
      </td>
      <td className="p-2 text-fg-secondary">
        <span className="text-xs text-fg-muted">{log.entityType}</span>
        <span className="font-mono text-xs text-fg-tertiary ms-2">{log.entityId.slice(0, 8)}…</span>
      </td>
      <td className="p-2">
        {hasChanges && (
          <button
            type="button"
            onClick={() => onToggleExpand(log.id)}
            className="text-xs text-accent hover:underline"
            aria-label={isExpanded ? t("hideDetails") : t("showDetails")}
          >
            {isExpanded ? "▲" : "▼"}
          </button>
        )}
      </td>
    </tr>
  );
}

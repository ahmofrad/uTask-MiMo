"use client";

import { useTranslations } from "next-intl";
import { AuditLogRow } from "./audit-log-row";

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

type AuditLogTableProps = {
  logs: AuditEntry[];
  expandedId: string | null;
  loading: boolean;
  onToggleExpand: (_id: string) => void;
};

export function AuditLogTable({ logs, expandedId, loading, onToggleExpand }: AuditLogTableProps) {
  const t = useTranslations("audit");

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border-primary">
            <th className="text-start p-2 text-fg-secondary">{t("time")}</th>
            <th className="text-start p-2 text-fg-secondary">{t("actor")}</th>
            <th className="text-start p-2 text-fg-secondary">{t("action")}</th>
            <th className="text-start p-2 text-fg-secondary">{t("entity")}</th>
            <th className="text-start p-2 text-fg-secondary w-8"></th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <AuditLogRow
              key={log.id}
              log={log}
              isExpanded={expandedId === log.id}
              onToggleExpand={onToggleExpand}
            />
          ))}
          {logs.length === 0 && !loading && (
            <tr>
              <td colSpan={5} className="p-4 text-center text-fg-tertiary">{t("empty")}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

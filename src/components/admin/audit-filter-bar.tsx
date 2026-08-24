"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

const ACTION_OPTIONS = [
  "task_created",
  "task_updated",
  "task_deleted",
  "comment_created",
  "comment_updated",
  "comment_deleted",
  "project_created",
  "project_updated",
  "project_archived",
  "custom_field_created",
  "custom_field_updated",
  "custom_field_archived",
  "project_member_added",
  "project_member_removed",
  "group_created",
  "group_updated",
  "group_deleted",
  "group_member_added",
  "group_member_removed",
  "group_grant_created",
  "group_grant_revoked",
  "login_success",
  "login_failed",
  "logout",
  "settings_updated",
  "user_updated",
  "user_suspended",
  "user_unsuspended",
  "invite_sent",
  "invite_accepted",
  "api_token_created",
  "api_token_revoked",
  "webhook_created",
  "webhook_updated",
  "webhook_deleted",
  "watcher_added",
  "watcher_removed",
  "ldap_sync",
  "mail_test_sent",
  "session_revoked",
  "department_created",
  "department_updated",
  "department_deleted",
] as const;

type AuditFilterBarProps = {
  actionFilter: string;
  entityFilter: string;
  dateFrom: string;
  dateTo: string;
  searchQuery: string;
  entityTypeOptions: string[];
  onActionFilterChange: (_value: string) => void;
  onEntityFilterChange: (_value: string) => void;
  onDateFromChange: (_value: string) => void;
  onDateToChange: (_value: string) => void;
  onSearchQueryChange: (_value: string) => void;
  onApply: () => void;
  onClear: () => void;
};

export function AuditFilterBar({
  actionFilter,
  entityFilter,
  dateFrom,
  dateTo,
  searchQuery,
  entityTypeOptions,
  onActionFilterChange,
  onEntityFilterChange,
  onDateFromChange,
  onDateToChange,
  onSearchQueryChange,
  onApply,
  onClear,
}: AuditFilterBarProps) {
  const t = useTranslations("audit");
  const hasFilters = actionFilter || entityFilter || dateFrom || dateTo || searchQuery;

  return (
    <div className="rounded-lg border border-border-primary bg-bg-surface p-3 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-fg-muted">{t("filters")}</span>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-1.5 text-xs text-fg-secondary">
          <span className="shrink-0">{t("action")}</span>
          <select
            value={actionFilter}
            onChange={(e) => onActionFilterChange(e.target.value)}
            className="text-xs bg-bg-primary border border-border rounded px-1.5 py-1 text-fg-primary"
          >
            <option value="">{t("all")}</option>
            {ACTION_OPTIONS.map((a) => (
              <option key={a} value={a}>{t.has(`actions.${a}`) ? t(`actions.${a}` as never) : a}</option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-1.5 text-xs text-fg-secondary">
          <span className="shrink-0">{t("entity")}</span>
          <select
            value={entityFilter}
            onChange={(e) => onEntityFilterChange(e.target.value)}
            className="text-xs bg-bg-primary border border-border rounded px-1.5 py-1 text-fg-primary"
          >
            <option value="">{t("all")}</option>
            {entityTypeOptions.map((et) => (
              <option key={et} value={et}>{et}</option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-1.5 text-xs text-fg-secondary">
          <span className="shrink-0">{t("from")}</span>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => onDateFromChange(e.target.value)}
            className="text-xs bg-bg-primary border border-border rounded px-1.5 py-1 text-fg-primary"
          />
        </label>

        <label className="flex items-center gap-1.5 text-xs text-fg-secondary">
          <span className="shrink-0">{t("to")}</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => onDateToChange(e.target.value)}
            className="text-xs bg-bg-primary border border-border rounded px-1.5 py-1 text-fg-primary"
          />
        </label>

        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchQueryChange(e.target.value)}
          placeholder={t("searchPlaceholder")}
          className="text-xs bg-bg-primary border border-border rounded px-2 py-1 text-fg-primary placeholder:text-fg-tertiary w-48"
        />

        <Button variant="outline" size="sm" onClick={onApply}>
          {t("apply")}
        </Button>

        {hasFilters && (
          <button
            type="button"
            onClick={onClear}
            className="text-xs font-medium text-accent hover:underline"
          >
            {t("clearFilters")}
          </button>
        )}
      </div>
    </div>
  );
}

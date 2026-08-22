"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useFormattedDate } from "@/lib/date/useFormattedDate";
import type { LdapSourceView } from "@/components/admin/ldap-source-list";

type LdapSourceTableProps = {
  sources: LdapSourceView[];
  busyId: string | null;
  busyKind: "test" | "sync" | "toggle" | null;
  onTest: (_sourceId: string) => Promise<void>;
  onSync: (_sourceId: string) => Promise<void>;
  onEdit: (_source: LdapSourceView) => void;
  onToggle: (_source: LdapSourceView) => Promise<void>;
  onDelete: (_source: LdapSourceView) => Promise<void>;
};

export function LdapSourceTable({
  sources,
  busyId,
  busyKind,
  onTest,
  onSync,
  onEdit,
  onToggle,
  onDelete,
}: LdapSourceTableProps) {
  const t = useTranslations("admin");
  const tc = useTranslations("common");
  const { dateTime } = useFormattedDate();

  if (sources.length === 0) {
    return <p className="text-sm text-fg-tertiary">{t("noSources")}</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border-primary">
      <table className="w-full text-sm">
        <thead className="bg-bg-secondary text-fg-secondary">
          <tr>
            <th className="text-start ps-3 pe-2 py-2 font-medium">{t("name")}</th>
            <th className="text-start ps-2 pe-2 py-2 font-medium">{t("ldapHost")}</th>
            <th className="text-start ps-2 pe-2 py-2 font-medium">{t("status")}</th>
            <th className="text-start ps-2 pe-2 py-2 font-medium">{t("lastSynced")}</th>
            <th className="text-end ps-2 pe-3 py-2 font-medium">{t("actions")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-primary">
          {sources.map((source) => (
            <tr key={source.id} className="hover:bg-bg-secondary/50">
              <td className="ps-3 pe-2 py-2">
                <div className="font-medium text-fg-primary">{source.name}</div>
                <div className="text-xs text-fg-muted">{source.bindUpn}</div>
                {source.lastSyncError && (
                  <div className="text-xs text-destructive mt-0.5" title={source.lastSyncError}>
                    {source.lastSyncError.slice(0, 80)}
                  </div>
                )}
              </td>
              <td className="ps-2 pe-2 py-2 text-fg-secondary whitespace-nowrap">{source.url}</td>
              <td className="ps-2 pe-2 py-2">
                <button
                  type="button"
                  onClick={() => void onToggle(source)}
                  disabled={busyId === source.id && busyKind === "toggle"}
                  aria-label={t(source.enabled ? "disableSourceAria" : "enableSourceAria", { name: source.name })}
                  className={
                    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border transition-colors " +
                    (source.enabled
                      ? "bg-status-success/10 border-status-success/30 text-status-success"
                      : "bg-bg-surface-2 border-border-primary text-fg-muted")
                  }
                >
                  <span className={"h-1.5 w-1.5 rounded-full " + (source.enabled ? "bg-status-success" : "bg-fg-muted")} />
                  {source.enabled ? t("enabled") : t("disabled")}
                </button>
              </td>
              <td className="ps-2 pe-2 py-2 text-fg-secondary whitespace-nowrap">
                {source.lastSyncedAt ? dateTime(source.lastSyncedAt) : tc("never")}
              </td>
              <td className="ps-2 pe-3 py-2 text-end">
                <div className="inline-flex items-center gap-1.5">
                  <Button variant="outline" size="sm" onClick={() => void onTest(source.id)} disabled={busyId === source.id}>
                    {busyId === source.id && busyKind === "test" ? t("ldapTesting") : t("ldapTestConnection")}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => void onSync(source.id)} disabled={busyId === source.id}>
                    {busyId === source.id && busyKind === "sync" ? t("ldapSyncing") : t("ldapSyncNow")}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => onEdit(source)}>
                    {t("edit")}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => void onDelete(source)} disabled={busyId === source.id}>
                    {t("delete")}
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
"use client";

import { memo } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useFormattedDate } from "@/lib/date/useFormattedDate";

type SyncGroup = {
  id: string;
  name: string;
  dn: string | null;
  lastSyncedAt: string | null;
  memberCount: number;
  department: { id: string; name: string } | null;
  ownerDepartment: { id: string; name: string } | null;
  ownerDepartmentId: string | null;
  source: "ldap" | "manual";
};

type Department = { id: string; name: string };

type Props = {
  group: SyncGroup;
  departments: Department[];
  isExpanded: boolean;
  onRename: (_id: string, _name: string) => void;
  onSetOwnerDepartment: (_id: string, _departmentId: string) => void;
  onToggleMembers: (_id: string) => void;
  onRemove: (_id: string) => void;
  expandedSlot?: React.ReactNode;
};

export const GroupRow = memo(function GroupRow({
  group,
  departments,
  isExpanded,
  onRename,
  onSetOwnerDepartment,
  onToggleMembers,
  onRemove,
  expandedSlot,
}: Props) {
  const t = useTranslations("admin");
  const tc = useTranslations("common");
  const { dateTime } = useFormattedDate();

  return (
    <>
      <div className="flex flex-col gap-3 rounded-lg border border-border-primary p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <input
              className="font-medium text-fg-primary bg-transparent border border-transparent hover:border-border-primary rounded px-1 py-0.5 text-sm w-48 focus:outline-none focus:border-border-primary"
              defaultValue={group.name}
              onBlur={(e) => {
                if (e.target.value.trim() && e.target.value.trim() !== group.name) {
                  onRename(group.id, e.target.value);
                }
              }}
              aria-label={t("groupName")}
            />
            <span
              className={
                "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium " +
                (group.source === "manual"
                  ? "bg-accent/10 border border-accent text-accent"
                  : "bg-bg-surface-2 border border-border-primary text-fg-secondary")
              }
            >
              {group.source === "manual" ? t("sourceManual") : t("sourceLdap")}
            </span>
            {group.dn && <span className="text-xs text-fg-tertiary">{group.dn}</span>}
          </div>
          <p className="mt-1 text-xs text-fg-secondary">
            {t("membersCount", { count: group.memberCount })}
            {" · "}
            {group.department ? (
              <>
                {t("groupDepartment")}: {group.department.name}
              </>
            ) : (
              t("noLinkedDepartment")
            )}
            {" · "}
            {group.ownerDepartment
              ? <>
                  {t("ownerDepartment")}: {group.ownerDepartment.name}
                </>
              : null}
            {group.source === "ldap" && (
              <>
                {" · "}
                {t("lastSynced")}: {group.lastSyncedAt ? dateTime(group.lastSyncedAt) : tc("never")}
              </>
            )}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <label className="text-xs text-fg-muted">{t("ownerDepartment")}</label>
            <select
              value={group.ownerDepartment?.id ?? ""}
              onChange={(e) => onSetOwnerDepartment(group.id, e.target.value)}
              className="text-xs bg-bg-primary border border-border-primary rounded px-2 py-1 text-fg-muted"
            >
              <option value="">{t("noOwnerDepartment")}</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => onToggleMembers(group.id)}>
            {isExpanded ? t("hideMembers") : t("showMembers")}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onRemove(group.id)}>
            {t("delete")}
          </Button>
        </div>
      </div>
      {expandedSlot}
    </>
  );
});
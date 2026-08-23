"use client";

import { memo } from "react";
import { useTranslations } from "next-intl";

type GroupGrant = {
  groupId: string;
  role: string;
  grantedAt: string;
  memberCount: number;
  group: { id: string; name: string; source: "ldap" | "manual" };
};

export type GroupOption = {
  id: string;
  name: string;
  source: "ldap" | "manual";
  memberCount: number;
};

type RoleOption = { value: string; label: string };

type GroupGrantsPanelProps = {
  grants: GroupGrant[];
  groupOptions: GroupOption[];
  roles: RoleOption[];
  canAssignRoles: boolean;
  loading: boolean;
  groupId: string;
  role: string;
  granting: boolean;
  onGroupChange: (_groupId: string) => void;
  onRoleChange: (_role: string) => void;
  onGrant: () => void;
  onChangeGrantRole: (_groupId: string, _role: string) => void;
  onRevoke: (_groupId: string) => void;
};

export const GroupGrantsPanel = memo(function GroupGrantsPanel({
  grants,
  groupOptions,
  roles,
  canAssignRoles,
  loading,
  groupId,
  role,
  granting,
  onGroupChange,
  onRoleChange,
  onGrant,
  onChangeGrantRole,
  onRevoke,
}: GroupGrantsPanelProps) {
  const t = useTranslations("project.members");

  return (
    <div className="pt-4 mt-4 border-t border-border-secondary space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-fg">{t("groupGrants")}</h3>
        <p className="text-xs text-fg-muted mt-0.5">{t("groupGrantsNote")}</p>
      </div>

      {loading ? (
        <p className="text-sm text-fg-muted text-center py-3">{t("loading")}</p>
      ) : grants.length === 0 ? (
        <p className="text-sm text-fg-muted text-center py-3">{t("noGroupGrants")}</p>
      ) : (
        <div className="space-y-2">
          {grants.map((grant) => (
            <div
              key={grant.groupId}
              className="flex items-center gap-3 p-3 rounded-lg border border-border-secondary"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-fg-primary truncate">{grant.group.name}</p>
                <p className="text-xs text-fg-muted truncate">
                  {t("membersCount", { count: grant.memberCount })}
                  {" · "}
                  {grant.group.source === "manual" ? t("sourceManual") : t("sourceLdap")}
                </p>
              </div>
              {canAssignRoles && (
                <>
                  <select
                    value={grant.role}
                    onChange={(e) => onChangeGrantRole(grant.groupId, e.target.value)}
                    className="text-xs px-2 py-1 border border-border-primary rounded-lg bg-bg-primary text-fg-primary focus:outline-none focus:ring-1 focus:ring-accent shrink-0"
                  >
                    {roles.map((item) => (
                      <option key={item.value} value={item.value}>{item.label}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => onRevoke(grant.groupId)}
                    className="text-xs text-fg-muted hover:text-destructive transition-colors shrink-0"
                  >
                    {t("revoke")}
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {canAssignRoles && groupOptions.length > 0 && (
        <div className="flex gap-2">
          <select
            value={groupId}
            onChange={(e) => onGroupChange(e.target.value)}
            aria-label={t("selectGroup")}
            className="flex-1 px-2 py-2 border border-border-primary rounded-lg bg-bg-primary text-fg-primary text-sm focus:outline-none focus:ring-1 focus:ring-accent"
          >
            <option value="">{t("selectGroup")}</option>
            {groupOptions.map((group) => (
              <option key={group.id} value={group.id}>{group.name}</option>
            ))}
          </select>
          <select
            value={role}
            onChange={(e) => onRoleChange(e.target.value)}
            className="px-2 py-2 border border-border-primary rounded-lg bg-bg-primary text-fg-primary text-sm focus:outline-none focus:ring-1 focus:ring-accent"
          >
            {roles.map((item) => (
              <option key={item.value} value={item.value}>{item.label}</option>
            ))}
          </select>
          <button
            onClick={onGrant}
            disabled={!groupId || granting}
            className="px-4 py-2 text-sm font-medium rounded-md bg-accent text-fg-inverse hover:opacity-90 transition-opacity disabled:opacity-40 shrink-0"
          >
            {granting ? t("saving") : t("grant")}
          </button>
        </div>
      )}
    </div>
  );
});

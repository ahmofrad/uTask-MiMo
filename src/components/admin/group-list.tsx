"use client";

import { memo } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { GroupCreateDialog } from "./group-create-dialog";
import { GroupMembersPanel } from "./group-members-panel";
import { GroupRow } from "./group-row";
import { useGroupList } from "./use-group-list";

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

const inputClass =
  "w-full px-3 py-2 border border-border-primary rounded-lg bg-bg-primary text-fg-primary text-sm focus:outline-none focus:ring-1 focus:ring-accent";

export const GroupList = memo(function GroupList({
  groups: initial,
  departments,
  canSearchAd,
  hiddenGroupCount = 0,
}: {
  groups: SyncGroup[];
  departments: Department[];
  canSearchAd: boolean;
  hiddenGroupCount?: number;
}) {
  const t = useTranslations("admin");
  const gl = useGroupList(initial, departments);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {canSearchAd ? (
          <div className="relative">
            <input
              className={inputClass}
              value={gl.search}
              onChange={(e) => void gl.handleSearch(e.target.value)}
              placeholder={t("ldapSearchGroups")}
            />
            {gl.suggestions.length > 0 && (
              <ul className="absolute z-10 mt-1 w-full max-h-56 overflow-auto rounded-lg border border-border-primary bg-bg-primary shadow-lg">
                {gl.suggestions.map((s) => (
                  <li key={s.dn}>
                    <button
                      type="button"
                      onClick={() => void gl.handleAddAdGroup(s)}
                      className="w-full text-start px-3 py-2 text-sm text-fg-primary hover:bg-bg-surface"
                    >
                      <span className="block">{s.name}</span>
                      <span className="block text-xs text-fg-muted">{s.dn}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <div />
        )}
        <div className="flex items-center gap-3">
          <Button onClick={() => gl.setCreateOpen(true)}>{t("newGroup")}</Button>
          {canSearchAd && (
            <Button variant="outline" onClick={() => void gl.handleSync()} disabled={gl.syncing}>
              {gl.syncing ? t("ldapSyncing") : t("ldapSyncNow")}
            </Button>
          )}
          {gl.syncMsg && <span className="text-sm text-fg-muted">{gl.syncMsg}</span>}
        </div>
      </div>

      {hiddenGroupCount > 0 && (
        <p className="rounded-lg border border-border-primary bg-bg-surface px-3 py-2 text-sm text-fg-secondary">
          {t("scopedGroupsNote", { count: hiddenGroupCount })}
        </p>
      )}

      {gl.groups.length === 0 ? (
        <p className="text-sm text-fg-tertiary">{t("ldapNoGroups")}</p>
      ) : (
        <div className="space-y-2">
          {gl.groups.map((group) => (
            <GroupRow
              key={group.id}
              group={group}
              departments={departments}
              isExpanded={gl.expandedId === group.id}
              onRename={gl.handleRename}
              onSetOwnerDepartment={gl.handleSetOwnerDepartment}
              onToggleMembers={(id) => void gl.toggleMembers(id)}
              onRemove={gl.handleRemoveGroup}
              expandedSlot={
                gl.expandedId === group.id ? (
                  <GroupMembersPanel
                    groupId={group.id}
                    members={gl.members[group.id] ?? []}
                    loading={gl.loadingId === group.id}
                    query={gl.memberQuery[group.id] ?? ""}
                    suggestions={gl.memberSuggestions[group.id] ?? []}
                    addError={gl.memberAddError[group.id] ?? null}
                    addNote={gl.memberAddNote[group.id] ?? null}
                    onQueryChange={(groupId, q) => void gl.searchUsers(groupId, q)}
                    onAddMember={(groupId, user) => void gl.addMember(groupId, user)}
                    onRemoveMember={(groupId, userId) => void gl.removeMember(groupId, userId)}
                  />
                ) : undefined
              }
            />
          ))}
        </div>
      )}

      <GroupCreateDialog
        open={gl.createOpen}
        departments={departments}
        onClose={() => gl.setCreateOpen(false)}
        onCreated={(group) => {
          gl.setCreateOpen(false);
        }}
      />
    </div>
  );
});

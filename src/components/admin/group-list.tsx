"use client";

import { Fragment, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { apiFetch } from "@/lib/api-fetch";
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
type Suggestion = { dn: string; name: string };
type UserOption = { id: string; displayName: string; email: string };
type GroupMember = { id: string; displayName: string; email: string };

const inputClass =
  "w-full px-3 py-2 border border-border-primary rounded-lg bg-bg-primary text-fg-primary text-sm focus:outline-none focus:ring-1 focus:ring-accent";

export function GroupList({
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
  const tc = useTranslations("common");
  const { dateTime } = useFormattedDate();

  const [groups, setGroups] = useState<SyncGroup[]>(initial);
  const [search, setSearch] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [members, setMembers] = useState<Record<string, GroupMember[]>>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);

  // New-group dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createOwnerDept, setCreateOwnerDept] = useState("");
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createError, setCreateError] = useState("");

  // Member search + add state
  const [memberQuery, setMemberQuery] = useState<Record<string, string>>({});
  const [memberSuggestions, setMemberSuggestions] = useState<Record<string, UserOption[]>>({});
  const [memberAddError, setMemberAddError] = useState<Record<string, string>>({});
  const [memberAddNote, setMemberAddNote] = useState<Record<string, string>>({});

  async function handleSearch(q: string) {
    setSearch(q);
    if (!q.trim()) {
      setSuggestions([]);
      return;
    }
    try {
      const res = await apiFetch(`/api/v1/admin/ldap/groups?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const json = await res.json();
        setSuggestions(json.data ?? []);
      }
    } catch {
      setSuggestions([]);
    }
  }

  async function handleAddAdGroup(g: Suggestion) {
    try {
      const res = await apiFetch("/api/v1/admin/ldap/groups", {
        method: "POST",
        body: JSON.stringify({ dn: g.dn, name: g.name }),
      });
      if (res.ok) {
        const json = await res.json();
        const created = json.data as SyncGroup;
        setGroups((prev) => [
          { ...created, memberCount: created.memberCount ?? 0, ownerDepartment: null },
          ...prev.filter((x) => x.dn !== g.dn),
        ]);
        setSearch("");
        setSuggestions([]);
      }
    } catch {
      /* ignore */
    }
  }

  async function handleRename(groupId: string, name: string) {
    if (!name.trim()) return;
    const res = await apiFetch(`/api/v1/groups/${groupId}`, {
      method: "PATCH",
      body: JSON.stringify({ name: name.trim() }),
    });
    if (res.ok) {
      const json = await res.json();
      setGroups((prev) => prev.map((g) => (g.id === groupId ? { ...g, name: json.data.name } : g)));
    }
  }

  async function handleSetOwnerDepartment(groupId: string, ownerDepartmentId: string) {
    const res = await apiFetch(`/api/v1/groups/${groupId}`, {
      method: "PATCH",
      body: JSON.stringify({ ownerDepartmentId: ownerDepartmentId || null }),
    });
    if (res.ok) {
      const json = await res.json();
      const dept = departments.find((d) => d.id === json.data.ownerDepartmentId) ?? null;
      setGroups((prev) => prev.map((g) => (g.id === groupId ? { ...g, ownerDepartment: dept } : g)));
    }
  }

  async function handleRemoveGroup(id: string) {
    try {
      const res = await apiFetch(`/api/v1/groups/${id}`, { method: "DELETE" });
      if (res.ok) setGroups((prev) => prev.filter((x) => x.id !== id));
    } catch {
      /* ignore */
    }
  }

  async function handleCreateGroup(e: React.FormEvent) {
    e.preventDefault();
    if (!createName.trim() || createSubmitting) return;
    setCreateSubmitting(true);
    setCreateError("");
    try {
      const res = await apiFetch("/api/v1/groups", {
        method: "POST",
        body: JSON.stringify({
          name: createName.trim(),
          ...(createOwnerDept ? { ownerDepartmentId: createOwnerDept } : {}),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setCreateError(json.error?.message ?? t("syncFailed"));
        return;
      }
      const created = json.data as SyncGroup;
      setGroups((prev) => [
        {
          ...created,
          memberCount: 0,
          department: null,
          ownerDepartment: departments.find((d) => d.id === created.ownerDepartmentId) ?? null,
          source: "manual",
        },
        ...prev,
      ]);
      setCreateOpen(false);
      setCreateName("");
      setCreateOwnerDept("");
    } catch {
      setCreateError(t("syncFailed"));
    } finally {
      setCreateSubmitting(false);
    }
  }

  async function loadMembers(groupId: string): Promise<GroupMember[]> {
    try {
      const res = await apiFetch(`/api/v1/groups/${groupId}/members`);
      const data = res.ok ? ((await res.json()).data ?? []) : [];
      setMembers((prev) => ({ ...prev, [groupId]: data }));
      return data;
    } catch {
      setMembers((prev) => ({ ...prev, [groupId]: [] }));
      return [];
    }
  }

  async function toggleMembers(groupId: string) {
    if (expandedId === groupId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(groupId);
    if (members[groupId] || loadingId) return;
    setLoadingId(groupId);
    try {
      await loadMembers(groupId);
    } finally {
      setLoadingId(null);
    }
  }

  async function searchUsers(groupId: string, q: string) {
    setMemberQuery((prev) => ({ ...prev, [groupId]: q }));
    if (!q.trim()) {
      setMemberSuggestions((prev) => ({ ...prev, [groupId]: [] }));
      return;
    }
    try {
      // Ensure the current members are loaded BEFORE filtering, so members
      // already in the group never appear as add suggestions (kills the race
      // where typing right after expanding double-added existing members).
      const currentMembers = members[groupId] ?? (await loadMembers(groupId));
      const existingIds = new Set(currentMembers.map((m) => m.id));
      const res = await apiFetch(`/api/v1/users/search?q=${encodeURIComponent(q)}&limit=8`);
      if (res.ok) {
        const json = await res.json();
        setMemberSuggestions((prev) => ({
          ...prev,
          [groupId]: (json.data ?? []).filter((u: UserOption) => !existingIds.has(u.id)),
        }));
      } else {
        setMemberSuggestions((prev) => ({ ...prev, [groupId]: [] }));
      }
    } catch {
      setMemberSuggestions((prev) => ({ ...prev, [groupId]: [] }));
    }
  }

  async function addMember(groupId: string, user: UserOption) {
    const res = await apiFetch(`/api/v1/groups/${groupId}/members`, {
      method: "POST",
      body: JSON.stringify({ userId: user.id }),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok && json.alreadyMember) {
      // Already in the group — do not double-add or bump the count.
      setMemberAddNote((prev) => ({ ...prev, [groupId]: t("alreadyMember") }));
      setMemberQuery((prev) => ({ ...prev, [groupId]: "" }));
      setMemberSuggestions((prev) => ({ ...prev, [groupId]: [] }));
      return;
    }
    if (res.ok) {
      setMembers((prev) => {
        const existing = prev[groupId] ?? [];
        if (existing.some((m) => m.id === user.id)) return prev;
        return { ...prev, [groupId]: [...existing, { id: user.id, displayName: user.displayName, email: user.email }] };
      });
      setGroups((prev) => prev.map((g) => (g.id === groupId ? { ...g, memberCount: g.memberCount + 1 } : g)));
      setMemberQuery((prev) => ({ ...prev, [groupId]: "" }));
      setMemberSuggestions((prev) => ({ ...prev, [groupId]: [] }));
      setMemberAddError((prev) => ({ ...prev, [groupId]: "" }));
      setMemberAddNote((prev) => ({ ...prev, [groupId]: "" }));
    } else {
      setMemberAddError((prev) => ({ ...prev, [groupId]: json.error?.message ?? t("syncFailed") }));
    }
  }

  async function removeMember(groupId: string, userId: string) {
    const res = await apiFetch(`/api/v1/groups/${groupId}/members/${userId}`, { method: "DELETE" });
    if (res.ok) {
      setMembers((prev) => ({
        ...prev,
        [groupId]: (prev[groupId] ?? []).filter((m) => m.id !== userId),
      }));
      setGroups((prev) => prev.map((g) => (g.id === groupId ? { ...g, memberCount: Math.max(0, g.memberCount - 1) } : g)));
    }
  }

  async function handleSync() {
    setSyncing(true);
    setSyncMsg("");
    try {
      const res = await apiFetch("/api/v1/admin/ldap/sync", { method: "POST" });
      const json = await res.json();
      if (res.ok) {
        setSyncMsg(t("ldapSyncDone", { users: json.data.users, groups: json.data.groups }));
      } else {
        setSyncMsg(t("syncFailed"));
      }
    } catch {
      setSyncMsg(t("syncFailed"));
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {canSearchAd ? (
          <div className="relative">
            <input
              className={inputClass}
              value={search}
              onChange={(e) => void handleSearch(e.target.value)}
              placeholder={t("ldapSearchGroups")}
            />
            {suggestions.length > 0 && (
              <ul className="absolute z-10 mt-1 w-full max-h-56 overflow-auto rounded-lg border border-border-primary bg-bg-primary shadow-lg">
                {suggestions.map((s) => (
                  <li key={s.dn}>
                    <button
                      type="button"
                      onClick={() => void handleAddAdGroup(s)}
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
          <Button onClick={() => setCreateOpen(true)}>{t("newGroup")}</Button>
          {canSearchAd && (
            <Button variant="outline" onClick={() => void handleSync()} disabled={syncing}>
              {syncing ? t("ldapSyncing") : t("ldapSyncNow")}
            </Button>
          )}
          {syncMsg && <span className="text-sm text-fg-muted">{syncMsg}</span>}
        </div>
      </div>

      {hiddenGroupCount > 0 && (
        <p className="rounded-lg border border-border-primary bg-bg-surface px-3 py-2 text-sm text-fg-secondary">
          {t("scopedGroupsNote", { count: hiddenGroupCount })}
        </p>
      )}

      {groups.length === 0 ? (
        <p className="text-sm text-fg-tertiary">{t("ldapNoGroups")}</p>
      ) : (
        <div className="space-y-2">
          {groups.map((group) => (
            <Fragment key={group.id}>
            <div className="flex flex-col gap-3 rounded-lg border border-border-primary p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    className="font-medium text-fg-primary bg-transparent border border-transparent hover:border-border-primary rounded px-1 py-0.5 text-sm w-48 focus:outline-none focus:border-border-primary"
                    defaultValue={group.name}
                    onBlur={(e) => {
                      if (e.target.value.trim() && e.target.value.trim() !== group.name) {
                        void handleRename(group.id, e.target.value);
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
                    onChange={(e) => void handleSetOwnerDepartment(group.id, e.target.value)}
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
                <Button variant="outline" size="sm" onClick={() => void toggleMembers(group.id)}>
                  {expandedId === group.id ? t("hideMembers") : t("showMembers")}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => void handleRemoveGroup(group.id)}>
                  {t("delete")}
                </Button>
              </div>
            </div>
            {expandedId === group.id && (
              <div className="mt-2 ms-4 ps-4 border-s border-border-primary space-y-2">
                <div className="relative max-w-sm">
                  <input
                    className={inputClass}
                    value={memberQuery[group.id] ?? ""}
                    onChange={(e) => void searchUsers(group.id, e.target.value)}
                    placeholder={t("addMemberPlaceholder")}
                  />
                  {(memberSuggestions[group.id] ?? []).length > 0 && (
                    <ul className="absolute z-10 mt-1 w-full max-h-56 overflow-auto rounded-lg border border-border-primary bg-bg-primary shadow-lg">
                      {(memberSuggestions[group.id] ?? []).map((u) => (
                        <li key={u.id}>
                          <button
                            type="button"
                            onClick={() => void addMember(group.id, u)}
                            className="w-full text-start px-3 py-2 text-sm text-fg-primary hover:bg-bg-surface"
                          >
                            <span className="block">{u.displayName}</span>
                            <span className="block text-xs text-fg-muted">{u.email}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                {memberAddError[group.id] && (
                  <p className="text-xs text-destructive">{memberAddError[group.id]}</p>
                )}
                {memberAddNote[group.id] && (
                  <p className="text-xs text-fg-muted">{memberAddNote[group.id]}</p>
                )}
                {loadingId === group.id ? (
                  <p className="text-sm text-fg-muted">{tc("loading")}</p>
                ) : (members[group.id] ?? []).length === 0 ? (
                  <p className="text-sm text-fg-tertiary">{t("noGroupMembers")}</p>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-border-primary">
                    <table className="w-full text-sm">
                      <thead className="bg-bg-secondary text-fg-secondary">
                        <tr>
                          <th className="text-start ps-3 pe-2 py-2 font-medium">{t("memberColumn")}</th>
                          <th className="text-start ps-2 pe-2 py-2 font-medium">{t("emailColumn")}</th>
                          <th className="text-end ps-2 pe-3 py-2 font-medium">{t("actions")}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border-primary">
                        {(members[group.id] ?? []).map((member) => (
                          <tr key={member.id} className="hover:bg-bg-secondary/50">
                            <td className="ps-3 pe-2 py-2 text-fg-primary whitespace-nowrap">
                              {member.displayName}
                            </td>
                            <td className="ps-2 pe-2 py-2 text-fg-secondary">
                              {member.email ?? "—"}
                            </td>
                            <td className="ps-2 pe-3 py-2 text-end">
                              <button
                                type="button"
                                onClick={() => void removeMember(group.id, member.id)}
                                className="text-xs text-fg-muted hover:text-destructive"
                                aria-label={t("removeMember", { name: member.displayName })}
                              >
                                ✕
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
            </Fragment>
          ))}
        </div>
      )}

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)}>
        <form onSubmit={(e) => void handleCreateGroup(e)} className="space-y-4 p-5">
          <h3 className="text-lg font-semibold text-fg-primary">{t("newGroup")}</h3>
          <div>
            <label className="block text-sm font-medium text-fg-secondary mb-1.5">
              {t("groupName")} *
            </label>
            <input
              className={inputClass}
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-fg-secondary mb-1.5">
              {t("ownerDepartment")}
            </label>
            <select
              className={inputClass}
              value={createOwnerDept}
              onChange={(e) => setCreateOwnerDept(e.target.value)}
            >
              <option value="">{t("noOwnerDepartment")}</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          {createError && <p className="text-sm text-destructive">{createError}</p>}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button type="submit" disabled={createSubmitting || !createName.trim()}>
              {createSubmitting ? tc("loading") : t("createGroup")}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}

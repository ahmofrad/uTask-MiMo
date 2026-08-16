"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Avatar } from "@/components/ui/avatar";
import { Dialog } from "@/components/ui/dialog";
import { apiFetch } from "@/lib/api-fetch";

type Member = {
  userId: string;
  projectRole: string;
  addedAt: string;
  user: { id: string; displayName: string; email: string; avatarUrl: string | null };
};

type UserSearchResult = {
  id: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
};

type GroupGrant = {
  groupId: string;
  role: string;
  grantedAt: string;
  memberCount: number;
  group: { id: string; name: string; source: "ldap" | "manual" };
};

type GroupOption = {
  id: string;
  name: string;
  source: "ldap" | "manual";
  memberCount: number;
};

export function MembersModal({
  open,
  onClose,
  projectId,
  canAssignRoles,
}: {
  open: boolean;
  onClose: () => void;
  projectId: string;
  canAssignRoles: boolean;
}) {
  const t = useTranslations("project.members");
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  const [grants, setGrants] = useState<GroupGrant[]>([]);
  const [groupOptions, setGroupOptions] = useState<GroupOption[]>([]);
  const [grantsLoading, setGrantsLoading] = useState(false);
  const [grantGroupId, setGrantGroupId] = useState("");
  const [grantRole, setGrantRole] = useState("contributor");
  const [granting, setGranting] = useState(false);

  const ROLES = [
    { value: "lead", label: t("lead") },
    { value: "contributor", label: t("contributor") },
    { value: "viewer", label: t("viewer") },
  ];
  const [selectedRole, setSelectedRole] = useState("contributor");

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch(`/api/v1/projects/${projectId}/members`)
      .then((r) => r.json())
      .then((j) => { setMembers(j.data ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [open, projectId]);

  useEffect(() => {
    if (!open) return;
    setGrantsLoading(true);
    apiFetch(`/api/v1/projects/${projectId}/group-grants`)
      .then(async (r) => {
        if (!r.ok) return;
        const j = await r.json();
        setGrants(j.data ?? []);
        setGroupOptions((j.groups ?? []).filter(
          (g: GroupOption) => !(j.data ?? []).some((grant: GroupGrant) => grant.groupId === g.id),
        ));
      })
      .catch(() => {})
      .finally(() => setGrantsLoading(false));
  }, [open, projectId]);

  useEffect(() => {
    if (!open) { setQuery(""); setResults([]); }
  }, [open]);

  async function searchUsers(q: string) {
    setQuery(q);
    if (q.length < 1) { setResults([]); return; }
    setSearching(true);
    try {
      const params = new URLSearchParams({ q, projectId, limit: "8" });
      const res = await fetch(`/api/v1/users/search?${params}`);
      const j = await res.json();
      setResults(j.data ?? []);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }

  async function addMember(user: UserSearchResult) {
    const res = await apiFetch(`/api/v1/projects/${projectId}/members`, {
      method: "POST",
      body: JSON.stringify({ userId: user.id, projectRole: selectedRole }),
    });
    if (res.ok) {
      setMembers((prev) => [
        ...prev,
        { userId: user.id, projectRole: selectedRole, addedAt: new Date().toISOString(), user },
      ]);
      setQuery("");
      setResults([]);
    }
  }

  async function removeMember(userId: string) {
    const res = await apiFetch(`/api/v1/projects/${projectId}/members/${userId}`, { method: "DELETE" });
    if (res.ok) {
      setMembers((prev) => prev.filter((m) => m.userId !== userId));
    }
  }

  async function changeRole(userId: string, newRole: string) {
    const res = await apiFetch(`/api/v1/admin/projects/${projectId}/members/${userId}`, {
      method: "PATCH",
      body: JSON.stringify({ projectRole: newRole }),
    });
    if (res.ok) {
      setMembers((prev) => prev.map((m) => m.userId === userId ? { ...m, projectRole: newRole } : m));
    }
  }

  async function grantAccess() {
    if (!grantGroupId || granting) return;
    setGranting(true);
    try {
      const res = await apiFetch(`/api/v1/projects/${projectId}/group-grants`, {
        method: "POST",
        body: JSON.stringify({ groupId: grantGroupId, role: grantRole }),
      });
      if (res.ok) {
        const selected = groupOptions.find((g) => g.id === grantGroupId);
        if (selected) {
          setGrants((prev) => [...prev, {
            groupId: selected.id,
            role: grantRole,
            grantedAt: new Date().toISOString(),
            memberCount: selected.memberCount,
            group: { id: selected.id, name: selected.name, source: selected.source },
          }]);
        }
        setGroupOptions((prev) => prev.filter((g) => g.id !== grantGroupId));
        setGrantGroupId("");
        setGrantRole("contributor");
      }
    } finally {
      setGranting(false);
    }
  }

  async function changeGrantRole(groupId: string, newRole: string) {
    const res = await apiFetch(`/api/v1/projects/${projectId}/group-grants`, {
      method: "POST",
      body: JSON.stringify({ groupId, role: newRole }),
    });
    if (res.ok) {
      setGrants((prev) => prev.map((g) => g.groupId === groupId ? { ...g, role: newRole } : g));
    }
  }

  async function revokeGrant(groupId: string) {
    const res = await apiFetch(`/api/v1/projects/${projectId}/group-grants/${groupId}`, { method: "DELETE" });
    if (res.ok) {
      setGrants((prev) => prev.filter((g) => g.groupId !== groupId));
      const revoked = grants.find((g) => g.groupId === groupId);
      if (revoked) {
        setGroupOptions((prev) => [...prev, {
          id: revoked.groupId,
          name: revoked.group.name,
          source: revoked.group.source,
          memberCount: revoked.memberCount,
        }]);
      }
    }
  }

  if (!open) return null;

  return (
    <Dialog open={open} onClose={onClose} title={t("title")} className="max-w-lg flex flex-col max-h-[80vh] p-0">
      {/* Search + role selector */}
      <div className="px-6 py-4 border-b border-border-secondary space-y-3">
          <div className="flex gap-2">
            <input
              value={query}
              onChange={(e) => searchUsers(e.target.value)}
              placeholder={t("searchPlaceholder")}
              className="flex-1 px-3 py-2 border border-border-primary rounded-lg bg-bg-primary text-fg-primary text-sm focus:outline-none focus:ring-1 focus:ring-accent"
            />
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="px-2 py-2 border border-border-primary rounded-lg bg-bg-primary text-fg-primary text-sm focus:outline-none focus:ring-1 focus:ring-accent"
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>

          {/* Search results */}
          {results.length > 0 && (
            <div className="bg-bg-surface border border-border-primary rounded-lg shadow-lg max-h-48 overflow-y-auto">
              {results.map((user) => (
                <button
                  key={user.id}
                  onClick={() => addMember(user)}
                  className="w-full flex items-center gap-3 px-3 py-2 hover:bg-bg-secondary transition-colors text-start"
                >
                  <Avatar
                    initials={user.displayName?.slice(0, 2).toUpperCase() ?? "?"}
                    imageUrl={user.avatarUrl}
                    size="sm"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-fg-primary truncate">{user.displayName}</p>
                    <p className="text-xs text-fg-muted truncate">{user.email}</p>
                  </div>
                  <span className="ms-auto text-xs text-fg-muted capitalize">{selectedRole}</span>
                </button>
              ))}
            </div>
          )}
          {searching && (
            <p className="text-xs text-fg-muted text-center">{t("searching")}</p>
          )}
        </div>

        {/* Members list */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
          {loading ? (
            <p className="text-sm text-fg-muted text-center py-4">{t("loading")}</p>
          ) : members.length === 0 ? (
            <p className="text-sm text-fg-muted text-center py-8">{t("noMembers")}</p>
          ) : (
            members.map((member) => (
              <div
                key={member.userId}
                className="flex items-center gap-3 p-3 rounded-lg border border-border-secondary hover:bg-bg-secondary/50 transition-colors"
              >
                <Avatar
                  initials={member.user.displayName?.slice(0, 2).toUpperCase() ?? "?"}
                  imageUrl={member.user.avatarUrl}
                  size="sm"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-fg-primary truncate">{member.user.displayName}</p>
                  <p className="text-xs text-fg-muted truncate">{member.user.email}</p>
                </div>
                <select
                  value={member.projectRole}
                  onChange={(e) => changeRole(member.userId, e.target.value)}
                  className="text-xs px-2 py-1 border border-border-primary rounded-lg bg-bg-primary text-fg-primary focus:outline-none focus:ring-1 focus:ring-accent shrink-0"
                >
                  {ROLES.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
                <button
                  onClick={() => removeMember(member.userId)}
                  className="text-xs text-fg-muted hover:text-destructive transition-colors shrink-0"
                >
                  {t("remove")}
                </button>
              </div>
            ))
          )}

          {/* Group grants */}
          <div className="pt-4 mt-4 border-t border-border-secondary space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-fg">{t("groupGrants")}</h3>
              <p className="text-xs text-fg-muted mt-0.5">{t("groupGrantsNote")}</p>
            </div>

            {grantsLoading ? (
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
                          onChange={(e) => changeGrantRole(grant.groupId, e.target.value)}
                          className="text-xs px-2 py-1 border border-border-primary rounded-lg bg-bg-primary text-fg-primary focus:outline-none focus:ring-1 focus:ring-accent shrink-0"
                        >
                          {ROLES.map((r) => (
                            <option key={r.value} value={r.value}>{r.label}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => revokeGrant(grant.groupId)}
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
                  value={grantGroupId}
                  onChange={(e) => setGrantGroupId(e.target.value)}
                  aria-label={t("selectGroup")}
                  className="flex-1 px-2 py-2 border border-border-primary rounded-lg bg-bg-primary text-fg-primary text-sm focus:outline-none focus:ring-1 focus:ring-accent"
                >
                  <option value="">{t("selectGroup")}</option>
                  {groupOptions.map((g) => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
                <select
                  value={grantRole}
                  onChange={(e) => setGrantRole(e.target.value)}
                  className="px-2 py-2 border border-border-primary rounded-lg bg-bg-primary text-fg-primary text-sm focus:outline-none focus:ring-1 focus:ring-accent"
                >
                  {ROLES.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
                <button
                  onClick={() => void grantAccess()}
                  disabled={!grantGroupId || granting}
                  className="px-4 py-2 text-sm font-medium rounded-md bg-accent text-fg-inverse hover:opacity-90 transition-opacity disabled:opacity-40 shrink-0"
                >
                  {granting ? t("saving") : t("grant")}
                </button>
              </div>
            )}
          </div>
        </div>
    </Dialog>
  );
}

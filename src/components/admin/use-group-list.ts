"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api-fetch";

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

export function useGroupList(initial: SyncGroup[], departments: Department[]) {
  const t = useTranslations("admin");

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

  return {
    groups,
    search,
    suggestions,
    syncing,
    syncMsg,
    expandedId,
    members,
    loadingId,
    createOpen,
    memberQuery,
    memberSuggestions,
    memberAddError,
    memberAddNote,
    setSearch,
    setCreateOpen,
    handleSearch,
    handleAddAdGroup,
    handleRename,
    handleSetOwnerDepartment,
    handleRemoveGroup,
    toggleMembers,
    searchUsers,
    addMember,
    removeMember,
    handleSync,
  };
}

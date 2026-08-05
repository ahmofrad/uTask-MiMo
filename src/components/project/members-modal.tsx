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

export function MembersModal({
  open,
  onClose,
  projectId,
}: {
  open: boolean;
  onClose: () => void;
  projectId: string;
}) {
  const t = useTranslations("project.members");
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);

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
      </div>
    </Dialog>
  );
}

"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Avatar } from "@/components/ui/avatar";
import { apiFetch } from "@/lib/api-fetch";

type UserSearchResult = {
  id: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
};

type MemberInviteFormProps = {
  projectId: string;
  roles: { value: string; label: string }[];
  defaultRole: string;
  onMemberAdded: (_user: UserSearchResult, _role: string) => void;
};

export function MemberInviteForm({
  projectId,
  roles,
  defaultRole,
  onMemberAdded,
}: MemberInviteFormProps) {
  const t = useTranslations("project.members");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedRole, setSelectedRole] = useState(defaultRole);

  async function searchUsers(q: string) {
    setQuery(q);
    if (q.length < 1) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const params = new URLSearchParams({ q, projectId, limit: "8" });
      const res = await apiFetch(`/api/v1/users/search?${params}`);
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
      onMemberAdded(user, selectedRole);
      setQuery("");
      setResults([]);
    }
  }

  return (
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
          {roles.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
      </div>

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
  );
}

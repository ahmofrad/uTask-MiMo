"use client";

import { useState } from "react";
import { Avatar } from "@/components/ui/avatar";
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

export function MembersClient({
  projectId,
  initialMembers,
}: {
  projectId: string;
  initialMembers: Member[];
}) {
  const [members, setMembers] = useState(initialMembers);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

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
      body: JSON.stringify({ userId: user.id, projectRole: "contributor" }),
    });
    if (res.ok) {
      setMembers((prev) => [
        ...prev,
        { userId: user.id, projectRole: "contributor", addedAt: new Date().toISOString(), user },
      ]);
      setQuery("");
      setResults([]);
      setShowSearch(false);
    }
  }

  async function removeMember(userId: string) {
    const res = await apiFetch(`/api/v1/projects/${projectId}/members/${userId}`, { method: "DELETE" });
    if (res.ok) {
      setMembers((prev) => prev.filter((m) => m.userId !== userId));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-fg-primary">Project Members</h1>
        <button
          onClick={() => setShowSearch(!showSearch)}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-accent text-fg-inverse hover:opacity-90 transition-opacity"
        >
          + Add member
        </button>
      </div>

      {/* Add member search */}
      {showSearch && (
        <div className="border border-border-primary rounded-xl bg-bg-surface p-5 space-y-3">
          <h2 className="text-xs font-medium text-fg-muted uppercase tracking-wide">Add member</h2>
          <div className="relative">
            <input
              value={query}
              onChange={(e) => searchUsers(e.target.value)}
              placeholder="Search by name or email..."
              className="w-full px-3 py-2 border border-border-primary rounded-lg bg-bg-primary text-fg-primary text-sm focus:outline-none focus:ring-1 focus:ring-accent"
              autoFocus
            />
            {results.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-bg-primary border border-border-primary rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
                {results.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => addMember(user)}
                    className="w-full flex items-center gap-3 px-3 py-2 hover:bg-bg-surface transition-colors text-start"
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
                  </button>
                ))}
              </div>
            )}
            {searching && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-bg-primary border border-border-primary rounded-lg shadow-lg z-50 p-3 text-center text-xs text-fg-muted">
                Searching...
              </div>
            )}
          </div>
        </div>
      )}

      {/* Members list */}
      <div className="border border-border-primary rounded-xl bg-bg-surface p-5 space-y-3">
        {members.length === 0 ? (
          <p className="text-sm text-fg-muted text-center py-8">No members yet. Add someone to get started.</p>
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
              <span className="text-xs px-2 py-1 rounded-full bg-accent/10 text-accent capitalize shrink-0">
                {member.projectRole}
              </span>
              <button
                onClick={() => removeMember(member.userId)}
                className="text-xs text-fg-muted hover:text-destructive transition-colors shrink-0"
              >
                Remove
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

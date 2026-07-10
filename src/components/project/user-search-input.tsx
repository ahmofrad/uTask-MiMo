"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Avatar } from "@/components/ui/avatar";

type User = {
  id: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
};

type UserSearchInputProps = {
  projectId: string;
  onSelect: (_user: User) => void;
  placeholder?: string;
  excludeIds?: string[];
};

export function UserSearchInput({ projectId, onSelect, placeholder = "Search users...", excludeIds = [] }: UserSearchInputProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<User[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const search = useCallback(async (q: string) => {
    if (q.length < 1) { setResults([]); return; }
    setLoading(true);
    try {
      const params = new URLSearchParams({ q, projectId, limit: "8" });
      const res = await fetch(`/api/v1/users/search?${params}`);
      const j = await res.json();
      setResults((j.data ?? []).filter((u: User) => !excludeIds.includes(u.id)));
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [projectId, excludeIds]);

  useEffect(() => {
    const timer = setTimeout(() => search(query), 200);
    return () => clearTimeout(timer);
  }, [query, search]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function select(user: User) {
    onSelect(user);
    setQuery("");
    setResults([]);
    setOpen(false);
    inputRef.current?.focus();
  }

  return (
    <div ref={wrapperRef} className="relative">
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-border-primary rounded-lg bg-bg-primary text-fg-primary text-sm focus:outline-none focus:ring-1 focus:ring-accent"
      />
      {open && (query.length > 0 || results.length > 0) && (
        <div className="absolute top-full start-0 end-0 mt-1 bg-bg-primary border border-border-primary rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
          {loading && (
            <div className="p-3 text-center text-xs text-fg-muted">Searching...</div>
          )}
          {!loading && results.length === 0 && query.length > 0 && (
            <div className="p-3 text-center text-xs text-fg-muted">No users found</div>
          )}
          {results.map((user) => (
            <button
              key={user.id}
              onClick={() => select(user)}
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
    </div>
  );
}

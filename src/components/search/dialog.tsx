"use client";

import { useState, useRef, useEffect, useCallback } from "react";

type SearchResult = {
  tasks?: { id: string; title: string; status: string; projectId: string }[];
  projects?: { id: string; name: string; color: string }[];
  comments?: { id: string; bodyMarkdown: string; taskId: string }[];
  customFieldValues?: {
    id: string; valueText: string | null;
    task: { id: string; title: string };
    customField: { name: string };
  }[];
};

export function SearchDialog() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "/" && !open) {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === "Escape" && open) {
        setOpen(false);
        setQuery("");
        setResults(null);
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults(null);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/search?q=${encodeURIComponent(q)}&limit=10`);
      const json = await res.json();
      setResults(json.data);
    } catch {
      setResults(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => search(query), 200);
    return () => clearTimeout(timer);
  }, [query, search]);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  if (!open) return null;

  const totalCount =
    (results?.tasks?.length ?? 0) +
    (results?.projects?.length ?? 0) +
    (results?.comments?.length ?? 0) +
    (results?.customFieldValues?.length ?? 0);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      <div className="fixed inset-0 bg-black/40" onClick={() => setOpen(false)} />
      <div className="relative w-full max-w-lg bg-bg-primary border border-border-primary rounded-xl shadow-2xl overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border-primary">
          <svg className="w-5 h-5 text-fg-tertiary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tasks, projects, comments..."
            className="flex-1 bg-transparent text-fg-primary placeholder:text-fg-tertiary outline-none"
          />
          <kbd className="text-xs text-fg-tertiary border border-border-primary rounded px-1.5 py-0.5">ESC</kbd>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {loading && (
            <p className="p-4 text-sm text-fg-tertiary text-center">Searching...</p>
          )}
          {!loading && query.length >= 2 && totalCount === 0 && (
            <p className="p-4 text-sm text-fg-tertiary text-center">No results found.</p>
          )}
          {results?.tasks && results.tasks.length > 0 && (
            <Section title="Tasks">
              {results.tasks.map((t) => (
                <ResultItem key={t.id} href={`/tasks/${t.id}`} label={t.title} sub={t.status} />
              ))}
            </Section>
          )}
          {results?.projects && results.projects.length > 0 && (
            <Section title="Projects">
              {results.projects.map((p) => (
                <ResultItem key={p.id} href={`/projects/${p.id}`} label={p.name} />
              ))}
            </Section>
          )}
          {results?.comments && results.comments.length > 0 && (
            <Section title="Comments">
              {results.comments.map((c) => (
                <ResultItem key={c.id} href={`/tasks/${c.taskId}`} label={c.bodyMarkdown.slice(0, 80)} />
              ))}
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="px-4 py-2 text-xs font-semibold uppercase text-fg-tertiary bg-bg-secondary">{title}</p>
      {children}
    </div>
  );
}

function ResultItem({ href, label, sub }: { href: string; label: string; sub?: string }) {
  return (
    <a
      href={href}
      className="flex items-center justify-between px-4 py-2.5 hover:bg-accent/5 text-sm text-fg-primary"
    >
      <span className="truncate">{label}</span>
      {sub && <span className="text-xs text-fg-tertiary shrink-0 ms-2">{sub}</span>}
    </a>
  );
}

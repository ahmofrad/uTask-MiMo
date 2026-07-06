"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

type Result = {
  id: string;
  title: string;
  type: "task" | "project";
};

export function QuickAddPalette() {
  const t = useTranslations("search");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const router = useRouter();

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((v) => !v);
        setQuery("");
        setResults([]);
      }
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/v1/search?q=${encodeURIComponent(query)}&limit=8`);
        const j = await res.json();
        setResults((j.data ?? []).map((r: { id: string; title?: string; name?: string; __typename?: string }) => ({
          id: r.id,
          title: r.title ?? r.name ?? "",
          type: (r.__typename ?? "").toLowerCase() === "project" ? "project" : "task",
        })));
      } catch {
        // ignore
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [query]);

  const navigate = useCallback(
    (item: Result) => {
      setOpen(false);
      if (item.type === "project") {
        router.push(`/projects/${item.id}`);
      } else {
        router.push(`/tasks/${item.id}`);
      }
    },
    [router],
  );

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && results[selectedIdx]) {
      navigate(results[selectedIdx]);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      <div className="fixed inset-0 bg-black/40" onClick={() => setOpen(false)} />
      <div className="relative w-full max-w-lg bg-bg-primary border border-border-primary rounded-xl shadow-2xl overflow-hidden">
        <input
          autoFocus
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelectedIdx(0);
          }}
          onKeyDown={handleKeyDown}
          placeholder={t("searchInput")}
          className="w-full px-4 py-3 text-sm bg-transparent text-fg-primary border-b border-border-primary outline-none placeholder:text-fg-tertiary"
        />
        {results.length > 0 && (
          <ul className="max-h-64 overflow-y-auto p-1">
            {results.map((item, i) => (
              <li
                key={item.id}
                onClick={() => navigate(item)}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm cursor-pointer ${
                  i === selectedIdx ? "bg-accent/10 text-accent" : "text-fg-primary hover:bg-bg-secondary"
                }`}
              >
                <span className="text-xs text-fg-tertiary uppercase min-w-[4rem]">
                  {item.type}
                </span>
                <span className="truncate">{item.title}</span>
              </li>
            ))}
          </ul>
        )}
        {query && results.length === 0 && (
          <p className="px-4 py-3 text-sm text-fg-tertiary text-center">{t("noResults")}</p>
        )}
        <div className="px-4 py-2 text-xs text-fg-tertiary border-t border-border-primary flex justify-between">
          <span>{t("keyboardHint")}</span>
          <span className="font-mono">⌘K</span>
        </div>
      </div>
    </div>
  );
}

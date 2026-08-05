"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useFocusTrap } from "@/hooks/use-focus-trap";

type CommandItem = {
  id: string;
  label: string;
  category: string;
  action: () => void;
  shortcut?: string;
};

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const paletteRef = useRef<HTMLDivElement>(null);
  useFocusTrap(paletteRef, open);
  const t = useTranslations("search");
  const router = useRouter();

  const commands: CommandItem[] = [
    { id: "dashboard", label: t("goToDashboard"), category: t("navigation"), action: () => router.push("/") },
    { id: "projects", label: t("goToProjects"), category: t("navigation"), action: () => router.push("/projects") },
    { id: "settings", label: t("openSettings"), category: t("navigation"), action: () => router.push("/settings") },
    { id: "admin", label: t("adminPanel"), category: t("navigation"), action: () => router.push("/admin/users") },
  ];

  const filtered = commands.filter((c) =>
    c.label.toLowerCase().includes(query.toLowerCase()) ||
    c.category.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((v) => !v);
        setQuery("");
        setSelectedIndex(0);
      }
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && filtered[selectedIndex]) {
      filtered[selectedIndex].action();
      setOpen(false);
    }
  }, [filtered, selectedIndex]);

  if (!open) return null;

  return (
    <div
      ref={paletteRef}
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
    >
      <div className="fixed inset-0 bg-bg-overlay" onClick={() => setOpen(false)} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("placeholder")}
        className="relative w-full max-w-lg bg-bg-primary border border-border-primary rounded-xl shadow-2xl overflow-hidden"
      >
        <input
          ref={inputRef}
          autoFocus
          value={query}
          onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0); }}
          onKeyDown={handleKeyDown}
          placeholder={t("placeholder")}
          className="w-full px-4 py-3 text-sm bg-transparent text-fg-primary border-b border-border-primary outline-none placeholder:text-fg-subtle"
        />
        {filtered.length > 0 && (
          <ul className="max-h-64 overflow-y-auto p-1">
            {filtered.map((item, i) => (
              <li
                key={item.id}
                onClick={() => { item.action(); setOpen(false); }}
                className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm cursor-pointer ${
                  i === selectedIndex ? "bg-accent/10 text-accent" : "text-fg-primary hover:bg-bg-surface"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs text-fg-tertiary w-20">{item.category}</span>
                  <span>{item.label}</span>
                </div>
                {item.shortcut && (
                  <span className="text-xs text-fg-subtle font-mono">{item.shortcut}</span>
                )}
              </li>
            ))}
          </ul>
        )}
        {query && filtered.length === 0 && (
          <p className="px-4 py-6 text-sm text-fg-muted text-center">{t("noResults")}</p>
        )}
        <div className="px-4 py-2 text-xs text-fg-subtle border-t border-border-primary flex justify-between">
          <span>{t("hint")}</span>
          <span className="font-mono">⌘K</span>
        </div>
      </div>
    </div>
  );
}

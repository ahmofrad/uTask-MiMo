"use client";

import { useMemo, useRef, useState } from "react";

export type AssigneeOption = {
  id: string;
  displayName: string;
  avatarUrl?: string | null;
};

type AssigneeSelectProps = {
  members: AssigneeOption[];
  value: string[];
  onChange: (_ids: string[]) => void;
  placeholder?: string;
};

export function AssigneeSelect({ members, value, onChange, placeholder }: AssigneeSelectProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selected = useMemo(
    () => members.filter((m) => value.includes(m.id)),
    [members, value],
  );

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    return members
      .filter((m) => !value.includes(m.id))
      .filter((m) => q === "" || m.displayName.toLowerCase().includes(q))
      .slice(0, 8);
  }, [members, value, query]);

  function add(id: string) {
    if (!value.includes(id)) onChange([...value, id]);
    setQuery("");
  }

  function remove(id: string) {
    onChange(value.filter((v) => v !== id));
  }

  function handleFocus() {
    if (blurTimer.current) clearTimeout(blurTimer.current);
    setOpen(true);
  }

  function handleBlur() {
    blurTimer.current = setTimeout(() => setOpen(false), 120);
  }

  return (
    <div className="relative">
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {selected.map((m) => (
            <span
              key={m.id}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-accent/10 border border-accent text-accent"
            >
              {m.displayName}
              <button
                type="button"
                onClick={() => remove(m.id)}
                className="leading-none opacity-70 hover:opacity-100"
                aria-label={`Remove ${m.displayName}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <input
        type="text"
        value={query}
        autoComplete="off"
        placeholder={placeholder}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={handleFocus}
        onBlur={handleBlur}
        className="w-full px-3 py-2 border border-border-primary rounded-lg bg-bg-surface text-fg-primary text-sm placeholder:text-fg-muted"
      />

      {open && suggestions.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full max-h-56 overflow-auto rounded-lg border border-border-primary bg-bg-primary shadow-md">
          {suggestions.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                className="w-full text-start px-3 py-2 text-sm text-fg-primary hover:bg-bg-surface transition-colors"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => add(m.id)}
              >
                {m.displayName}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

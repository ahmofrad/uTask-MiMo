"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

type Subtask = {
  id: string;
  title: string;
  status: string;
};

type SubtaskListProps = {
  subtasks: Subtask[];
  onToggle: (_id: string, _status: string) => void;
  onAdd: (_title: string) => void;
  onRename?: (_id: string, _title: string) => void;
  onDelete?: (_id: string) => void;
};

export function SubtaskList({ subtasks, onToggle, onAdd, onRename, onDelete }: SubtaskListProps) {
  const t = useTranslations("task");
  const [newTitle, setNewTitle] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");

  async function handleAdd() {
    if (!newTitle.trim() || adding) return;
    setAdding(true);
    try {
      await onAdd(newTitle.trim());
      setNewTitle("");
    } finally {
      setAdding(false);
    }
  }

  function startEdit(st: Subtask) {
    setEditingId(st.id);
    setEditDraft(st.title);
  }

  function saveEdit(id: string) {
    if (!editDraft.trim() || !onRename) {
      setEditingId(null);
      return;
    }
    if (editDraft.trim() !== subtasks.find((s) => s.id === id)?.title) {
      onRename(id, editDraft.trim());
    }
    setEditingId(null);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-fg-primary">
          {t("subtasks")} ({subtasks.length})
        </h3>
      </div>

      <div className="space-y-1">
        {subtasks.map((st) => (
          <div key={st.id} className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-bg-surface-2 group">
            <input
              type="checkbox"
              checked={st.status === "done"}
              onChange={() => onToggle(st.id, st.status === "done" ? "open" : "done")}
              className="rounded border-border-primary accent-accent shrink-0"
            />
            {editingId === st.id ? (
              <input
                value={editDraft}
                onChange={(e) => setEditDraft(e.target.value)}
                onBlur={() => saveEdit(st.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveEdit(st.id);
                  if (e.key === "Escape") setEditingId(null);
                }}
                className="flex-1 text-sm bg-transparent border-b border-accent text-fg outline-none"
                autoFocus
              />
            ) : (
              <span
                className={`flex-1 text-sm cursor-pointer hover:text-accent transition-colors ${st.status === "done" ? "line-through text-fg-muted" : "text-fg-primary"}`}
                onClick={() => startEdit(st)}
              >
                {st.title}
              </span>
            )}
            {onDelete && editingId !== st.id && (
              <button
                onClick={() => onDelete(st.id)}
                className="opacity-0 group-hover:opacity-100 text-fg-subtle hover:text-destructive transition-all p-0.5"
                aria-label="Delete subtask"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 mt-2">
        <input
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          placeholder={t("addSubtask")}
          className="flex-1 px-2 py-1 text-sm bg-transparent text-fg-primary placeholder:text-fg-subtle focus:outline-none"
        />
      </div>
    </div>
  );
}

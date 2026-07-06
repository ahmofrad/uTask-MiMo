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
};

export function SubtaskList({ subtasks, onToggle, onAdd }: SubtaskListProps) {
  const t = useTranslations("task");
  const [newTitle, setNewTitle] = useState("");
  const [adding, setAdding] = useState(false);

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

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-fg-primary">
          {t("subtasks")} ({subtasks.length})
        </h3>
      </div>

      <div className="space-y-1">
        {subtasks.map((st) => (
          <label key={st.id} className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-bg-surface-2 cursor-pointer">
            <input
              type="checkbox"
              checked={st.status === "done"}
              onChange={() => onToggle(st.id, st.status === "done" ? "open" : "done")}
              className="rounded border-border-primary accent-accent"
            />
            <span className={`text-sm ${st.status === "done" ? "line-through text-fg-muted" : "text-fg-primary"}`}>
              {st.title}
            </span>
          </label>
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

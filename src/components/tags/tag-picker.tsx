"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api-fetch";

type Tag = { id: string; name: string; color?: string | null };

type Props = {
  projectId: string;
  value: string[];
  onChange: (_tagIds: string[]) => void;
};

export function TagPicker({ projectId, value, onChange }: Props) {
  const t = useTranslations("task");
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const fetchTags = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/v1/tags?projectId=${projectId}`);
      if (res.ok) {
        const body = await res.json();
        setTags(body.data ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  function toggle(id: string) {
    if (value.includes(id)) {
      onChange(value.filter((v) => v !== id));
    } else {
      onChange([...value, id]);
    }
  }

  async function createTag() {
    const name = newName.trim();
    if (!name) return;
    const res = await apiFetch("/api/v1/tags", {
      method: "POST",
      body: JSON.stringify({ name, projectId }),
    });
    if (res.ok) {
      const body = await res.json();
      const created: Tag = body.data;
      setTags((prev) => [...prev, created]);
      setNewName("");
      if (!value.includes(created.id)) onChange([...value, created.id]);
    }
  }

  async function saveEdit() {
    if (!editingId) return;
    const name = editName.trim();
    if (!name) {
      setEditingId(null);
      return;
    }
    await apiFetch(`/api/v1/tags/${editingId}`, {
      method: "PATCH",
      body: JSON.stringify({ name }),
    });
    setTags((prev) => prev.map((tg) => (tg.id === editingId ? { ...tg, name } : tg)));
    setEditingId(null);
  }

  async function deleteTagItem(id: string) {
    await apiFetch(`/api/v1/tags/${id}`, { method: "DELETE" });
    setTags((prev) => prev.filter((tg) => tg.id !== id));
    setEditingId(null);
    if (value.includes(id)) onChange(value.filter((v) => v !== id));
  }

  if (loading) {
    return <p className="text-xs text-fg-muted">{t("loading")}</p>;
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {tags.map((tag) => {
          const selected = value.includes(tag.id);
          const isEditing = editingId === tag.id;
          return (
            <span
              key={tag.id}
              className="group relative inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors"
              style={{
                backgroundColor: selected ? (tag.color ?? "#2563eb") : "transparent",
                borderColor: tag.color ?? "#cbd5e1",
                color: selected ? "#fff" : "inherit",
              }}
            >
              <button
                type="button"
                onClick={() => toggle(tag.id)}
                title={t("toggleAssign")}
                className="w-3 h-3 rounded-full border"
                style={{
                  borderColor: selected ? "#fff" : (tag.color ?? "#94a3b8"),
                  backgroundColor: selected ? "#fff" : "transparent",
                }}
              />
              {isEditing ? (
                <input
                  autoFocus
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onBlur={saveEdit}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      saveEdit();
                    } else if (e.key === "Escape") {
                      setEditingId(null);
                    }
                  }}
                  className="bg-transparent outline-none w-24 text-current"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(tag.id);
                    setEditName(tag.name);
                  }}
                  className="bg-transparent text-current"
                >
                  {tag.name}
                </button>
              )}
              <button
                type="button"
                onClick={() => deleteTagItem(tag.id)}
                title={t("delete")}
                className="opacity-0 group-hover:opacity-100 text-current hover:text-destructive transition-opacity"
              >
                ✕
              </button>
            </span>
          );
        })}
        {tags.length === 0 && (
          <span className="text-xs text-fg-muted">{t("noTags")}</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); createTag(); } }}
          placeholder={t("newTag")}
          className="w-40 px-2.5 py-1 text-xs border border-border-primary rounded-lg bg-bg-surface text-fg-primary"
        />
        <button
          type="button"
          onClick={createTag}
          disabled={!newName.trim()}
          className="px-2.5 py-1 text-xs rounded-md border border-border-primary text-fg-secondary hover:bg-bg-surface disabled:opacity-50"
        >
          {t("add")}
        </button>
      </div>
    </div>
  );
}

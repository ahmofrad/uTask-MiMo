"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api-fetch";

type TagData = {
  id: string;
  name: string;
  color: string;
  _count?: { tasks: number };
};

type Props = {
  projectId: string;
  initialTags: TagData[];
  onChange?: () => void;
};

const PRESET_COLORS = [
  "#dc2626", "#16a34a", "#0284c7", "#8b5cf6",
  "#ca8a04", "#ea580c", "#0891b2", "#be185d",
  "#65a30d", "#0d9488", "#4f46e5", "#9333ea",
];

type EditingTag = { id: string; name: string; color: string };

export function TagsManager({ projectId, initialTags, onChange }: Props) {
  const t = useTranslations();
  const tc = useTranslations("common");
  const [tags, setTags] = useState(initialTags);
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(PRESET_COLORS[0] ?? "#94a3b8");
  const [editing, setEditing] = useState<EditingTag | null>(null);

  async function handleCreate() {
    if (!newName.trim()) return;
    try {
      const res = await apiFetch("/api/v1/tags", {
        method: "POST",
        body: JSON.stringify({
          name: newName.trim(),
          color: newColor,
          projectId,
        }),
      });
      if (res.ok) {
        const result = await res.json();
        setTags((prev) => [...prev, { ...result.data, _count: { tasks: 0 } }]);
        setNewName("");
        setShowForm(false);
        onChange?.();
      }
    } catch {
      // silent
    }
  }

  async function handleUpdate() {
    if (!editing || !editing.name.trim()) return;
    try {
      const res = await apiFetch(`/api/v1/tags/${editing.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: editing.name.trim(), color: editing.color }),
      });
      if (res.ok) {
        const result = await res.json();
        setTags((prev) => prev.map((t) => (t.id === editing.id ? { ...t, ...result.data } : t)));
        setEditing(null);
        onChange?.();
      }
    } catch {
      // silent
    }
  }

  async function handleDelete(id: string) {
    const res = await apiFetch(`/api/v1/tags/${id}`, { method: "DELETE" });
    if (res.ok) {
      setTags((prev) => prev.filter((t) => t.id !== id));
      onChange?.();
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 text-sm font-medium rounded-md bg-accent text-fg-inverse hover:opacity-90 transition-opacity"
        >
          + {t("task.tags")}
        </button>
      </div>

      {showForm && (
        <div className="p-4 bg-bg-surface border border-border rounded-xl space-y-3">
          <div>
            <label className="block text-xs text-fg-muted mb-1">{t("project.fields.name")}</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full px-3 py-2 border border-border-primary rounded-lg bg-bg-primary text-fg-primary text-sm"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs text-fg-muted mb-1.5">{t("project.fields.color")}</label>
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setNewColor(c)}
                  className={`w-7 h-7 rounded-full border-2 transition-[transform,border-color] ${
                    newColor === c ? "border-fg scale-110" : "border-transparent"
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => { setShowForm(false); setNewName(""); }}
              className="px-3 py-1.5 text-sm rounded-md border border-border-primary text-fg-secondary hover:bg-bg-surface"
            >
              {tc("cancel")}
            </button>
            <button
              onClick={handleCreate}
              disabled={!newName.trim()}
              className="px-3 py-1.5 text-sm font-medium rounded-md bg-accent text-fg-inverse hover:opacity-90 disabled:opacity-50"
            >
              {tc("create")}
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {tags.map((tag) => (
          <div key={tag.id} className="flex items-center gap-3 p-3 bg-bg-surface border border-border-primary rounded-lg">
            {editing?.id === tag.id ? (
              <div className="flex-1 flex items-center gap-2">
                <input
                  type="text"
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  className="flex-1 px-2 py-1 border border-border-primary rounded bg-bg-primary text-fg-primary text-sm"
                  autoFocus
                />
                <div className="flex flex-wrap gap-1">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setEditing({ ...editing, color: c })}
                      className={`w-5 h-5 rounded-full border-2 ${
                        editing.color === c ? "border-fg" : "border-transparent"
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
                <button
                  onClick={handleUpdate}
                  className="px-2 py-1 text-xs font-medium rounded-md bg-accent text-fg-inverse"
                >
                  {tc("save")}
                </button>
                <button
                  onClick={() => setEditing(null)}
                  className="px-2 py-1 text-xs rounded-md border border-border-primary text-fg-secondary"
                >
                  {tc("cancel")}
                </button>
              </div>
            ) : (
              <>
                <span
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: tag.color }}
                />
                <span className="flex-1 text-sm text-fg-primary">{tag.name}</span>
                <span className="text-xs text-fg-muted">{tag._count?.tasks ?? 0} tasks</span>
                <button
                  onClick={() => setEditing({ id: tag.id, name: tag.name, color: tag.color })}
                  className="text-xs text-fg-muted hover:text-fg-primary px-1.5 py-0.5 rounded hover:bg-bg-surface-2 transition-colors"
                >
                  {tc("edit")}
                </button>
                <button
                  onClick={() => handleDelete(tag.id)}
                  className="text-xs text-destructive hover:text-destructive/80 px-1.5 py-0.5 rounded hover:bg-danger-bg transition-colors"
                >
                  {tc("delete")}
                </button>
              </>
            )}
          </div>
        ))}
        {tags.length === 0 && (
          <p className="text-sm text-fg-muted text-center py-8">{t("admin.noWebhooks")}</p>
        )}
      </div>
    </div>
  );
}
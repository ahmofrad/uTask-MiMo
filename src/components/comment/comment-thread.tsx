"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { cn } from "@/lib/cn";
import { Avatar } from "@/components/ui/avatar";
import { MentionInput } from "@/components/comment/mention-input";
import { formatDate } from "@/lib/date/format";
import { sanitizeHtml } from "@/lib/markdown/render";
import type { Locale } from "@/lib/date/format";

type Comment = {
  id: string;
  body: string;
  createdAt: string;
  authorId?: string | undefined;
  author: { displayName: string; avatarUrl?: string | null };
};

type CommentThreadProps = {
  comments: Comment[];
  onAdd?: (_body: string) => Promise<void>;
  onUpdate?: (_id: string, _body: string) => Promise<void>;
  onDelete?: (_id: string) => Promise<void>;
  currentUserId?: string;
  className?: string;
};

export function CommentThread({ comments, onAdd, onUpdate, onDelete, currentUserId, className }: CommentThreadProps) {
  const t = useTranslations("comment");
  const tc = useTranslations("common");
  const locale = useLocale() as Locale;
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");

  const handleSubmit = async () => {
    if (!body.trim() || !onAdd || saving) return;
    setSaving(true);
    try {
      await onAdd(body.trim());
      setBody("");
    } catch {
      // ignore
    }
    setSaving(false);
  };

  function stripHtml(html: string): string {
    return html.replace(/<[^>]+>/g, "").trim();
  }

  function startEdit(c: Comment) {
    setEditingId(c.id);
    setEditDraft(stripHtml(c.body));
  }

  async function saveEdit(id: string) {
    if (!editDraft.trim() || !onUpdate) {
      setEditingId(null);
      return;
    }
    if (editDraft.trim() !== comments.find((c) => c.id === id)?.body) {
      await onUpdate(id, editDraft.trim());
    }
    setEditingId(null);
  }

  async function handleDelete(id: string) {
    if (!onDelete) return;
    await onDelete(id);
  }

  return (
    <div className={cn("space-y-4", className)}>
      {comments.map((c) => {
        const isOwn = currentUserId && c.authorId === currentUserId;

        return (
          <div key={c.id} className="flex gap-3 group">
            <Avatar
              initials={c.author.displayName.slice(0, 2).toUpperCase()}
              imageUrl={c.author.avatarUrl}
              size="sm"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-medium text-fg">{c.author.displayName}</span>
                <span className="text-xs text-fg-subtle">
                  {formatDate(new Date(c.createdAt), locale)}
                </span>
                {isOwn && editingId !== c.id && (
                  <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                    <button
                      onClick={() => startEdit(c)}
                      className="text-xs text-fg-subtle hover:text-accent transition-colors"
                    >
                      {tc("edit")}
                    </button>
                    {onDelete && (
                      <>
                        <span className="text-fg-subtle">·</span>
                        <button
                          onClick={() => handleDelete(c.id)}
                          className="text-xs text-fg-subtle hover:text-destructive transition-colors"
                        >
                          {tc("delete")}
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
              {editingId === c.id ? (
                <div>
                  <textarea
                    value={editDraft}
                    onChange={(e) => setEditDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) saveEdit(c.id);
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    rows={3}
                    className="w-full text-sm bg-transparent border border-accent rounded-lg p-2 text-fg outline-none resize-none"
                    autoFocus
                  />
                  <div className="flex items-center gap-2 mt-1">
                    <button
                      onClick={() => saveEdit(c.id)}
                      className="px-2 py-0.5 text-xs font-medium bg-accent text-fg-inverse rounded hover:opacity-90"
                    >
                      {tc("save")}
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="px-2 py-0.5 text-xs text-fg-muted hover:text-fg transition-colors"
                    >
                      {tc("cancel")}
                    </button>
                    <span className="text-xs text-fg-subtle">{tc("escHint")} Esc · Ctrl+Enter</span>
                  </div>
                </div>
              ) : (
                <div
                  className={cn(
                    "text-sm text-fg-muted prose prose-sm max-w-none",
                    isOwn && "cursor-pointer hover:text-fg transition-colors rounded p-1 -m-1 hover:bg-bg-surface-2",
                  )}
                  onClick={() => isOwn && startEdit(c)}
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(c.body) }}
                />
              )}
            </div>
          </div>
        );
      })}
      {onAdd && (
        <div className="flex gap-3 pt-3 border-t border-border">
          <div className="flex-1">
            <MentionInput
              value={body}
              onChange={setBody}
              placeholder={t("placeholder")}
              minRows={2}
              maxRows={6}
            />
            <div className="flex justify-end mt-2">
              <button
                onClick={handleSubmit}
                disabled={!body.trim() || saving}
                className="px-3 py-1 text-sm font-medium bg-accent text-fg-inverse rounded-md hover:opacity-90 disabled:opacity-50"
              >
                {saving ? t("sending") : t("send")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

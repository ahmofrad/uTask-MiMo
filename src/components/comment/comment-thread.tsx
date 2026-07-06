"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { cn } from "@/lib/cn";
import { Avatar } from "@/components/ui/avatar";
import { MentionInput } from "@/components/comment/mention-input";
import { formatDate } from "@/lib/date/format";
import type { Locale } from "@/lib/date/format";

type Comment = {
  id: string;
  body: string;
  createdAt: string;
  author: { displayName: string; avatarUrl?: string | null };
};

type CommentThreadProps = {
  comments: Comment[];
  onAdd?: (_body: string) => Promise<void>;
  className?: string;
};

export function CommentThread({ comments, onAdd, className }: CommentThreadProps) {
  const t = useTranslations("comment");
  const locale = useLocale() as Locale;
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);

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

  return (
    <div className={cn("space-y-4", className)}>
      {comments.map((c) => (
        <div key={c.id} className="flex gap-3">
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
            </div>
            <div className="text-sm text-fg-muted prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: c.body }} />
          </div>
        </div>
      ))}
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

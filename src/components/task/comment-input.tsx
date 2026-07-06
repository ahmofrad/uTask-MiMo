"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

type CommentInputProps = {
  onSubmit: (_body: string) => Promise<void>;
};

export function CommentInput({ onSubmit }: CommentInputProps) {
  const t = useTranslations("comment");
  const taskT = useTranslations("task");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() || loading) return;
    setLoading(true);
    try {
      await onSubmit(body.trim());
      setBody("");
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleSubmit(e);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="border border-border-primary rounded-lg overflow-hidden">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={t("placeholder")}
        rows={3}
        className="w-full px-3 py-2 text-sm bg-bg-surface text-fg-primary placeholder:text-fg-subtle resize-none focus:outline-none"
      />
      <div className="flex items-center justify-between px-3 py-2 bg-bg-surface-2 border-t border-border-primary">
        <span className="text-xs text-fg-subtle">{taskT("ctrlEnterHint")}</span>
        <button
          type="submit"
          disabled={!body.trim() || loading}
          className="px-3 py-1 text-sm font-medium rounded-md bg-accent text-fg-inverse hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {loading ? t("sending") : t("send")}
        </button>
      </div>
    </form>
  );
}

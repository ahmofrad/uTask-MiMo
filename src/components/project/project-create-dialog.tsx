"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Dialog } from "@/components/ui/dialog";
import { apiFetch } from "@/lib/api-fetch";

export function ProjectCreateButton() {
  const t = useTranslations("project");
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg bg-accent text-fg-inverse px-4 py-2 text-sm font-medium hover:bg-accent-hover transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        {t("newProject")}
      </button>
      {open && <ProjectCreateDialog onClose={() => setOpen(false)} />}
    </>
  );
}

function ProjectCreateDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const t = useTranslations("project");
  const tc = useTranslations("common");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#4f46e5");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await apiFetch("/api/v1/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), description: description.trim() || undefined, color }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error?.message ?? t("createFailed"));
      }
      router.refresh();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : tc("unknownError"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open onClose={onClose} title={t("create")} className="max-w-md">
      <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-fg mb-1">{t("fields.name")}</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-md bg-bg-primary text-fg placeholder:text-fg-muted focus:outline-none focus:ring-2 focus:ring-accent"
              placeholder={t("placeholderName")}
              required
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-fg mb-1">{t("fields.description")}</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-md bg-bg-primary text-fg placeholder:text-fg-muted focus:outline-none focus:ring-2 focus:ring-accent resize-none"
              placeholder={t("placeholderDesc")}
              rows={3}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-fg mb-1">{t("fields.color")}</label>
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="w-10 h-10 rounded border border-border cursor-pointer"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-fg-muted hover:text-fg transition-colors"
              disabled={submitting}
            >
              {tc("cancel")}
            </button>
            <button
              type="submit"
              disabled={submitting || !name.trim()}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-accent text-fg-inverse hover:bg-accent-hover disabled:opacity-50 transition-colors"
            >
              {submitting ? t("creating") : t("create")}
            </button>
          </div>
        </form>
    </Dialog>
  );
}

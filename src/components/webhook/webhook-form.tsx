"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import { Input } from "@/components/ui/input";

type WebhookFormData = {
  url: string;
  events: string[];
  secret?: string;
};

type WebhookFormProps = {
  initialData?: WebhookFormData;
  onSubmit: (_data: WebhookFormData) => Promise<void>;
  className?: string;
};

const EVENT_OPTIONS = [
  "task.created", "task.updated", "task.deleted",
  "comment.created", "project.created", "project.updated",
];

export function WebhookForm({ initialData, onSubmit, className }: WebhookFormProps) {
  const t = useTranslations("webhook");
  const [url, setUrl] = useState(initialData?.url ?? "");
  const [events, setEvents] = useState<string[]>(initialData?.events ?? []);
  const [saving, setSaving] = useState(false);

  const toggleEvent = (e: string) => {
    setEvents((prev) => prev.includes(e) ? prev.filter((x) => x !== e) : [...prev, e]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || events.length === 0 || saving) return;
    setSaving(true);
    try {
      await onSubmit({ url: url.trim(), events });
    } catch {
      // ignore
    }
    setSaving(false);
  };

  return (
    <form onSubmit={handleSubmit} className={cn("space-y-4", className)}>
      <div>
        <label className="block text-sm font-medium text-fg mb-1">{t("payloadUrl")}</label>
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={t("payloadUrlPlaceholder")}
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-fg mb-2">{t("fields.events")}</label>
        <div className="space-y-2">
          {EVENT_OPTIONS.map((ev) => (
            <label key={ev} className="flex items-center gap-2 text-sm text-fg">
              <input
                type="checkbox"
                checked={events.includes(ev)}
                onChange={() => toggleEvent(ev)}
                className="rounded border-border text-accent"
              />
              {ev}
            </label>
          ))}
        </div>
      </div>
      <button
        type="submit"
        disabled={!url.trim() || events.length === 0 || saving}
        className="w-full px-4 py-2 text-sm font-medium bg-accent text-fg-inverse rounded-lg hover:opacity-90 disabled:opacity-50"
      >
        {saving ? t("saving") : t("saveWebhook")}
      </button>
    </form>
  );
}

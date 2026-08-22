"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

type CreatePeriodFormProps = {
  onSubmit: (_periodStart: string, _periodEnd: string) => Promise<void>;
  onCancel: () => void;
  busy: boolean;
};

export function CreatePeriodForm({ onSubmit, onCancel, busy }: CreatePeriodFormProps) {
  const t = useTranslations("timesheets");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!periodStart || !periodEnd) return;
    await onSubmit(periodStart, periodEnd);
    setPeriodStart("");
    setPeriodEnd("");
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-end gap-2 rounded-lg border border-border-primary p-4"
    >
      <label className="flex flex-col gap-1 text-sm text-fg-secondary">
        {t("periodStart")}
        <input
          type="date"
          className="rounded border border-border-primary bg-bg-primary px-2 py-1 text-sm"
          value={periodStart}
          onChange={(e) => setPeriodStart(e.target.value)}
          required
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-fg-secondary">
        {t("periodEnd")}
        <input
          type="date"
          className="rounded border border-border-primary bg-bg-primary px-2 py-1 text-sm"
          value={periodEnd}
          onChange={(e) => setPeriodEnd(e.target.value)}
          required
        />
      </label>
      <Button type="submit" size="sm" disabled={busy}>
        {t("createPeriod")}
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
        {t("cancel")}
      </Button>
    </form>
  );
}
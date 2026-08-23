"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api-fetch";
import { Button } from "@/components/ui/button";

export function WebhookRetentionPanel() {
  const t = useTranslations("admin");
  const [eligible, setEligible] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function refresh() {
    const response = await apiFetch("/api/v1/admin/webhook-retention");
    if (!response.ok) throw new Error("retention unavailable");
    const body = await response.json() as { data: { eligible: number } };
    setEligible(body.data.eligible);
  }

  useEffect(() => {
    void refresh().catch(() => setMessage(t("retentionUnavailable")));
  }, [t]);

  async function prune() {
    setBusy(true);
    setMessage(null);
    try {
      const response = await apiFetch("/api/v1/admin/webhook-retention", { method: "POST" });
      if (!response.ok) throw new Error("retention failed");
      const body = await response.json() as { data: { deleted: number } };
      setMessage(t("retentionDeleted", { count: body.data.deleted }));
      await refresh();
    } catch {
      setMessage(t("retentionFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="border border-border-primary rounded-xl bg-bg-surface p-5 space-y-3">
      <h2 className="text-lg font-semibold text-fg-primary">{t("retention")}</h2>
      <p className="text-sm text-fg-muted">
        {eligible === null ? t("loading") : t("retentionEligible", { count: eligible })}
      </p>
      <Button size="sm" variant="outline" disabled={busy || eligible === 0} onClick={() => void prune()}>
        {busy ? t("running") : t("runRetention")}
      </Button>
      {message && <p className="text-sm text-fg-secondary" role="status">{message}</p>}
    </section>
  );
}

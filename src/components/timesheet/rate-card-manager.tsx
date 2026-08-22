"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-fetch";
import { useToast } from "@/components/ui/toast";
import { RateCardCreateForm } from "@/components/timesheet/rate-card-create-form";
import { RateCardTable } from "@/components/timesheet/rate-card-table";

type RateCard = {
  id: string;
  scope: string;
  userId: string | null;
  roleType: string | null;
  costRateMinor: number;
  billRateMinor: number | null;
  currency: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  user: { id: string; displayName: string; email: string } | null;
};

type User = { id: string; displayName: string; email: string };

type RateCardManagerProps = {
  cards: RateCard[];
  users: User[];
};

export function RateCardManager({ cards, users }: RateCardManagerProps) {
  const t = useTranslations("timesheets");
  const { addToast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  async function handleCreate(form: {
    scope: "user" | "role";
    userId: string;
    roleType: string;
    costRateMinor: string;
    billRateMinor: string;
    currency: string;
    effectiveFrom: string;
    effectiveTo: string;
  }) {
    setBusy("create");
    try {
      const body: Record<string, unknown> = {
        scope: form.scope,
        costRateMinor: Number(form.costRateMinor),
        currency: form.currency,
        effectiveFrom: form.effectiveFrom,
      };
      if (form.scope === "user") {
        body.userId = form.userId;
      } else {
        body.roleType = form.roleType;
      }
      if (form.billRateMinor) {
        body.billRateMinor = Number(form.billRateMinor);
      }
      if (form.effectiveTo) {
        body.effectiveTo = form.effectiveTo;
      }

      const res = await apiFetch("/api/v1/rate-cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = (await res.json()) as { error?: { message?: string } };
        addToast({ message: j.error?.message ?? t("rateCardFailed") });
        return;
      }
      addToast({ message: t("rateCardCreated") });
      setShowForm(false);
      window.location.reload();
    } catch {
      addToast({ message: t("rateCardFailed") });
    } finally {
      setBusy(null);
    }
  }

  async function handleDelete(id: string) {
    setBusy(`delete:${id}`);
    try {
      const res = await apiFetch(`/api/v1/rate-cards/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const j = (await res.json()) as { error?: { message?: string } };
        addToast({ message: j.error?.message ?? t("rateCardFailed") });
        return;
      }
      addToast({ message: t("rateCardDeleted") });
      window.location.reload();
    } catch {
      addToast({ message: t("rateCardFailed") });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        {showForm ? (
          <RateCardCreateForm
            users={users}
            busy={busy === "create"}
            onSubmit={handleCreate}
            onCancel={() => setShowForm(false)}
          />
        ) : (
          <Button size="sm" variant="outline" onClick={() => setShowForm(true)}>
            {t("createRateCard")}
          </Button>
        )}
      </div>

      <RateCardTable cards={cards} busy={busy} onDelete={handleDelete} />
    </div>
  );
}
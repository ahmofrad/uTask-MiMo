"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-fetch";
import { useToast } from "@/components/ui/toast";
import { formatDate } from "@/lib/date/format";

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

function formatMinor(minor: number | null, currency: string): string {
  if (minor === null) return "—";
  return `${currency} ${(minor / 100).toFixed(2)}`;
}

export function RateCardManager({ cards, users }: RateCardManagerProps) {
  const t = useTranslations("timesheets");
  const { addToast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [form, setForm] = useState({
    scope: "user" as "user" | "role",
    userId: "",
    roleType: "member" as "owner" | "admin" | "manager" | "member" | "guest",
    costRateMinor: "",
    billRateMinor: "",
    currency: "USD",
    effectiveFrom: "",
    effectiveTo: "",
  });

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
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
      setForm({
        scope: "user",
        userId: "",
        roleType: "member",
        costRateMinor: "",
        billRateMinor: "",
        currency: "USD",
        effectiveFrom: "",
        effectiveTo: "",
      });
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
          <form
            onSubmit={handleCreate}
            className="space-y-3 rounded-lg border border-border-primary p-4"
          >
            <div className="flex gap-4">
              <label className="flex flex-col gap-1 text-sm text-fg-secondary">
                {t("scope")}
                <select
                  className="rounded border border-border-primary bg-bg-primary px-2 py-1 text-sm"
                  value={form.scope}
                  onChange={(e) => setForm({ ...form, scope: e.target.value as "user" | "role" })}
                >
                  <option value="user">{t("user")}</option>
                  <option value="role">{t("role")}</option>
                </select>
              </label>
              {form.scope === "user" ? (
                <label className="flex flex-col gap-1 text-sm text-fg-secondary">
                  {t("user")}
                  <select
                    className="rounded border border-border-primary bg-bg-primary px-2 py-1 text-sm"
                    value={form.userId}
                    onChange={(e) => setForm({ ...form, userId: e.target.value })}
                    required
                  >
                    <option value="">—</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.displayName} ({u.email})
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <label className="flex flex-col gap-1 text-sm text-fg-secondary">
                  {t("role")}
                  <select
                    className="rounded border border-border-primary bg-bg-primary px-2 py-1 text-sm"
                    value={form.roleType}
                    onChange={(e) =>
                      setForm({ ...form, roleType: e.target.value as typeof form.roleType })
                    }
                    required
                  >
                    <option value="owner">Owner</option>
                    <option value="admin">Admin</option>
                    <option value="manager">Manager</option>
                    <option value="member">Member</option>
                    <option value="guest">Guest</option>
                  </select>
                </label>
              )}
            </div>
            <div className="flex gap-4">
              <label className="flex flex-col gap-1 text-sm text-fg-secondary">
                {t("costRateMinor")}
                <input
                  type="number"
                  min="0"
                  step="1"
                  className="rounded border border-border-primary bg-bg-primary px-2 py-1 text-sm"
                  value={form.costRateMinor}
                  onChange={(e) => setForm({ ...form, costRateMinor: e.target.value })}
                  required
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-fg-secondary">
                {t("billRateMinor")}
                <input
                  type="number"
                  min="0"
                  step="1"
                  className="rounded border border-border-primary bg-bg-primary px-2 py-1 text-sm"
                  value={form.billRateMinor}
                  onChange={(e) => setForm({ ...form, billRateMinor: e.target.value })}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-fg-secondary">
                {t("currency")}
                <input
                  type="text"
                  maxLength={3}
                  className="w-16 rounded border border-border-primary bg-bg-primary px-2 py-1 text-sm"
                  value={form.currency}
                  onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })}
                  required
                />
              </label>
            </div>
            <div className="flex gap-4">
              <label className="flex flex-col gap-1 text-sm text-fg-secondary">
                {t("effectiveFrom")}
                <input
                  type="date"
                  className="rounded border border-border-primary bg-bg-primary px-2 py-1 text-sm"
                  value={form.effectiveFrom}
                  onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })}
                  required
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-fg-secondary">
                {t("effectiveTo")}
                <input
                  type="date"
                  className="rounded border border-border-primary bg-bg-primary px-2 py-1 text-sm"
                  value={form.effectiveTo}
                  onChange={(e) => setForm({ ...form, effectiveTo: e.target.value })}
                />
              </label>
            </div>
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={busy === "create"}>
                {t("createRateCard")}
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setShowForm(false)}>
                {t("cancel")}
              </Button>
            </div>
          </form>
        ) : (
          <Button size="sm" variant="outline" onClick={() => setShowForm(true)}>
            {t("createRateCard")}
          </Button>
        )}
      </div>

      {cards.length === 0 ? (
        <div className="rounded-lg border border-border-primary p-8 text-center text-fg-muted">
          {t("noRateCards")}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border-primary">
          <table className="w-full text-sm">
            <thead className="bg-bg-surface">
              <tr>
                <th className="px-4 py-2 text-start font-medium text-fg-secondary">{t("scope")}</th>
                <th className="px-4 py-2 text-start font-medium text-fg-secondary">{t("user")}/{t("role")}</th>
                <th className="px-4 py-2 text-end font-medium text-fg-secondary">{t("costRateMinor")}</th>
                <th className="px-4 py-2 text-end font-medium text-fg-secondary">{t("billRateMinor")}</th>
                <th className="px-4 py-2 text-start font-medium text-fg-secondary">{t("effectiveFrom")}</th>
                <th className="px-4 py-2 text-start font-medium text-fg-secondary">{t("effectiveTo")}</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-primary">
              {cards.map((card) => (
                <tr key={card.id}>
                  <td className="px-4 py-2">
                    <span className="inline-flex items-center rounded-full bg-accent-bg px-2 py-0.5 text-xs font-medium text-accent">
                      {t(card.scope)}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-fg-primary">
                    {card.scope === "user"
                      ? card.user?.displayName ?? "—"
                      : card.roleType ?? "—"}
                  </td>
                  <td className="px-4 py-2 text-end tabular-nums">
                    {formatMinor(card.costRateMinor, card.currency)}
                  </td>
                  <td className="px-4 py-2 text-end tabular-nums">
                    {formatMinor(card.billRateMinor, card.currency)}
                  </td>
                  <td className="px-4 py-2 text-fg-muted">
                    {formatDate(new Date(card.effectiveFrom), "en-US", "gregorian")}
                  </td>
                  <td className="px-4 py-2 text-fg-muted">
                    {card.effectiveTo
                      ? formatDate(new Date(card.effectiveTo), "en-US", "gregorian")
                      : "—"}
                  </td>
                  <td className="px-4 py-2 text-end">
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy === `delete:${card.id}`}
                      onClick={() => handleDelete(card.id)}
                    >
                      {t("delete")}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

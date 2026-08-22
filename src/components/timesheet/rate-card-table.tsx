"use client";

import { useTranslations, useLocale } from "next-intl";
import { Button } from "@/components/ui/button";
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

type RateCardTableProps = {
  cards: RateCard[];
  busy: string | null;
  onDelete: (_id: string) => Promise<void>;
};

function formatMinor(minor: number | null, currency: string): string {
  if (minor === null) return "—";
  return `${currency} ${(minor / 100).toFixed(2)}`;
}

export function RateCardTable({ cards, busy, onDelete }: RateCardTableProps) {
  const t = useTranslations("timesheets");
  const locale = useLocale() as "fa-IR" | "en-US";

  if (cards.length === 0) {
    return (
      <div className="rounded-lg border border-border-primary p-8 text-center text-fg-muted">
        {t("noRateCards")}
      </div>
    );
  }

  return (
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
            <th className="px-4 py-2" />
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
                  : card.roleType
                    ? t(`roles.${card.roleType}`)
                    : "—"}
              </td>
              <td className="px-4 py-2 text-end tabular-nums">
                {formatMinor(card.costRateMinor, card.currency)}
              </td>
              <td className="px-4 py-2 text-end tabular-nums">
                {formatMinor(card.billRateMinor, card.currency)}
              </td>
              <td className="px-4 py-2 text-fg-muted">
                {formatDate(new Date(card.effectiveFrom), locale, "gregorian")}
              </td>
              <td className="px-4 py-2 text-fg-muted">
                {card.effectiveTo
                  ? formatDate(new Date(card.effectiveTo), locale, "gregorian")
                  : "—"}
              </td>
              <td className="px-4 py-2 text-end">
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy === `delete:${card.id}`}
                  onClick={() => onDelete(card.id)}
                >
                  {t("delete")}
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
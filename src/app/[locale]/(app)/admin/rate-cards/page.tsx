import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";
import { can } from "@/lib/rbac/can";
import { getTranslations } from "next-intl/server";
import { RateCardManager } from "@/components/timesheet/rate-card-manager";

export default async function AdminRateCardsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const allowed = await can(session.user.id, "timesheet.manage_rates");
  if (!allowed) redirect("/");

  const t = await getTranslations("timesheets");

  const [cards, users] = await Promise.all([
    prisma.rateCard.findMany({
      orderBy: { effectiveFrom: "desc" },
      include: {
        user: { select: { id: true, displayName: true, email: true } },
      },
    }),
    prisma.user.findMany({
      where: { status: "active" },
      select: { id: true, displayName: true, email: true },
      orderBy: { displayName: "asc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-fg-primary">{t("rateCards")}</h1>
        <p className="text-fg-muted mt-1">{t("rateCardsSubtitle")}</p>
      </div>
      <RateCardManager
        cards={cards.map((c) => ({
          id: c.id,
          scope: c.scope,
          userId: c.userId,
          roleType: c.roleType,
          costRateMinor: c.costRateMinor,
          billRateMinor: c.billRateMinor,
          currency: c.currency,
          effectiveFrom: c.effectiveFrom.toISOString(),
          effectiveTo: c.effectiveTo?.toISOString() ?? null,
          user: c.user
            ? { id: c.user.id, displayName: c.user.displayName, email: c.user.email }
            : null,
        }))}
        users={users}
      />
    </div>
  );
}

import { prisma } from "@/lib/db";

export type ResolvedRate = {
  costRateMinor: number;
  currency: string;
};

/**
 * Resolve the cost rate that applies to a user right now, so a time entry can
 * snapshot it at log time (historical actuals never drift when a rate changes).
 *
 * Precedence: a user-scoped rate card wins; otherwise the card for the user's
 * global role; otherwise a zero-rate fallback in USD.
 */
export async function resolveCostRate(userId: string, at: Date = new Date()): Promise<ResolvedRate> {
  const userCard = await prisma.rateCard.findFirst({
    where: {
      scope: "user",
      userId,
      effectiveFrom: { lte: at },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: at } }],
    },
    orderBy: { effectiveFrom: "desc" },
    select: { costRateMinor: true, currency: true },
  });
  if (userCard) return userCard;

  const role = await prisma.role.findFirst({
    where: { userId, scopeType: "global", scopeId: null },
    select: { type: true },
  });
  if (role) {
    const roleCard = await prisma.rateCard.findFirst({
      where: {
        scope: "role",
        roleType: role.type,
        effectiveFrom: { lte: at },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: at } }],
      },
      orderBy: { effectiveFrom: "desc" },
      select: { costRateMinor: true, currency: true },
    });
    if (roleCard) return roleCard;
  }

  return { costRateMinor: 0, currency: "USD" };
}

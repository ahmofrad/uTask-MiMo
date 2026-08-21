import { NextResponse } from "next/server";
import { requireAuth, requirePermission } from "@/lib/rbac/middleware";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit/log";
import { rateCardCreateSchema, readJsonBody, validationError } from "@/lib/validation/api";

export async function GET(request: Request) {
  const authResult = await requireAuth(request, { params: {} });
  if (authResult instanceof NextResponse) return authResult;

  const guard = requirePermission("timesheet.manage_rates");
  const guardResult = await guard(request, { params: {} });
  if (guardResult) return guardResult;

  const cards = await prisma.rateCard.findMany({
    orderBy: { effectiveFrom: "desc" },
    include: { user: { select: { id: true, displayName: true, email: true } } },
  });

  return NextResponse.json({ data: cards });
}

export async function POST(request: Request) {
  const authResult = await requireAuth(request, { params: {} });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const guard = requirePermission("timesheet.manage_rates");
  const guardResult = await guard(request, { params: {} });
  if (guardResult) return guardResult;

  const parsed = rateCardCreateSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) {
    return NextResponse.json(validationError(parsed.error), { status: 400 });
  }

  const card = await prisma.rateCard.create({
    data: {
      scope: parsed.data.scope,
      userId: parsed.data.userId ?? null,
      roleType: parsed.data.roleType ?? null,
      costRateMinor: parsed.data.costRateMinor,
      billRateMinor: parsed.data.billRateMinor ?? null,
      currency: parsed.data.currency,
      effectiveFrom: new Date(parsed.data.effectiveFrom),
      effectiveTo: parsed.data.effectiveTo ? new Date(parsed.data.effectiveTo) : null,
    },
  });

  await logAudit({
    actorUserId: userId,
    action: "rate_card_created",
    entityType: "rate_card",
    entityId: card.id,
    after: {
      scope: card.scope,
      userId: card.userId,
      roleType: card.roleType,
      costRateMinor: card.costRateMinor,
      billRateMinor: card.billRateMinor,
      currency: card.currency,
    },
  });

  return NextResponse.json({ data: card }, { status: 201 });
}

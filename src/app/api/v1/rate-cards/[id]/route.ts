import { NextResponse } from "next/server";
import { requireAuth, requirePermission } from "@/lib/rbac/middleware";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit/log";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireAuth(request, { params: {} });
  if (authResult instanceof NextResponse) return authResult;

  const guard = requirePermission("timesheet.manage_rates");
  const guardResult = await guard(request, { params: {} });
  if (guardResult) return guardResult;

  const resolvedParams = await params;
  const before = await prisma.rateCard.findFirst({ where: { id: resolvedParams.id, organizationId: authResult.organizationId } });
  if (!before) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Rate card not found" } },
      { status: 404 },
    );
  }

  await prisma.rateCard.deleteMany({ where: { id: resolvedParams.id, organizationId: authResult.organizationId } });

  await logAudit({
    organizationId: authResult.organizationId,
    actorUserId: authResult.userId,
    action: "rate_card_deleted",
    entityType: "rate_card",
    entityId: resolvedParams.id,
    before: {
      scope: before.scope,
      userId: before.userId,
      roleType: before.roleType,
      costRateMinor: before.costRateMinor,
      currency: before.currency,
    },
  });

  return NextResponse.json({ data: { success: true } });
}

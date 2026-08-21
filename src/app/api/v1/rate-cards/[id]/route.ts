import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac/middleware";
import { auth } from "@/lib/auth/config";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit/log";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = requirePermission("timesheet.manage_rates");
  const guardResult = await guard(request, { params: {} });
  if (guardResult) return guardResult;

  const resolvedParams = await params;

  const before = await prisma.rateCard.findUnique({ where: { id: resolvedParams.id } });
  if (!before) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Rate card not found" } },
      { status: 404 },
    );
  }

  await prisma.rateCard.delete({ where: { id: resolvedParams.id } });

  const session = await auth();
  await logAudit({
    actorUserId: session?.user?.id ?? null,
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

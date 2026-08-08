import { NextResponse } from "next/server";
import { requireAuth, requirePermission } from "@/lib/rbac/middleware";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit/log";
import { readJsonBody, userRoleUpdateSchema, validationError } from "@/lib/validation/api";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const resolvedParams = await params;
  const authResult = await requireAuth(request, { params: resolvedParams });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const guard = requirePermission("user:manage");
  const guardResult = await guard(request, { params: resolvedParams });
  if (guardResult) return guardResult;

  const parsed = userRoleUpdateSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) {
    return NextResponse.json(validationError(parsed.error), { status: 400 });
  }
  const { role } = parsed.data;

  // Find current global role
  const currentRole = await prisma.role.findFirst({
    where: { userId: resolvedParams.id, scopeType: "global" },
  });

  const oldRoleType = currentRole?.type ?? null;

  if (currentRole) {
    // Update existing role
    await prisma.role.update({
      where: { id: currentRole.id },
      data: { type: role },
    });
  } else {
    // Create new role
    await prisma.role.create({
      data: {
        userId: resolvedParams.id,
        type: role,
        scopeType: "global",
        scopeId: null,
        grantedBy: userId,
      },
    });
  }

  await logAudit({
    actorUserId: userId,
    action: "updated",
    entityType: "user",
    entityId: resolvedParams.id,
    before: { role: oldRoleType },
    after: { role },
  });

  return NextResponse.json({ data: { role } });
}
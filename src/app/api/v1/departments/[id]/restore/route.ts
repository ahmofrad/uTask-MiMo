import { NextResponse } from "next/server";
import { requireAuth, requirePermission } from "@/lib/rbac/middleware";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit/log";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const authResult = await requireAuth(request, { params: resolvedParams });
  if (authResult instanceof NextResponse) return authResult;
  const guard = requirePermission("org:settings");
  const denied = await guard(request, { params: resolvedParams });
  if (denied) return denied;
  const before = await prisma.department.findUnique({ where: { id: resolvedParams.id }, select: { id: true, deletedAt: true } });
  if (!before) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Department not found" } }, { status: 404 });
  if (!before.deletedAt) return NextResponse.json({ data: { success: true, restored: false } });
  await prisma.department.update({ where: { id: resolvedParams.id }, data: { deletedAt: null } });
  await logAudit({ actorUserId: authResult.userId, action: "updated", entityType: "department", entityId: before.id, before, after: { deletedAt: null } });
  return NextResponse.json({ data: { success: true, restored: true } });
}

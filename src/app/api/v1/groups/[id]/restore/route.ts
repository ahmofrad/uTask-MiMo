import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac/middleware";
import { canManageGroup } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit/log";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const authResult = await requireAuth(request, { params: resolvedParams });
  if (authResult instanceof NextResponse) return authResult;
  if (!(await canManageGroup(authResult.userId, resolvedParams.id))) return NextResponse.json({ error: { code: "FORBIDDEN", message: "Insufficient permissions" } }, { status: 403 });
  const before = await prisma.ldapSyncGroup.findUnique({ where: { id: resolvedParams.id }, select: { id: true, deletedAt: true } });
  if (!before) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Group not found" } }, { status: 404 });
  if (!before.deletedAt) return NextResponse.json({ data: { success: true, restored: false } });
  await prisma.ldapSyncGroup.update({ where: { id: resolvedParams.id }, data: { deletedAt: null } });
  await logAudit({ actorUserId: authResult.userId, action: "updated", entityType: "group", entityId: before.id, before, after: { deletedAt: null } });
  return NextResponse.json({ data: { success: true, restored: true } });
}

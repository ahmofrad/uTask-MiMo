import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac/middleware";
import { canProject, isProjectOwner } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit/log";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const resolvedParams = await params;
  const authResult = await requireAuth(request, { params: resolvedParams });
  if (authResult instanceof NextResponse) return authResult;
  const { userId, organizationId } = authResult;
  const permitted = (await canProject(userId, "project:delete", resolvedParams.projectId, organizationId)) || (await isProjectOwner(userId, resolvedParams.projectId, organizationId));
  if (!permitted) return NextResponse.json({ error: { code: "FORBIDDEN", message: "Insufficient permissions" } }, { status: 403 });

  const before = await prisma.project.findFirst({ where: { id: resolvedParams.projectId, organizationId }, select: { id: true, archivedAt: true } });
  if (!before) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Project not found" } }, { status: 404 });
  if (!before.archivedAt) return NextResponse.json({ data: { success: true, restored: false } });

  const project = await prisma.project.update({ where: { id: resolvedParams.projectId }, data: { archivedAt: null, status: "active" } });
  await logAudit({ organizationId, actorUserId: userId, action: "updated", entityType: "project", entityId: project.id, before, after: { archivedAt: null, status: project.status } });
  return NextResponse.json({ data: { success: true, restored: true } });
}

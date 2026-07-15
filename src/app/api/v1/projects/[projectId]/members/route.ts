import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth, requirePermission } from "@/lib/rbac/middleware";
import { logAudit } from "@/lib/audit/log";

export async function GET(
  _request: Request,
  { params }: { params: { projectId: string } },
) {
  const authResult = await requireAuth(_request, { params });
  if (authResult instanceof NextResponse) return authResult;

  const members = await prisma.projectMember.findMany({
    where: { projectId: params.projectId },
    include: {
      user: { select: { id: true, displayName: true, email: true, avatarUrl: true } },
    },
    orderBy: { addedAt: "asc" },
  });

  return NextResponse.json({ data: members });
}

export async function POST(
  request: Request,
  { params }: { params: { projectId: string } },
) {
  const authResult = await requireAuth(request, { params });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const guard = requirePermission("project_role:assign");
  const guardResult = await guard(request, { params });
  if (guardResult) return guardResult;

  const body = await request.json();
  const { userId: targetUserId, projectRole } = body as { userId?: string; projectRole?: string };

  if (!targetUserId) {
    return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "userId is required" } }, { status: 400 });
  }

  const member = await prisma.projectMember.create({
    data: {
      projectId: params.projectId,
      userId: targetUserId,
      projectRole: (projectRole as never) ?? "contributor",
      addedBy: userId,
    },
  });

  await logAudit({ actorUserId: userId, action: "project_member_added", entityType: "projectMember", entityId: `${params.projectId}:${targetUserId}`, after: member as never });

  return NextResponse.json({ data: member }, { status: 201 });
}
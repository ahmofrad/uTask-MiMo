import { NextResponse } from "next/server";
import { requireAuth, requireAnyPermission } from "@/lib/rbac/middleware";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit/log";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; userId: string }> },
) {
  const resolvedParams = await params;
  const authResult = await requireAuth(request, { params: resolvedParams });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const guard = requireAnyPermission(["user:manage", "project_role:assign"]);
  const guardResult = await guard(request, { params: resolvedParams });
  if (guardResult) return guardResult;

  const body = await request.json();
  const { projectRole } = body as { projectRole?: string };

  const validRoles = ["lead", "contributor", "viewer"];
  if (!projectRole || !validRoles.includes(projectRole)) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: `projectRole must be one of: ${validRoles.join(", ")}` } },
      { status: 400 },
    );
  }

  const membership = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId: resolvedParams.id, userId: resolvedParams.userId } },
  });

  if (!membership) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "User is not a member of this project" } }, { status: 404 });
  }

  const oldRole = membership.projectRole;

  await prisma.projectMember.update({
    where: { projectId_userId: { projectId: resolvedParams.id, userId: resolvedParams.userId } },
    data: { projectRole: projectRole as never },
  });

  await logAudit({
    actorUserId: userId,
    action: "updated",
    entityType: "project_member",
    entityId: `${resolvedParams.id}:${resolvedParams.userId}`,
    before: { projectRole: oldRole },
    after: { projectRole },
  });

  return NextResponse.json({ data: { projectRole } });
}
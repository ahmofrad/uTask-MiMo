import { NextResponse } from "next/server";
import { requireAuth, requireAnyPermission } from "@/lib/rbac/middleware";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit/log";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string; userId: string } },
) {
  const authResult = await requireAuth(request, { params });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const guard = requireAnyPermission(["user:manage", "project_role:assign"]);
  const guardResult = await guard(request, { params });
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
    where: { projectId_userId: { projectId: params.id, userId: params.userId } },
  });

  if (!membership) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "User is not a member of this project" } }, { status: 404 });
  }

  const oldRole = membership.projectRole;

  await prisma.projectMember.update({
    where: { projectId_userId: { projectId: params.id, userId: params.userId } },
    data: { projectRole: projectRole as never },
  });

  await logAudit({
    actorUserId: userId,
    action: "updated",
    entityType: "project_member",
    entityId: `${params.id}:${params.userId}`,
    before: { projectRole: oldRole },
    after: { projectRole },
  });

  return NextResponse.json({ data: { projectRole } });
}
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { can, canProject } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit/log";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string; userId: string } },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }

  // Must be admin globally or lead in this project
  const permitted = await can(session.user.id, "user:manage") ||
    await canProject(session.user.id, "project_role:assign", params.id);
  if (!permitted) {
    return NextResponse.json({ error: { code: "FORBIDDEN" } }, { status: 403 });
  }

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
    actorUserId: session.user.id,
    action: "updated",
    entityType: "project_member",
    entityId: `${params.id}:${params.userId}`,
    before: { projectRole: oldRole },
    after: { projectRole },
  });

  return NextResponse.json({ data: { projectRole } });
}

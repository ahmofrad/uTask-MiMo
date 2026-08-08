import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac/middleware";
import { canProject, canReadProject } from "@/lib/rbac";
import { logAudit } from "@/lib/audit/log";
import { projectMemberCreateSchema, readJsonBody, validationError } from "@/lib/validation/api";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const resolvedParams = await params;
  const authResult = await requireAuth(_request, { params: resolvedParams });
  if (authResult instanceof NextResponse) return authResult;
  if (!(await canReadProject(authResult.userId, resolvedParams.projectId))) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Project not found" } }, { status: 404 });
  }

  const members = await prisma.projectMember.findMany({
    where: { projectId: resolvedParams.projectId },
    include: {
      user: { select: { id: true, displayName: true, email: true, avatarUrl: true } },
    },
    orderBy: { addedAt: "asc" },
  });

  return NextResponse.json({ data: members });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const resolvedParams = await params;
  const authResult = await requireAuth(request, { params: resolvedParams });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  if (!(await canProject(userId, "project_role:assign", resolvedParams.projectId))) {
    return NextResponse.json({ error: { code: "FORBIDDEN" } }, { status: 403 });
  }

  const parsed = projectMemberCreateSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) {
    return NextResponse.json(validationError(parsed.error), { status: 400 });
  }
  const { userId: targetUserId, projectRole } = parsed.data;

  const member = await prisma.projectMember.create({
    data: {
      projectId: resolvedParams.projectId,
      userId: targetUserId,
      projectRole: projectRole ?? "contributor",
      addedBy: userId,
    },
  });

  await logAudit({
    actorUserId: userId,
    action: "project_member_added",
    entityType: "projectMember",
    entityId: resolvedParams.projectId,
    after: { ...member, memberUserId: targetUserId } as never,
  });

  return NextResponse.json({ data: member }, { status: 201 });
}
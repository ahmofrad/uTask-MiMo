import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { can } from "@/lib/rbac";
import { logAudit } from "@/lib/audit/log";
import { emitTaskEvent } from "@/lib/webhook/emit";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }

  const project = await prisma.project.findUnique({
    where: { id: params.id },
    include: {
      _count: { select: { tasks: true, members: true } },
      owner: { select: { id: true, displayName: true, email: true } },
      department: { select: { id: true, name: true } },
    },
  });

  if (!project) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Project not found" } }, { status: 404 });
  }

  return NextResponse.json({ data: project });
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }

  const permitted = await can(session.user.id, "project:create");
  if (!permitted) {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "Insufficient permissions" } }, { status: 403 });
  }

  const body = await request.json();
  const { name, description, color, status, visibility } = body as Record<string, string>;

  const updateData: Record<string, unknown> = {};
  if (name !== undefined) updateData.name = name;
  if (description !== undefined) updateData.description = description;
  if (color !== undefined) updateData.color = color;
  if (status !== undefined) updateData.status = status;
  if (visibility !== undefined) updateData.visibility = visibility;

  const before = await prisma.project.findUnique({ where: { id: params.id } });

  const project = await prisma.project.update({
    where: { id: params.id },
    data: updateData,
  });

  await logAudit({ actorUserId: session.user.id, action: "project_updated", entityType: "project", entityId: params.id, before: before as never, after: project as never });

  await emitTaskEvent("project.updated", params.id, { id: params.id, name: project.name }, session.user.id);

  return NextResponse.json({ data: project });
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }

  const permitted = await can(session.user.id, "project:delete");
  if (!permitted) {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "Insufficient permissions" } }, { status: 403 });
  }

  const before = await prisma.project.findUnique({ where: { id: params.id } });

  await prisma.project.update({
    where: { id: params.id },
    data: { archivedAt: new Date() },
  });

  await logAudit({ actorUserId: session.user.id, action: "project_archived", entityType: "project", entityId: params.id, before: before as never });

  return NextResponse.json({ data: { success: true } });
}

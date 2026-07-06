import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit/log";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }

  const tag = await prisma.tag.findUnique({
    where: { id: params.id },
    include: { _count: { select: { tasks: true } } },
  });

  if (!tag) {
    return NextResponse.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
  }

  return NextResponse.json({ data: tag });
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }

  const permitted = await can(session.user.id, "task:create");
  if (!permitted) {
    return NextResponse.json({ error: { code: "FORBIDDEN" } }, { status: 403 });
  }

  const body = await request.json();
  const { name, color } = body as { name?: string; color?: string };

  const tag = await prisma.tag.findUnique({ where: { id: params.id } });
  if (!tag) {
    return NextResponse.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
  }

  const updated = await prisma.tag.update({
    where: { id: params.id },
    data: {
      ...(name !== undefined ? { name: name.trim() } : {}),
      ...(color !== undefined ? { color } : {}),
    },
  });

  await logAudit({
    actorUserId: session.user.id,
    action: "updated",
    entityType: "tag",
    entityId: params.id,
    before: { name: tag.name, color: tag.color },
    after: { name: updated.name, color: updated.color },
  });

  return NextResponse.json({ data: updated });
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }

  const permitted = await can(session.user.id, "task:create");
  if (!permitted) {
    return NextResponse.json({ error: { code: "FORBIDDEN" } }, { status: 403 });
  }

  const tag = await prisma.tag.findUnique({ where: { id: params.id } });
  if (!tag) {
    return NextResponse.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
  }

  // Remove tag from all tasks first
  await prisma.taskTag.deleteMany({ where: { tagId: params.id } });

  await prisma.tag.delete({ where: { id: params.id } });

  await logAudit({
    actorUserId: session.user.id,
    action: "deleted",
    entityType: "tag",
    entityId: params.id,
    before: { name: tag.name, color: tag.color },
  });

  return NextResponse.json({ data: { success: true } });
}

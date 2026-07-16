import { NextResponse } from "next/server";
import { requireAuth, requirePermission } from "@/lib/rbac/middleware";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit/log";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const resolvedParams = await params;
  const authResult = await requireAuth(_request, { params: resolvedParams });
  if (authResult instanceof NextResponse) return authResult;

  const tag = await prisma.tag.findUnique({
    where: { id: resolvedParams.id },
    include: { _count: { select: { tasks: true } } },
  });

  if (!tag) {
    return NextResponse.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
  }

  return NextResponse.json({ data: tag });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const resolvedParams = await params;
  const authResult = await requireAuth(request, { params: resolvedParams });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const guard = requirePermission("task:create");
  const guardResult = await guard(request, { params: resolvedParams });
  if (guardResult) return guardResult;

  const body = await request.json();
  const { name, color } = body as { name?: string; color?: string };

  const tag = await prisma.tag.findUnique({ where: { id: resolvedParams.id } });
  if (!tag) {
    return NextResponse.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
  }

  const updated = await prisma.tag.update({
    where: { id: resolvedParams.id },
    data: {
      ...(name !== undefined ? { name: name.trim() } : {}),
      ...(color !== undefined ? { color } : {}),
    },
  });

  await logAudit({
    actorUserId: userId,
    action: "updated",
    entityType: "tag",
    entityId: resolvedParams.id,
    before: { name: tag.name, color: tag.color },
    after: { name: updated.name, color: updated.color },
  });

  return NextResponse.json({ data: updated });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const resolvedParams = await params;
  const authResult = await requireAuth(_request, { params: resolvedParams });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const guard = requirePermission("task:create");
  const guardResult = await guard(_request, { params: resolvedParams });
  if (guardResult) return guardResult;

  const tag = await prisma.tag.findUnique({ where: { id: resolvedParams.id } });
  if (!tag) {
    return NextResponse.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
  }

  // Remove tag from all tasks first
  await prisma.taskTag.deleteMany({ where: { tagId: resolvedParams.id } });

  await prisma.tag.delete({ where: { id: resolvedParams.id } });

  await logAudit({
    actorUserId: userId,
    action: "deleted",
    entityType: "tag",
    entityId: resolvedParams.id,
    before: { name: tag.name, color: tag.color },
  });

  return NextResponse.json({ data: { success: true } });
}
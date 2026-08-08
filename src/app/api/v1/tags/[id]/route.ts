import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac/middleware";
import { can, canProject, canReadProject } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit/log";
import { readJsonBody, tagUpdateSchema, validationError } from "@/lib/validation/api";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const resolvedParams = await params;
  const authResult = await requireAuth(request, { params: resolvedParams });
  if (authResult instanceof NextResponse) return authResult;

  const tag = await prisma.tag.findUnique({ where: { id: resolvedParams.id }, include: { _count: { select: { tasks: true } } } });
  if (!tag) return NextResponse.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
  if (tag.projectId && !(await canReadProject(authResult.userId, tag.projectId))) {
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

  const tag = await prisma.tag.findUnique({ where: { id: resolvedParams.id } });
  if (!tag) return NextResponse.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
  const permitted = tag.projectId
    ? await canProject(userId, "task:create", tag.projectId)
    : await can(userId, "task:create");
  if (!permitted) return NextResponse.json({ error: { code: "NOT_FOUND" } }, { status: 404 });

  const parsed = tagUpdateSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) return NextResponse.json(validationError(parsed.error), { status: 400 });
  const { name, color } = parsed.data;
  const updated = await prisma.tag.update({
    where: { id: resolvedParams.id },
    data: { ...(name !== undefined ? { name: name.trim() } : {}), ...(color !== undefined ? { color } : {}) },
  });

  await logAudit({ actorUserId: userId, action: "updated", entityType: "tag", entityId: resolvedParams.id, before: { name: tag.name, color: tag.color }, after: { name: updated.name, color: updated.color } });
  return NextResponse.json({ data: updated });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const resolvedParams = await params;
  const authResult = await requireAuth(request, { params: resolvedParams });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const tag = await prisma.tag.findUnique({ where: { id: resolvedParams.id } });
  if (!tag) return NextResponse.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
  const permitted = tag.projectId
    ? await canProject(userId, "task:create", tag.projectId)
    : await can(userId, "task:create");
  if (!permitted) return NextResponse.json({ error: { code: "NOT_FOUND" } }, { status: 404 });

  await prisma.taskTag.deleteMany({ where: { tagId: resolvedParams.id } });
  await prisma.tag.delete({ where: { id: resolvedParams.id } });
  await logAudit({ actorUserId: userId, action: "deleted", entityType: "tag", entityId: resolvedParams.id, before: { name: tag.name, color: tag.color } });
  return NextResponse.json({ data: { success: true } });
}

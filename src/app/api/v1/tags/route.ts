import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac/middleware";
import { can, canProject } from "@/lib/rbac";
import { getUserReadableProjectIds } from "@/lib/projects/queries";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit/log";
import { readJsonBody, tagCreateSchema, validationError } from "@/lib/validation/api";

export async function GET(request: Request) {
  const authResult = await requireAuth(request, { params: {} });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");
  const where: Record<string, unknown> = {};
  const readableProjectIds = await getUserReadableProjectIds(userId);
  if (projectId) {
    if (readableProjectIds !== null && !readableProjectIds.includes(projectId)) {
      return NextResponse.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
    }
    where.projectId = projectId;
  } else if (readableProjectIds !== null) {
    where.OR = [{ projectId: null }, { projectId: { in: readableProjectIds } }];
  }

  const tags = await prisma.tag.findMany({ where, orderBy: { name: "asc" }, include: { _count: { select: { tasks: true } } } });
  return NextResponse.json({ data: tags });
}

export async function POST(request: Request) {
  const authResult = await requireAuth(request, { params: {} });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const parsed = tagCreateSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) return NextResponse.json(validationError(parsed.error), { status: 400 });
  const { name, color, projectId } = parsed.data;

  const permitted = projectId
    ? await canProject(userId, "task:create", projectId)
    : await can(userId, "task:create");
  if (!permitted) return NextResponse.json({ error: { code: "FORBIDDEN" } }, { status: 403 });

  const existing = await prisma.tag.findFirst({ where: { name: name.trim(), projectId: projectId ?? null } });
  if (existing) return NextResponse.json({ data: existing });

  const tag = await prisma.tag.create({ data: { name: name.trim(), color: color ?? "#94a3b8", projectId: projectId ?? null } });
  await logAudit({ actorUserId: userId, action: "created", entityType: "tag", entityId: tag.id, after: { name: tag.name, color: tag.color, projectId: tag.projectId } });
  return NextResponse.json({ data: tag }, { status: 201 });
}

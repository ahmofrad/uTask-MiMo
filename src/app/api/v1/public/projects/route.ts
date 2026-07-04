import { NextResponse } from "next/server";
import { authenticatePublicApi } from "@/lib/public-api/middleware";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit/log";

export async function GET(request: Request) {
  const { error } = await authenticatePublicApi(request, "projects:read");
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor");
  const limit = Math.min(Number(searchParams.get("limit")) || 50, 200);

  const projects = await prisma.project.findMany({
    where: { archivedAt: null },
    take: limit + 1,
    skip: cursor ? 1 : 0,
    ...(cursor ? { cursor: { id: cursor } } : {}),
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, description: true, color: true, visibility: true, createdAt: true },
  });

  const hasMore = projects.length > limit;
  if (hasMore) projects.pop();
  const lastItem = projects[projects.length - 1];

  return NextResponse.json({
    data: projects,
    meta: { nextCursor: hasMore && lastItem ? lastItem.id : null, hasMore },
  });
}

export async function POST(request: Request) {
  const { userId, error } = await authenticatePublicApi(request, "projects:write");
  if (error) return error;

  const body = await request.json();
  const { name, description, visibility } = body as Record<string, string>;

  if (!name) {
    return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "name is required" } }, { status: 400 });
  }

  const project = await prisma.project.create({
    data: { name, description: description ?? null, ownerId: userId, visibility: (visibility ?? "private") as never },
  });

  await prisma.projectMember.create({
    data: { projectId: project.id, userId, projectRole: "lead", addedBy: userId },
  });

  await logAudit({
    actorUserId: userId,
    action: "project_created",
    entityType: "project",
    entityId: project.id,
    after: project as never,
  });

  return NextResponse.json({ data: project }, { status: 201 });
}

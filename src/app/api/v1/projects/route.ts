import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { can } from "@/lib/rbac";
import { logAudit } from "@/lib/audit/log";
import { emitTaskEvent } from "@/lib/webhook/emit";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor");
  const limit = Math.min(Number(searchParams.get("limit")) || 50, 200);
  const departmentId = searchParams.get("departmentId");
  const status = searchParams.get("status");

  const where: Record<string, unknown> = {};
  if (departmentId) where.departmentId = departmentId;
  if (status) where.status = status;
  where.archivedAt = null;

  const projects = await prisma.project.findMany({
    where,
    take: limit + 1,
    skip: cursor ? 1 : 0,
    ...(cursor ? { cursor: { id: cursor } } : {}),
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { tasks: true, members: true } },
    },
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
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Authentication required" } }, { status: 401 });
  }

  const permitted = await can(session.user.id, "project:create");
  if (!permitted) {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "Insufficient permissions" } }, { status: 403 });
  }

  const body = await request.json();
  const { name, description, color, departmentId, visibility } = body as Record<string, string>;

  if (!name) {
    return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Name is required" } }, { status: 400 });
  }

  const project = await prisma.project.create({
    data: {
      name,
      description: description ?? null,
      color: color ?? "#2563eb",
      ownerId: session.user.id,
      departmentId: departmentId ?? null,
      visibility: (visibility as never) ?? "private",
    },
  });

  await prisma.projectMember.create({
    data: {
      projectId: project.id,
      userId: session.user.id,
      projectRole: "lead",
      addedBy: session.user.id,
    },
  });

  await logAudit({ actorUserId: session.user.id, action: "project_created", entityType: "project", entityId: project.id, after: project as never });

  await emitTaskEvent("project.created", project.id, { id: project.id, name: project.name }, session.user.id);

  return NextResponse.json({ data: project }, { status: 201 });
}

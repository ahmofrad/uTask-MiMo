import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit/log";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");

  const where: Record<string, unknown> = {};
  if (projectId) where.projectId = projectId;

  const tags = await prisma.tag.findMany({
    where,
    orderBy: { name: "asc" },
    include: { _count: { select: { tasks: true } } },
  });

  return NextResponse.json({ data: tags });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }

  const permitted = await can(session.user.id, "task:create");
  if (!permitted) {
    return NextResponse.json({ error: { code: "FORBIDDEN" } }, { status: 403 });
  }

  const body = await request.json();
  const { name, color, projectId } = body as { name?: string; color?: string; projectId?: string };

  if (!name || !name.trim()) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "name is required" } },
      { status: 400 },
    );
  }

  // Check for duplicate
  const existing = await prisma.tag.findFirst({
    where: { name: name.trim(), projectId: projectId ?? null },
  });
  if (existing) {
    return NextResponse.json({ data: existing });
  }

  const tag = await prisma.tag.create({
    data: {
      name: name.trim(),
      color: color ?? "#94a3b8",
      projectId: projectId ?? null,
    },
  });

  await logAudit({
    actorUserId: session.user.id,
    action: "created",
    entityType: "tag",
    entityId: tag.id,
    after: { name: tag.name, color: tag.color, projectId: tag.projectId },
  });

  return NextResponse.json({ data: tag }, { status: 201 });
}

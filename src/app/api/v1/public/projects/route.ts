import { NextResponse } from "next/server";
import { authenticatePublicApi } from "@/lib/public-api/middleware";
import { can } from "@/lib/rbac";
import { getUserReadableProjectIds, listProjects } from "@/lib/projects/queries";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit/log";

export async function GET(request: Request) {
  const { userId, error } = await authenticatePublicApi(request, "projects:read");
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor");
  const limit = Math.min(Number(searchParams.get("limit")) || 50, 200);

  const readable = await getUserReadableProjectIds(userId);
  const projects = await listProjects({
    limit,
    ...(cursor ? { cursor } : {}),
    ...(readable ? { projectIds: readable } : {}),
  });

  return NextResponse.json(projects);
}

export async function POST(request: Request) {
  const { userId, error } = await authenticatePublicApi(request, "projects:write");
  if (error) return error;

  if (!(await can(userId, "project:create"))) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "You are not allowed to create projects" } },
      { status: 403 },
    );
  }

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

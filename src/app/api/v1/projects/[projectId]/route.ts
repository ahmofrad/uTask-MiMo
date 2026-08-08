import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac/middleware";
import { canProject, canReadProject, isProjectOwner } from "@/lib/rbac";
import { logAudit } from "@/lib/audit/log";
import { emitTaskEvent } from "@/lib/webhook/emit";
import { getProjectById, updateProject, archiveProject } from "@/lib/projects";
import { projectUpdateSchema, readJsonBody, validationError } from "@/lib/validation/api";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const resolvedParams = await params;
  const authResult = await requireAuth(_request, { params: resolvedParams });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  if (!(await canReadProject(userId, resolvedParams.projectId))) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Project not found" } }, { status: 404 });
  }

  const project = await getProjectById(resolvedParams.projectId);

  if (!project) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Project not found" } }, { status: 404 });
  }

  return NextResponse.json({ data: project });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const resolvedParams = await params;
  const authResult = await requireAuth(request, { params: resolvedParams });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const permitted =
    (await canProject(userId, "project:update", resolvedParams.projectId)) ||
    (await isProjectOwner(userId, resolvedParams.projectId));
  if (!permitted) {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "Insufficient permissions" } }, { status: 403 });
  }

  const parsed = projectUpdateSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) {
    return NextResponse.json(validationError(parsed.error), { status: 400 });
  }
  const { name, description, color, status, visibility } = parsed.data;

  const before = await getProjectById(resolvedParams.projectId);

  const project = await updateProject(resolvedParams.projectId, {
    ...(name !== undefined ? { name } : {}),
    ...(description !== undefined ? { description } : {}),
    ...(color !== undefined ? { color } : {}),
    ...(status !== undefined ? { status } : {}),
    ...(visibility !== undefined ? { visibility } : {}),
  });

  await logAudit({ actorUserId: userId, action: "project_updated", entityType: "project", entityId: resolvedParams.projectId, before: before as never, after: project as never });

  await emitTaskEvent("project.updated", resolvedParams.projectId, { id: resolvedParams.projectId, name: project.name }, userId);

  return NextResponse.json({ data: project });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const resolvedParams = await params;
  const authResult = await requireAuth(_request, { params: resolvedParams });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const permitted =
    (await canProject(userId, "project:delete", resolvedParams.projectId)) ||
    (await isProjectOwner(userId, resolvedParams.projectId));
  if (!permitted) {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "Insufficient permissions" } }, { status: 403 });
  }

  const before = await getProjectById(resolvedParams.projectId);

  await archiveProject(resolvedParams.projectId);

  await logAudit({ actorUserId: userId, action: "project_archived", entityType: "project", entityId: resolvedParams.projectId, before: before as never });

  return NextResponse.json({ data: { success: true } });
}
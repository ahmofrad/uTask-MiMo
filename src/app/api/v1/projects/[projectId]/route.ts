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
  const { userId, organizationId } = authResult;

  if (!(await canReadProject(userId, resolvedParams.projectId, organizationId))) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Project not found" } }, { status: 404 });
  }

  const project = await getProjectById(resolvedParams.projectId, organizationId);

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
  const { userId, organizationId } = authResult;

  const permitted =
    (await canProject(userId, "project:update", resolvedParams.projectId, organizationId)) ||
    (await isProjectOwner(userId, resolvedParams.projectId, organizationId));
  if (!permitted) {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "Insufficient permissions" } }, { status: 403 });
  }

  const parsed = projectUpdateSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) {
    return NextResponse.json(validationError(parsed.error), { status: 400 });
  }
  const { name, description, color, status, visibility } = parsed.data;

  const before = await getProjectById(resolvedParams.projectId, organizationId);

  const project = await updateProject(resolvedParams.projectId, {
    ...(name !== undefined ? { name } : {}),
    ...(description !== undefined ? { description } : {}),
    ...(color !== undefined ? { color } : {}),
    ...(status !== undefined ? { status } : {}),
    ...(visibility !== undefined ? { visibility } : {}),
  });

  await logAudit({ organizationId, actorUserId: userId, action: "project_updated", entityType: "project", entityId: resolvedParams.projectId, before: before as never, after: project as never });

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
  const { userId, organizationId } = authResult;

  const permitted =
    (await canProject(userId, "project:delete", resolvedParams.projectId, organizationId)) ||
    (await isProjectOwner(userId, resolvedParams.projectId, organizationId));
  if (!permitted) {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "Insufficient permissions" } }, { status: 403 });
  }

  const before = await getProjectById(resolvedParams.projectId, organizationId);

  await archiveProject(resolvedParams.projectId);

  await logAudit({ organizationId, actorUserId: userId, action: "project_archived", entityType: "project", entityId: resolvedParams.projectId, before: before as never });

  return NextResponse.json({ data: { success: true } });
}
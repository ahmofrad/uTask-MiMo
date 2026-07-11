import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { can, canProject, isProjectOwner } from "@/lib/rbac";
import { logAudit } from "@/lib/audit/log";
import { emitTaskEvent } from "@/lib/webhook/emit";
import { getProjectById, updateProject, archiveProject } from "@/lib/projects";

export async function GET(
  _request: Request,
  { params }: { params: { projectId: string } },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }

  const project = await getProjectById(params.projectId);

  if (!project) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Project not found" } }, { status: 404 });
  }

  return NextResponse.json({ data: project });
}

export async function PATCH(
  request: Request,
  { params }: { params: { projectId: string } },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }

  const permitted =
    (await can(session.user.id, "project:update")) ||
    (await canProject(session.user.id, "project_role:assign", params.projectId)) ||
    (await isProjectOwner(session.user.id, params.projectId));
  if (!permitted) {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "Insufficient permissions" } }, { status: 403 });
  }

  const body = await request.json();
  const { name, description, color, status, visibility } = body as Record<string, string>;

  const before = await getProjectById(params.projectId);

  const project = await updateProject(params.projectId, {
    ...(name !== undefined ? { name } : {}),
    ...(description !== undefined ? { description } : {}),
    ...(color !== undefined ? { color } : {}),
    ...(status !== undefined ? { status } : {}),
    ...(visibility !== undefined ? { visibility: visibility as never } : {}),
  });

  await logAudit({ actorUserId: session.user.id, action: "project_updated", entityType: "project", entityId: params.projectId, before: before as never, after: project as never });

  await emitTaskEvent("project.updated", params.projectId, { id: params.projectId, name: project.name }, session.user.id);

  return NextResponse.json({ data: project });
}

export async function DELETE(
  _request: Request,
  { params }: { params: { projectId: string } },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }

  const permitted = await can(session.user.id, "project:delete");
  if (!permitted) {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "Insufficient permissions" } }, { status: 403 });
  }

  const before = await getProjectById(params.projectId);

  await archiveProject(params.projectId);

  await logAudit({ actorUserId: session.user.id, action: "project_archived", entityType: "project", entityId: params.projectId, before: before as never });

  return NextResponse.json({ data: { success: true } });
}

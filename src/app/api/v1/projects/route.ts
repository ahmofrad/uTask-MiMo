import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac/middleware";
import { can, canCreateProject } from "@/lib/rbac";
import { logAudit } from "@/lib/audit/log";
import { emitTaskEvent } from "@/lib/webhook/emit";
import { createDepartmentLinkRequest } from "@/lib/projects/department-links";
import { projectCreateSchema, readJsonBody, validationError } from "@/lib/validation/api";
import { getUserReadableProjectIds, listProjects, createProject } from "@/lib/projects";

export async function GET(request: Request) {
  const authResult = await requireAuth(request, { params: {} });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor");
  const limit = Math.min(Number(searchParams.get("limit")) || 50, 200);
  const departmentId = searchParams.get("departmentId");
  const status = searchParams.get("status");
  const readableProjectIds = await getUserReadableProjectIds(userId);

  const result = await listProjects({
    limit,
    ...(cursor ? { cursor } : {}),
    ...(departmentId ? { departmentId } : {}),
    ...(status ? { status } : {}),
    ...(readableProjectIds !== null ? { projectIds: readableProjectIds } : {}),
  });

  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const authResult = await requireAuth(request, { params: {} });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const parsed = projectCreateSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) {
    return NextResponse.json(validationError(parsed.error), { status: 400 });
  }
  const { name, description, color, departmentId, departmentIds: requestedDepartmentIds, visibility } = parsed.data;
  const departmentIds = requestedDepartmentIds ?? (departmentId ? [departmentId] : []);
  const primaryDepartmentId = departmentIds[0] ?? departmentId ?? null;

  if (!(await canCreateProject(userId, primaryDepartmentId))) {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "You are not allowed to create a project in this department" } }, { status: 403 });
  }

  const canLinkAllDepartments = await can(userId, "org:settings");
  const departmentIdsToCreate = canLinkAllDepartments ? departmentIds : departmentIds.slice(0, 1);

  const project = await createProject({
    name,
    description: description ?? null,
    ownerId: userId,
    departmentId: primaryDepartmentId,
    ...(departmentIdsToCreate.length > 0 ? { departmentIds: departmentIdsToCreate } : {}),
    ...(color ? { color } : {}),
    ...(visibility ? { visibility: visibility as never } : {}),
  });

  await logAudit({ actorUserId: userId, action: "project_created", entityType: "project", entityId: project.id, after: project as never });

  if (!canLinkAllDepartments) {
    for (const departmentId of departmentIds.slice(1)) {
      const linkRequest = await createDepartmentLinkRequest({
        projectId: project.id,
        departmentId,
        requestedById: userId,
      });
      if (!("kind" in linkRequest)) {
        await logAudit({
          actorUserId: userId,
          action: "project_department_link_requested",
          entityType: "projectDepartmentLinkRequest",
          entityId: linkRequest.id,
          after: linkRequest as never,
        });
      }
    }
  }

  await emitTaskEvent("project.created", project.id, { id: project.id, name: project.name }, userId);

  return NextResponse.json({ data: project }, { status: 201 });
}
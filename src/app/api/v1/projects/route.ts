import { NextResponse } from "next/server";
import { requireAuth, requirePermission } from "@/lib/rbac/middleware";
import { logAudit } from "@/lib/audit/log";
import { emitTaskEvent } from "@/lib/webhook/emit";
import { listProjects, createProject } from "@/lib/projects";

export async function GET(request: Request) {
  const authResult = await requireAuth(request, { params: {} });
  if (authResult instanceof NextResponse) return authResult;

  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor");
  const limit = Math.min(Number(searchParams.get("limit")) || 50, 200);
  const departmentId = searchParams.get("departmentId");
  const status = searchParams.get("status");

  const result = await listProjects({
    limit,
    ...(cursor ? { cursor } : {}),
    ...(departmentId ? { departmentId } : {}),
    ...(status ? { status } : {}),
  });

  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const authResult = await requireAuth(request, { params: {} });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const guard = requirePermission("project:create");
  const guardResult = await guard(request, { params: {} });
  if (guardResult) return guardResult;

  const body = await request.json();
  const { name, description, color, departmentId, visibility } = body as Record<string, string>;

  if (!name) {
    return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Name is required" } }, { status: 400 });
  }

  const project = await createProject({
    name,
    description: description ?? null,
    ownerId: userId,
    departmentId: departmentId ?? null,
    ...(color ? { color } : {}),
    ...(visibility ? { visibility: visibility as never } : {}),
  });

  await logAudit({ actorUserId: userId, action: "project_created", entityType: "project", entityId: project.id, after: project as never });

  await emitTaskEvent("project.created", project.id, { id: project.id, name: project.name }, userId);

  return NextResponse.json({ data: project }, { status: 201 });
}
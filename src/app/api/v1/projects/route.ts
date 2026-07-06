import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { can } from "@/lib/rbac";
import { logAudit } from "@/lib/audit/log";
import { emitTaskEvent } from "@/lib/webhook/emit";
import { listProjects, createProject } from "@/lib/projects";

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

  const result = await listProjects({
    limit,
    ...(cursor ? { cursor } : {}),
    ...(departmentId ? { departmentId } : {}),
    ...(status ? { status } : {}),
  });

  return NextResponse.json(result);
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

  const project = await createProject({
    name,
    description: description ?? null,
    ownerId: session.user.id,
    departmentId: departmentId ?? null,
    ...(color ? { color } : {}),
    ...(visibility ? { visibility: visibility as never } : {}),
  });

  await logAudit({ actorUserId: session.user.id, action: "project_created", entityType: "project", entityId: project.id, after: project as never });

  await emitTaskEvent("project.created", project.id, { id: project.id, name: project.name }, session.user.id);

  return NextResponse.json({ data: project }, { status: 201 });
}

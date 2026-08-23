import { NextResponse } from "next/server";
import { authenticatePublicApi, withPublicApiRateLimit } from "@/lib/public-api/middleware";
import { canCreateProject } from "@/lib/rbac";
import { getUserReadableProjectIds, listProjects } from "@/lib/projects/queries";
import { createProject } from "@/lib/projects/mutations";
import { logAudit } from "@/lib/audit/log";
import { emitTaskEvent } from "@/lib/webhook/emit";
import { publicProjectCreateSchema, readJsonBody, validationError } from "@/lib/validation/api";

export async function GET(request: Request) {
  const { userId, organizationId, rateLimit, error } = await authenticatePublicApi(request, "projects:read");
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor");
  const limit = Math.min(Number(searchParams.get("limit")) || 50, 200);

  const readable = await getUserReadableProjectIds(userId, organizationId);
  const projects = await listProjects({
    organizationId,
    limit,
    ...(cursor ? { cursor } : {}),
    ...(readable ? { projectIds: readable } : {}),
  });

  return withPublicApiRateLimit(NextResponse.json(projects), rateLimit);
}

export async function POST(request: Request) {
  const { userId, organizationId, error } = await authenticatePublicApi(request, "projects:write");
  if (error) return error;

  if (!(await canCreateProject(userId, null, organizationId))) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "You are not allowed to create projects" } },
      { status: 403 },
    );
  }

  const parsed = publicProjectCreateSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) return NextResponse.json(validationError(parsed.error), { status: 400 });

  const project = await createProject({
    name: parsed.data.name,
    ownerId: userId,
    organizationId,
    ...(parsed.data.description !== undefined ? { description: parsed.data.description } : {}),
    ...(parsed.data.color !== undefined ? { color: parsed.data.color } : {}),
    ...(parsed.data.visibility !== undefined ? { visibility: parsed.data.visibility } : {}),
  });

  await logAudit({
    organizationId,
    actorUserId: userId,
    action: "project_created",
    entityType: "project",
    entityId: project.id,
    after: project as never,
  });

  await emitTaskEvent("project.created", project.id, { id: project.id, name: project.name }, userId);

  return NextResponse.json({ data: project }, { status: 201 });
}

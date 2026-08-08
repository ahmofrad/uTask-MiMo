import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/rbac/middleware";
import { canProject } from "@/lib/rbac";
import { listProjectLinkDepartments } from "@/lib/departments";

const projectIdSchema = z.string().uuid();

export async function GET(request: Request) {
  const authResult = await requireAuth(request, { params: {} });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const projectId = new URL(request.url).searchParams.get("projectId");
  const parsedProjectId = projectIdSchema.safeParse(projectId);
  if (!parsedProjectId.success) {
    return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "projectId is required" } }, { status: 400 });
  }

  if (!(await canProject(userId, "project:update", parsedProjectId.data))) {
    return NextResponse.json({ error: { code: "FORBIDDEN" } }, { status: 403 });
  }

  const departments = await listProjectLinkDepartments(parsedProjectId.data);
  return NextResponse.json({ data: departments });
}

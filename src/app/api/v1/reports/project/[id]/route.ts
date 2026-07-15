import { NextResponse } from "next/server";
import { requireAuth, requirePermission } from "@/lib/rbac/middleware";
import { canProject } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { getProjectReport } from "@/lib/reports";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const authResult = await requireAuth(_request, { params });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  // OR check: global org:reports OR project-level task:create
  const guard = requirePermission("org:reports");
  const guardResult = await guard(_request, { params });
  if (guardResult) {
    const projectPermitted = await canProject(userId, "task:create", params.id);
    if (!projectPermitted) {
      return NextResponse.json({ error: { code: "FORBIDDEN" } }, { status: 403 });
    }
  }

  const project = await prisma.project.findUnique({ where: { id: params.id } });
  if (!project) {
    return NextResponse.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
  }

  const report = await getProjectReport(params.id);

  return NextResponse.json({ data: report });
}
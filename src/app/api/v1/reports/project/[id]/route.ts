import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac/middleware";
import { canProject } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { getProjectReport } from "@/lib/reports";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const resolvedParams = await params;
  const authResult = await requireAuth(request, { params: resolvedParams });
  if (authResult instanceof NextResponse) return authResult;
  const { userId, organizationId } = authResult;

  const project = await prisma.project.findFirst({ where: { id: resolvedParams.id, organizationId } });
  if (!project) return NextResponse.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
  if (!(await canProject(userId, "org:reports", resolvedParams.id, organizationId))) {
    return NextResponse.json({ error: { code: "FORBIDDEN" } }, { status: 403 });
  }

  const report = await getProjectReport(resolvedParams.id, organizationId);
  return NextResponse.json({ data: report });
}

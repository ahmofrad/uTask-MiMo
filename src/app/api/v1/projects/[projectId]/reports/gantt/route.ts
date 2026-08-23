import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac/middleware";
import { canProject } from "@/lib/rbac";
import { buildGanttReport } from "@/lib/gantt/report";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const resolvedParams = await params;
  const authResult = await requireAuth(request, { params: resolvedParams });
  if (authResult instanceof NextResponse) return authResult;
  const { userId, organizationId } = authResult;

  const permitted =
    (await canProject(userId, "task:edit_any", resolvedParams.projectId, organizationId)) ||
    (await canProject(userId, "task:edit_own", resolvedParams.projectId, organizationId)) ||
    (await canProject(userId, "comment:create", resolvedParams.projectId, organizationId));
  if (!permitted) {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "Insufficient permissions" } }, { status: 403 });
  }

  const url = new URL(request.url);
  const include = new Set((url.searchParams.get("include") ?? "").split(",").map((s) => s.trim()).filter(Boolean));
  const withCritical = include.has("criticalPath");

  const [report, canEdit] = await Promise.all([
    buildGanttReport(resolvedParams.projectId, withCritical),
    canProject(userId, "task:edit_any", resolvedParams.projectId, organizationId),
  ]);
  return NextResponse.json({ data: { ...report, canEdit } });
}
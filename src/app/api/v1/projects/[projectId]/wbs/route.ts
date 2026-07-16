import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac/middleware";
import { can, canProject } from "@/lib/rbac";
import { getWbsForProject } from "@/lib/tasks/wbs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const resolvedParams = await params;
  const authResult = await requireAuth(_request, { params: resolvedParams });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const hasAccess =
    (await can(userId, "task:edit_any")) ||
    (await canProject(userId, "task:edit_any", resolvedParams.projectId)) ||
    (await canProject(userId, "task:edit_own", resolvedParams.projectId)) ||
    (await canProject(userId, "comment:create", resolvedParams.projectId));

  if (!hasAccess) {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "Insufficient permissions" } }, { status: 403 });
  }

  const tree = await getWbsForProject(resolvedParams.projectId);
  return NextResponse.json({ data: tree });
}
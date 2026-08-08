import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac/middleware";
import { canReadProject } from "@/lib/rbac";
import { getWbsForProject } from "@/lib/tasks/wbs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const resolvedParams = await params;
  const authResult = await requireAuth(_request, { params: resolvedParams });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const hasAccess = await canReadProject(userId, resolvedParams.projectId);

  if (!hasAccess) {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "Insufficient permissions" } }, { status: 403 });
  }

  const tree = await getWbsForProject(resolvedParams.projectId);
  return NextResponse.json({ data: tree });
}
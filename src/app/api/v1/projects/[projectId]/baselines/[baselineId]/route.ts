import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac/middleware";
import { canProject } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { activateBaseline } from "@/lib/baselines";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ projectId: string; baselineId: string }> },
) {
  const { projectId, baselineId } = await params;
  const authResult = await requireAuth(_request, { params: { projectId } });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  if (!(await canProject(userId, "task:edit_any", projectId))) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Insufficient permissions" } },
      { status: 403 },
    );
  }

  const baseline = await prisma.projectBaseline.findFirst({
    where: { id: baselineId, projectId },
  });

  if (!baseline) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Baseline not found" } },
      { status: 404 },
    );
  }

  await activateBaseline(baselineId, projectId);

  return NextResponse.json({ data: { success: true, id: baselineId } });
}

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac/middleware";
import { canProject } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { activateBaseline } from "@/lib/baselines";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string; baselineId: string }> },
) {
  const { id, baselineId } = await params;
  const authResult = await requireAuth(_request, { params: { id } });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  if (!(await canProject(userId, "task:edit_any", id))) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Insufficient permissions" } },
      { status: 403 },
    );
  }

  const baseline = await prisma.projectBaseline.findFirst({
    where: { id: baselineId, projectId: id },
  });

  if (!baseline) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Baseline not found" } },
      { status: 404 },
    );
  }

  await activateBaseline(baselineId, id);

  return NextResponse.json({ data: { success: true, id: baselineId } });
}

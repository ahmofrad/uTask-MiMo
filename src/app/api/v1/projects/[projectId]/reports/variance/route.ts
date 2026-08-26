import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac/middleware";
import { getVarianceReport } from "@/lib/baselines";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;
  const authResult = await requireAuth(_request, { params: { projectId } });
  if (authResult instanceof NextResponse) return authResult;

  const report = await getVarianceReport(projectId);
  return NextResponse.json({ data: report });
}

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac/middleware";
import { compareBaselines } from "@/lib/baselines";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;
  const authResult = await requireAuth(_request, { params: { projectId } });
  if (authResult instanceof NextResponse) return authResult;

  const result = await compareBaselines(projectId);
  return NextResponse.json({ data: result });
}

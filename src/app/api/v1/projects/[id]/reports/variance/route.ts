import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac/middleware";
import { getVarianceReport } from "@/lib/baselines";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const authResult = await requireAuth(_request, { params: { id } });
  if (authResult instanceof NextResponse) return authResult;

  const report = await getVarianceReport(id);
  return NextResponse.json({ data: report });
}

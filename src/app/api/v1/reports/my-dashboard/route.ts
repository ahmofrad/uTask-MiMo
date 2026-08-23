import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac/middleware";
import { getMyDashboard } from "@/lib/reports";

export async function GET(request: Request) {
  const authResult = await requireAuth(request, { params: {} });
  if (authResult instanceof NextResponse) return authResult;
  const { userId, organizationId } = authResult;

  const report = await getMyDashboard(userId, organizationId);

  return NextResponse.json({ data: report });
}
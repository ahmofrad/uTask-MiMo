import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac/middleware";
import { getMyDashboard } from "@/lib/reports";

export async function GET() {
  const authResult = await requireAuth(new Request("http://localhost"), { params: {} });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const report = await getMyDashboard(userId);

  return NextResponse.json({ data: report });
}
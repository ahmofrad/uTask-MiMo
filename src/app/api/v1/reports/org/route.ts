import { NextResponse } from "next/server";
import { requireAuth, requirePermission } from "@/lib/rbac/middleware";
import { getOrgReport } from "@/lib/reports";

export async function GET(request: Request) {
  const authResult = await requireAuth(request, { params: {} });
  if (authResult instanceof NextResponse) return authResult;

  const guard = requirePermission("org:reports");
  const guardResult = await guard(request, { params: {} });
  if (guardResult) return guardResult;

  const report = await getOrgReport(authResult.organizationId);

  return NextResponse.json({ data: report });
}
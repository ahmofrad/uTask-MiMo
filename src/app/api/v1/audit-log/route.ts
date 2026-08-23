import { NextResponse } from "next/server";
import { requireAuth, requirePermission } from "@/lib/rbac/middleware";
import { listAuditLogs } from "@/lib/audit-log";

export async function GET(request: Request) {
  const authResult = await requireAuth(request, { params: {} });
  if (authResult instanceof NextResponse) return authResult;

  const guard = requirePermission("audit:view");
  const guardResult = await guard(request, { params: {} });
  if (guardResult) return guardResult;

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get("limit")) || 50, 200);

  const result = await listAuditLogs({
    organizationId: authResult.organizationId,
    limit,
    ...(searchParams.get("cursor") ? { cursor: searchParams.get("cursor")! } : {}),
    ...(searchParams.get("entityType") ? { entityType: searchParams.get("entityType")! } : {}),
    ...(searchParams.get("action") ? { action: searchParams.get("action")! } : {}),
    ...(searchParams.get("groupAccess") === "true" ? { groupAccess: true } : {}),
  });

  return NextResponse.json(result);
}
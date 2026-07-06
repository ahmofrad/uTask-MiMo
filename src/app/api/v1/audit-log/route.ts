import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { can } from "@/lib/rbac/can";
import { listAuditLogs } from "@/lib/audit-log";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id || !(await can(session.user.id, "audit:view"))) {
    return NextResponse.json({ error: { code: "FORBIDDEN" } }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get("limit")) || 50, 200);

  const result = await listAuditLogs({
    limit,
    ...(searchParams.get("cursor") ? { cursor: searchParams.get("cursor")! } : {}),
    ...(searchParams.get("entityType") ? { entityType: searchParams.get("entityType")! } : {}),
    ...(searchParams.get("action") ? { action: searchParams.get("action")! } : {}),
  });

  return NextResponse.json(result);
}

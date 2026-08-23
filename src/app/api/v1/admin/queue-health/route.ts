import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac/middleware";
import { can } from "@/lib/rbac";
import { getQueueHealth } from "@/lib/queue";

export async function GET(request: Request) {
  const authResult = await requireAuth(request, { params: {} });
  if (authResult instanceof NextResponse) return authResult;
  if (!(await can(authResult.userId, "org:settings"))) {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "Insufficient permissions" } }, { status: 403 });
  }

  try {
    return NextResponse.json({ data: await getQueueHealth() });
  } catch {
    return NextResponse.json({ error: { code: "QUEUE_UNAVAILABLE", message: "Queue health is unavailable" } }, { status: 503 });
  }
}

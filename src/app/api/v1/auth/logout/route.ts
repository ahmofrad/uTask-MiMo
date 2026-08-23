import { signOut, revokeCurrentSession } from "@/lib/auth/config";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac/middleware";
import { logAudit } from "@/lib/audit/log";

export async function POST(request: Request) {
  const authResult = await requireAuth(request, { params: {} });
  if (authResult instanceof NextResponse) return authResult;

  await revokeCurrentSession();
  await logAudit({
    actorUserId: authResult.userId,
    action: "logout",
    entityType: "session",
    entityId: authResult.userId,
  });
  await signOut({ redirect: false });
  return NextResponse.json({ data: { success: true } });
}
import { signOut, revokeUserSessions } from "@/lib/auth/config";
import { logAudit } from "@/lib/audit/log";
import { requireAuth } from "@/lib/rbac/middleware";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const authResult = await requireAuth(request, { params: {} });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  await revokeUserSessions(userId);

  await logAudit({
    actorUserId: userId,
    action: "force_logout",
    entityType: "user",
    entityId: userId,
  });

  await signOut({ redirect: false });

  return NextResponse.json({ data: { success: true } });
}

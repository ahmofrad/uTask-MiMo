import { auth } from "@/lib/auth/config";
import { NextResponse } from "next/server";
import { getSession, revokeSession } from "@/lib/auth/session-store";
import { logAudit } from "@/lib/audit/log";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } }, { status: 401 });
  }

  const resolvedParams = await params;
  const sessionId = resolvedParams.id;

  const data = await getSession(sessionId);
  if (!data || data.userId !== session.user.id) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Session not found" } }, { status: 404 });
  }

  await revokeSession(sessionId);
  await logAudit({
    actorUserId: session.user.id,
    action: "session_revoked",
    entityType: "session",
    entityId: sessionId,
  });

  return NextResponse.json({ data: { success: true } });
}
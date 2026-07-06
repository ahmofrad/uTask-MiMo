import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { revokeApiToken } from "@/lib/api-token";
import { logAudit } from "@/lib/audit/log";

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }

  await revokeApiToken(params.id, session.user.id);

  await logAudit({
    actorUserId: session.user.id,
    action: "api_token_revoked",
    entityType: "api_token",
    entityId: params.id,
  });

  return NextResponse.json({ data: { success: true } });
}

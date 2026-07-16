import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac/middleware";
import { revokeApiToken } from "@/lib/api-token";
import { logAudit } from "@/lib/audit/log";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const resolvedParams = await params;
  const authResult = await requireAuth(_request, { params: resolvedParams });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  await revokeApiToken(resolvedParams.id, userId);

  await logAudit({
    actorUserId: userId,
    action: "api_token_revoked",
    entityType: "api_token",
    entityId: resolvedParams.id,
  });

  return NextResponse.json({ data: { success: true } });
}
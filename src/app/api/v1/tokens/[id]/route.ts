import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac/middleware";
import { revokeApiToken } from "@/lib/api-token";
import { logAudit } from "@/lib/audit/log";

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const authResult = await requireAuth(_request, { params });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  await revokeApiToken(params.id, userId);

  await logAudit({
    actorUserId: userId,
    action: "api_token_revoked",
    entityType: "api_token",
    entityId: params.id,
  });

  return NextResponse.json({ data: { success: true } });
}
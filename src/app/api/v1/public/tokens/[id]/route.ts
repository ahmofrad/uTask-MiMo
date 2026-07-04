import { NextResponse } from "next/server";
import { authenticatePublicApi } from "@/lib/public-api/middleware";
import { revokeApiToken } from "@/lib/api-token";
import { logAudit } from "@/lib/audit/log";

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } },
) {
  const { userId, error } = await authenticatePublicApi(request);
  if (error) return error;

  await revokeApiToken(params.id, userId);

  await logAudit({
    actorUserId: userId,
    action: "api_token_revoked",
    entityType: "api_token",
    entityId: params.id,
  });

  return NextResponse.json({ data: { success: true } });
}

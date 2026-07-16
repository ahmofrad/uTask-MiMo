import { NextResponse } from "next/server";
import { authenticatePublicApi } from "@/lib/public-api/middleware";
import { revokeApiToken } from "@/lib/api-token";
import { logAudit } from "@/lib/audit/log";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const resolvedParams = await params;
  const { userId, error } = await authenticatePublicApi(request);
  if (error) return error;

  await revokeApiToken(resolvedParams.id, userId);

  await logAudit({
    actorUserId: userId,
    action: "api_token_revoked",
    entityType: "api_token",
    entityId: resolvedParams.id,
  });

  return NextResponse.json({ data: { success: true } });
}

import { NextResponse } from "next/server";
import { authenticatePublicApi } from "@/lib/public-api/middleware";
import { revokeApiToken } from "@/lib/api-token";
import { logAudit } from "@/lib/audit/log";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const resolvedParams = await params;
  const { userId, organizationId, error } = await authenticatePublicApi(request);
  if (error) return error;

  try {
    await revokeApiToken(resolvedParams.id, userId, organizationId);
  } catch (error) {
    if ((error as { code?: string }).code === "NOT_FOUND") {
      return NextResponse.json({ error: { code: "NOT_FOUND", message: "Token not found" } }, { status: 404 });
    }
    throw error;
  }

  await logAudit({
    organizationId,
    actorUserId: userId,
    action: "api_token_revoked",
    entityType: "api_token",
    entityId: resolvedParams.id,
  });

  return NextResponse.json({ data: { success: true } });
}

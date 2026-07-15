import { NextResponse } from "next/server";
import { requireAuth, requirePermission } from "@/lib/rbac/middleware";
import { dispatchWebhook } from "@/lib/webhook";
import { logAudit } from "@/lib/audit/log";
import crypto from "crypto";

export async function POST(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const authResult = await requireAuth(_request, { params });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const guard = requirePermission("webhook:manage");
  const guardResult = await guard(_request, { params });
  if (guardResult) return guardResult;

  const eventId = crypto.randomUUID();

  await dispatchWebhook(params.id, "test", eventId, {
    type: "test",
    data: { message: "This is a test webhook event" },
  });

  await logAudit({
    actorUserId: userId,
    action: "webhook_tested",
    entityType: "webhook",
    entityId: params.id,
    after: { eventId },
  });

  return NextResponse.json({ data: { success: true } });
}
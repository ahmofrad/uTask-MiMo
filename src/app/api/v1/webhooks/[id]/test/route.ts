import { NextResponse } from "next/server";
import { requireAuth, requirePermission } from "@/lib/rbac/middleware";
import { dispatchWebhook, WebhookSecretUndecryptableError } from "@/lib/webhook";
import { logAudit } from "@/lib/audit/log";
import crypto from "crypto";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const resolvedParams = await params;
  const authResult = await requireAuth(_request, { params: resolvedParams });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const guard = requirePermission("webhook:manage");
  const guardResult = await guard(_request, { params: resolvedParams });
  if (guardResult) return guardResult;

  const eventId = crypto.randomUUID();

  try {
    await dispatchWebhook(resolvedParams.id, "test", eventId, {
      type: "test",
      data: { message: "This is a test webhook event" },
    });
  } catch (error) {
    if (error instanceof WebhookSecretUndecryptableError) {
      return NextResponse.json({ error: { code: "SECRET_UNDECRYPTABLE", message: error.message } }, { status: 400 });
    }
    throw error;
  }

  await logAudit({
    actorUserId: userId,
    action: "webhook_tested",
    entityType: "webhook",
    entityId: resolvedParams.id,
    after: { eventId },
  });

  return NextResponse.json({ data: { success: true } });
}
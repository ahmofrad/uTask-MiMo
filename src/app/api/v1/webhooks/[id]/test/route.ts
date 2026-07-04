import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { can } from "@/lib/rbac/can";
import { dispatchWebhook } from "@/lib/webhook";
import { logAudit } from "@/lib/audit/log";
import crypto from "crypto";

export async function POST(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const session = await auth();
  if (!session?.user?.id || !(await can(session.user.id, "webhook:manage"))) {
    return NextResponse.json({ error: { code: "FORBIDDEN" } }, { status: 403 });
  }

  const eventId = crypto.randomUUID();

  await dispatchWebhook(params.id, "test", eventId, {
    type: "test",
    data: { message: "This is a test webhook event" },
  });

  await logAudit({
    actorUserId: session.user.id,
    action: "webhook_tested",
    entityType: "webhook",
    entityId: params.id,
    after: { eventId },
  });

  return NextResponse.json({ data: { success: true } });
}

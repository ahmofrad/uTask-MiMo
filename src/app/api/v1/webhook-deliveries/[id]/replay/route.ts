import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { can } from "@/lib/rbac/can";
import { prisma } from "@/lib/db";
import { dispatchWebhook } from "@/lib/webhook";
import { logAudit } from "@/lib/audit/log";

export async function POST(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const session = await auth();
  if (!session?.user?.id || !(await can(session.user.id, "webhook:manage"))) {
    return NextResponse.json({ error: { code: "FORBIDDEN" } }, { status: 403 });
  }

  const delivery = await prisma.webhookDelivery.findUnique({ where: { id: params.id } });
  if (!delivery) {
    return NextResponse.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
  }

  await dispatchWebhook(
    delivery.webhookId,
    delivery.eventType,
    delivery.eventId,
    delivery.requestPayload as Record<string, unknown>,
  );

  await logAudit({
    actorUserId: session.user.id,
    action: "webhook_delivery_replayed",
    entityType: "webhook_delivery",
    entityId: params.id,
    after: { webhookId: delivery.webhookId, eventType: delivery.eventType },
  });

  return NextResponse.json({ data: { success: true } });
}

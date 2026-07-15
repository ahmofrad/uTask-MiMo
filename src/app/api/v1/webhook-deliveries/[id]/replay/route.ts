import { NextResponse } from "next/server";
import { requireAuth, requirePermission } from "@/lib/rbac/middleware";
import { prisma } from "@/lib/db";
import { dispatchWebhook } from "@/lib/webhook";
import { logAudit } from "@/lib/audit/log";

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
    actorUserId: userId,
    action: "webhook_delivery_replayed",
    entityType: "webhook_delivery",
    entityId: params.id,
    after: { webhookId: delivery.webhookId, eventType: delivery.eventType },
  });

  return NextResponse.json({ data: { success: true } });
}
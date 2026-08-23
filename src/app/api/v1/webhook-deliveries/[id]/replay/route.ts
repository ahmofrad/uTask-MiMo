import { NextResponse } from "next/server";
import { requireAuth, requirePermission } from "@/lib/rbac/middleware";
import { prisma } from "@/lib/db";
import { dispatchWebhook } from "@/lib/webhook";
import { logAudit } from "@/lib/audit/log";
import { z } from "zod";

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

  const delivery = await prisma.webhookDelivery.findUnique({
    where: { id: resolvedParams.id },
    include: { webhook: { select: { active: true, deletedAt: true } } },
  });
  if (!delivery) {
    return NextResponse.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
  }
  if (!delivery.webhook.active || delivery.webhook.deletedAt) {
    return NextResponse.json({ error: { code: "WEBHOOK_INACTIVE", message: "The webhook is inactive or deleted" } }, { status: 409 });
  }
  const payload = z.record(z.string(), z.unknown()).safeParse(delivery.requestPayload);
  if (!payload.success) {
    return NextResponse.json({ error: { code: "INVALID_DELIVERY_PAYLOAD", message: "The stored delivery payload is invalid" } }, { status: 422 });
  }

  await dispatchWebhook(
    delivery.webhookId,
    delivery.eventType,
    delivery.eventId,
    payload.data,
  );

  await logAudit({
    actorUserId: userId,
    action: "webhook_delivery_replayed",
    entityType: "webhook_delivery",
    entityId: resolvedParams.id,
    after: { webhookId: delivery.webhookId, eventType: delivery.eventType },
  });

  return NextResponse.json({ data: { success: true } });
}
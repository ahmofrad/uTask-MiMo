import { NextResponse } from "next/server";
import { requireAuth, requirePermission } from "@/lib/rbac/middleware";
import { prisma } from "@/lib/db";
import { pruneWebhookDeliveries } from "@/lib/webhook/retention";
import { logAudit } from "@/lib/audit/log";

function cutoffDate(): Date {
  const days = Number(process.env.WEBHOOK_DELIVERY_RETENTION_DAYS) || 30;
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

async function authorize(request: Request): Promise<NextResponse | null> {
  const guard = requirePermission("webhook:manage");
  return guard(request, { params: {} });
}

export async function GET(request: Request) {
  const authResult = await requireAuth(request, { params: {} });
  if (authResult instanceof NextResponse) return authResult;
  const denied = await authorize(request);
  if (denied) return denied;

  const cutoff = cutoffDate();
  const eligible = await prisma.webhookDelivery.count({
    where: {
      OR: [
        { deliveredAt: { lt: cutoff } },
        { deliveredAt: null, nextRetryAt: null, scheduledAt: { lt: cutoff } },
      ],
    },
  });
  return NextResponse.json({
    data: {
      eligible,
      retentionDays: Number(process.env.WEBHOOK_DELIVERY_RETENTION_DAYS) || 30,
      cutoff,
    },
  });
}

export async function POST(request: Request) {
  const authResult = await requireAuth(request, { params: {} });
  if (authResult instanceof NextResponse) return authResult;
  const denied = await authorize(request);
  if (denied) return denied;

  const deleted = await pruneWebhookDeliveries();
  await logAudit({
    actorUserId: authResult.userId,
    action: "deleted",
    entityType: "webhook_delivery_retention",
    entityId: "manual",
    after: { deleted },
  });
  return NextResponse.json({ data: { deleted } });
}

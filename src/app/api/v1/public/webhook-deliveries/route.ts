import { NextResponse } from "next/server";
import { authenticatePublicApi } from "@/lib/public-api/middleware";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/db";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  const { userId, error } = await authenticatePublicApi(request, "webhooks:manage");
  if (error) return error;
  if (!(await can(userId, "webhook:manage"))) return NextResponse.json({ error: { code: "FORBIDDEN" } }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const webhookId = searchParams.get("webhookId");
  const cursor = searchParams.get("cursor");
  const limit = Math.min(Number(searchParams.get("limit")) || 50, 200);

  if (cursor && !UUID_REGEX.test(cursor)) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid cursor" } },
      { status: 400 },
    );
  }

  const where: Record<string, unknown> = {};
  if (webhookId) where.webhookId = webhookId;

  const deliveries = await prisma.webhookDelivery.findMany({
    where,
    take: limit + 1,
    skip: cursor ? 1 : 0,
    ...(cursor ? { cursor: { id: cursor } } : {}),
    orderBy: { scheduledAt: "desc" },
  });

  const hasMore = deliveries.length > limit;
  if (hasMore) deliveries.pop();
  const lastItem = deliveries[deliveries.length - 1];

  return NextResponse.json({
    data: deliveries,
    meta: { nextCursor: hasMore && lastItem ? lastItem.id : null, hasMore },
  });
}

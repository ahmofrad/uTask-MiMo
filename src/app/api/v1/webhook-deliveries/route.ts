import { NextResponse } from "next/server";
import { requireAuth, requirePermission } from "@/lib/rbac/middleware";
import { prisma } from "@/lib/db";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  const authResult = await requireAuth(request, { params: {} });
  if (authResult instanceof NextResponse) return authResult;

  const guard = requirePermission("webhook:manage");
  const guardResult = await guard(request, { params: {} });
  if (guardResult) return guardResult;

  const { searchParams } = new URL(request.url);
  const webhookId = searchParams.get("webhookId");
  const cursor = searchParams.get("cursor");
  const limit = Math.min(Number(searchParams.get("limit")) || 50, 200);

  if (cursor && !UUID_REGEX.test(cursor)) {
    return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Invalid cursor" } }, { status: 400 });
  }

  const where: Record<string, unknown> = { webhook: { deletedAt: null } };
  if (webhookId) where.webhookId = webhookId;

  const deliveries = await prisma.webhookDelivery.findMany({
    where,
    take: limit + 1,
    skip: cursor ? 1 : 0,
    ...(cursor ? { cursor: { id: cursor } } : {}),
    orderBy: [{ scheduledAt: "desc" }, { id: "desc" }],
  });

  const hasMore = deliveries.length > limit;
  if (hasMore) deliveries.pop();
  const lastItem = deliveries[deliveries.length - 1];

  return NextResponse.json({
    data: deliveries,
    meta: { nextCursor: hasMore && lastItem ? lastItem.id : null, hasMore },
  });
}
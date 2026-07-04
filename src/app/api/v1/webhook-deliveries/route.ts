import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { can } from "@/lib/rbac/can";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id || !(await can(session.user.id, "webhook:manage"))) {
    return NextResponse.json({ error: { code: "FORBIDDEN" } }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const webhookId = searchParams.get("webhookId");
  const cursor = searchParams.get("cursor");
  const limit = Math.min(Number(searchParams.get("limit")) || 50, 200);

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

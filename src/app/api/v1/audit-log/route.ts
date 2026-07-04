import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { can } from "@/lib/rbac/can";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id || !(await can(session.user.id, "audit:view"))) {
    return NextResponse.json({ error: { code: "FORBIDDEN" } }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor");
  const limit = Math.min(Number(searchParams.get("limit")) || 50, 200);
  const entityType = searchParams.get("entityType");
  const action = searchParams.get("action");

  const where: Record<string, unknown> = {};
  if (entityType) where.entityType = entityType;
  if (action) where.action = action;

  const logs = await prisma.auditLog.findMany({
    where,
    take: limit + 1,
    skip: cursor ? 1 : 0,
    ...(cursor ? { cursor: { id: cursor } } : {}),
    orderBy: { occurredAt: "desc" },
    include: {
      actor: { select: { id: true, displayName: true, email: true } },
    },
  });

  const hasMore = logs.length > limit;
  if (hasMore) logs.pop();
  const lastItem = logs[logs.length - 1];

  return NextResponse.json({
    data: logs,
    meta: { nextCursor: hasMore && lastItem ? lastItem.id : null, hasMore },
  });
}

import { NextResponse } from "next/server";
import { authenticatePublicApi, withPublicApiRateLimit } from "@/lib/public-api/middleware";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  const { userId, rateLimit, error } = await authenticatePublicApi(request, "users:read");
  if (error) return error;
  if (!(await can(userId, "user:manage"))) return NextResponse.json({ error: { code: "FORBIDDEN" } }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor");
  const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 50, 1), 200);
  const users = await prisma.user.findMany({
    where: { status: "active" },
    take: limit + 1,
    skip: cursor ? 1 : 0,
    ...(cursor ? { cursor: { id: cursor } } : {}),
    orderBy: [{ displayName: "asc" }, { id: "asc" }],
    select: { id: true, email: true, displayName: true, avatarUrl: true, createdAt: true },
  });
  const hasMore = users.length > limit;
  if (hasMore) users.pop();
  const lastItem = users[users.length - 1];

  return withPublicApiRateLimit(NextResponse.json({
    data: users,
    meta: { nextCursor: hasMore && lastItem ? lastItem.id : null, hasMore },
  }), rateLimit);
}

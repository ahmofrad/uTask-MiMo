import { NextResponse } from "next/server";
import { authenticatePublicApi, withPublicApiRateLimit } from "@/lib/public-api/middleware";
import { canReadProject } from "@/lib/rbac";
import { prisma } from "@/lib/db";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const resolvedParams = await params;
  const { userId, rateLimit, error } = await authenticatePublicApi(request, "projects:read");
  if (error) return error;

  if (!(await canReadProject(userId, resolvedParams.id))) {
    return NextResponse.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor");
  const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 50, 1), 200);
  const fields = await prisma.customField.findMany({
    where: { projectId: resolvedParams.id, archivedAt: null },
    take: limit + 1,
    skip: cursor ? 1 : 0,
    ...(cursor ? { cursor: { id: cursor } } : {}),
    orderBy: [{ orderIndex: "asc" }, { id: "asc" }],
  });
  const hasMore = fields.length > limit;
  if (hasMore) fields.pop();
  const lastItem = fields[fields.length - 1];

  return withPublicApiRateLimit(NextResponse.json({
    data: fields,
    meta: { nextCursor: hasMore && lastItem ? lastItem.id : null, hasMore },
  }), rateLimit);
}

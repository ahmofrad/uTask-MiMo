import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac/middleware";
import { getTaskActivity } from "@/lib/activity";

export async function GET(
  request: Request,
  { params }: { params: { taskId: string } },
) {
  const authResult = await requireAuth(request, { params });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const { searchParams } = new URL(request.url);
  const cursorParam = searchParams.get("cursor");
  const limitParam = searchParams.get("limit");

  const result = await getTaskActivity(params.taskId, userId, {
    ...(cursorParam ? { cursor: cursorParam } : {}),
    ...(limitParam ? { limit: parseInt(limitParam, 10) } : {}),
  });

  return NextResponse.json({ items: result.items, nextCursor: result.nextCursor, hasMore: result.hasMore });
}
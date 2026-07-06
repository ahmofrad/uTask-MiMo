import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { getTaskActivity } from "@/lib/activity";

export async function GET(
  request: Request,
  { params }: { params: { taskId: string } },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const cursorParam = searchParams.get("cursor");
  const limitParam = searchParams.get("limit");

  const result = await getTaskActivity(params.taskId, session.user.id, {
    ...(cursorParam ? { cursor: cursorParam } : {}),
    ...(limitParam ? { limit: parseInt(limitParam, 10) } : {}),
  });

  return NextResponse.json({ data: result.items, nextCursor: result.nextCursor });
}

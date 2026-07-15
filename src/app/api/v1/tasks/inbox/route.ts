import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac/middleware";
import { getInboxTasks } from "@/lib/tasks";

export async function GET(request: Request) {
  const authResult = await requireAuth(request, { params: {} });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const result = await getInboxTasks(userId);

  return NextResponse.json({ data: result });
}
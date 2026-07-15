import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac/middleware";

export async function GET() {
  const authResult = await requireAuth(new Request("http://localhost"), { params: {} });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const { getUnreadCount } = await import("@/lib/notifications");
  const count = await getUnreadCount(userId);

  return NextResponse.json({ data: { count } });
}
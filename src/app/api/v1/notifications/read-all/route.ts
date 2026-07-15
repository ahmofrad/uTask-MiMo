import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac/middleware";

export async function POST() {
  const authResult = await requireAuth(new Request("http://localhost"), { params: {} });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const { markAllAsRead } = await import("@/lib/notifications");
  await markAllAsRead(userId);

  return NextResponse.json({ data: { success: true } });
}
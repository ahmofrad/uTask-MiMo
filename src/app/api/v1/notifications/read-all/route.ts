import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }

  const { markAllAsRead } = await import("@/lib/notifications");
  await markAllAsRead(session.user.id);

  return NextResponse.json({ data: { success: true } });
}

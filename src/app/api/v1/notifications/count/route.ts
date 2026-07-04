import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }

  const { getUnreadCount } = await import("@/lib/notifications");
  const count = await getUnreadCount(session.user.id);

  return NextResponse.json({ data: { count } });
}

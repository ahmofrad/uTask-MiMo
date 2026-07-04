import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";

export async function POST(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }

  const { markAsRead } = await import("@/lib/notifications");
  await markAsRead(params.id);

  return NextResponse.json({ data: { success: true } });
}

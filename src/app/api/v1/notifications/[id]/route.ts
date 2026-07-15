import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac/middleware";
import { prisma } from "@/lib/db";

export async function POST(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const authResult = await requireAuth(_request, { params });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  // Verify notification belongs to this user
  const notification = await prisma.notification.findUnique({
    where: { id: params.id },
    select: { userId: true },
  });

  if (!notification || notification.userId !== userId) {
    return NextResponse.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
  }

  const { markAsRead } = await import("@/lib/notifications");
  await markAsRead(params.id);

  return NextResponse.json({ data: { success: true } });
}
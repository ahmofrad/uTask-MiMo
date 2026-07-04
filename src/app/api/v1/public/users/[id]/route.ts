import { NextResponse } from "next/server";
import { authenticatePublicApi } from "@/lib/public-api/middleware";
import { prisma } from "@/lib/db";

export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  const { error } = await authenticatePublicApi(request, "users:read");
  if (error) return error;

  const user = await prisma.user.findUnique({
    where: { id: params.id },
    select: { id: true, email: true, displayName: true, avatarUrl: true, createdAt: true },
  });

  if (!user) {
    return NextResponse.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
  }

  return NextResponse.json({ data: user });
}

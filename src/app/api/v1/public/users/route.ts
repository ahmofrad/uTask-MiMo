import { NextResponse } from "next/server";
import { authenticatePublicApi } from "@/lib/public-api/middleware";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  const { error } = await authenticatePublicApi(request, "users:read");
  if (error) return error;

  const users = await prisma.user.findMany({
    where: { status: "active" },
    orderBy: { displayName: "asc" },
    select: { id: true, email: true, displayName: true, avatarUrl: true, createdAt: true },
  });

  return NextResponse.json({ data: users });
}

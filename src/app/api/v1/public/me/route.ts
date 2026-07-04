import { NextResponse } from "next/server";
import { authenticatePublicApi } from "@/lib/public-api/middleware";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  const { userId, error } = await authenticatePublicApi(request);
  if (error) return error;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      displayName: true,
      avatarUrl: true,
      locale: true,
      accentColor: true,
      theme: true,
      status: true,
      createdAt: true,
      roles: { where: { scopeType: "global" }, select: { type: true } },
    },
  });

  return NextResponse.json({ data: user });
}

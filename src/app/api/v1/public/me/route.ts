import { NextResponse } from "next/server";
import { authenticatePublicApi, withPublicApiRateLimit } from "@/lib/public-api/middleware";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  const { userId, rateLimit, error } = await authenticatePublicApi(request);
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

  return withPublicApiRateLimit(NextResponse.json({ data: user }), rateLimit);
}

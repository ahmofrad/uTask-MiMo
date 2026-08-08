import { NextResponse } from "next/server";
import { authenticatePublicApi } from "@/lib/public-api/middleware";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  const { userId, error } = await authenticatePublicApi(request, "users:read");
  if (error) return error;
  if (!(await can(userId, "user:manage"))) return NextResponse.json({ error: { code: "FORBIDDEN" } }, { status: 403 });

  const users = await prisma.user.findMany({
    where: { status: "active" },
    orderBy: { displayName: "asc" },
    select: { id: true, email: true, displayName: true, avatarUrl: true, createdAt: true },
  });

  return NextResponse.json({ data: users });
}

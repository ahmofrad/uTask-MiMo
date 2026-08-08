import { NextResponse } from "next/server";
import { authenticatePublicApi } from "@/lib/public-api/middleware";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/db";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const resolvedParams = await params;
  const { userId, error } = await authenticatePublicApi(request, "users:read");
  if (error) return error;
  if (!(await can(userId, "user:manage"))) return NextResponse.json({ error: { code: "FORBIDDEN" } }, { status: 403 });

  const user = await prisma.user.findUnique({
    where: { id: resolvedParams.id },
    select: { id: true, email: true, displayName: true, avatarUrl: true, createdAt: true },
  });

  if (!user) {
    return NextResponse.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
  }

  return NextResponse.json({ data: user });
}

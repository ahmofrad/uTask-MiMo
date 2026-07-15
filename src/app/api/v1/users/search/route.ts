import { NextResponse } from "next/server";
import { requireAuth, requirePermission } from "@/lib/rbac/middleware";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  const authResult = await requireAuth(request, { params: {} });
  if (authResult instanceof NextResponse) return authResult;

  const guard = requirePermission("task:create");
  const guardResult = await guard(request, { params: {} });
  if (guardResult) return guardResult;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  const projectId = searchParams.get("projectId");
  const limit = Math.min(Number(searchParams.get("limit")) || 10, 20);

  if (!q || q.length < 1) {
    return NextResponse.json({ data: [] });
  }

  // If projectId given, exclude existing members
  const existingMemberIds = projectId
    ? (await prisma.projectMember.findMany({
        where: { projectId },
        select: { userId: true },
      })).map((m) => m.userId)
    : [];

  const users = await prisma.user.findMany({
    where: {
      status: "active",
      id: { notIn: existingMemberIds },
      OR: [
        { displayName: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      displayName: true,
      email: true,
      avatarUrl: true,
    },
    take: limit,
    orderBy: { displayName: "asc" },
  });

  return NextResponse.json({ data: users });
}
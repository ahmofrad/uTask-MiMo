import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }

  if (!await can(session.user.id, "task:create")) {
    return NextResponse.json({ error: { code: "FORBIDDEN" } }, { status: 403 });
  }

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

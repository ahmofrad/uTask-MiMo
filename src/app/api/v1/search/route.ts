import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth/config";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");
  const type = searchParams.get("type") || "all";
  const limit = Math.min(Number(searchParams.get("limit")) || 20, 100);

  if (!q || q.length < 2) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Query must be at least 2 characters" } },
      { status: 400 },
    );
  }

  const query = q.trim();
  const results: Record<string, unknown[]> = {};

  if (type === "all" || type === "task") {
    results.tasks = await prisma.task.findMany({
      where: {
        deletedAt: null,
        OR: [
          { title: { contains: query, mode: "insensitive" } },
          { description: { contains: query, mode: "insensitive" } },
        ],
      },
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        projectId: true,
        createdAt: true,
      },
    });
  }

  if (type === "all" || type === "comment") {
    results.comments = await prisma.comment.findMany({
      where: {
        deletedAt: null,
        bodyMarkdown: { contains: query, mode: "insensitive" },
      },
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        bodyMarkdown: true,
        taskId: true,
        authorId: true,
        createdAt: true,
      },
    });
  }

  if (type === "all" || type === "project") {
    results.projects = await prisma.project.findMany({
      where: {
        archivedAt: null,
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { description: { contains: query, mode: "insensitive" } },
        ],
      },
      take: limit,
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, color: true, createdAt: true },
    });
  }

  if (type === "all" || type === "custom_field") {
    results.customFieldValues = await prisma.customFieldValue.findMany({
      where: {
        valueText: { contains: query, mode: "insensitive" },
      },
      take: limit,
      include: {
        task: { select: { id: true, title: true } },
        customField: { select: { id: true, name: true, key: true } },
      },
    });
  }

  return NextResponse.json({ data: results });
}

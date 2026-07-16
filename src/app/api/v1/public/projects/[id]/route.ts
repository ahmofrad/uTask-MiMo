import { NextResponse } from "next/server";
import { authenticatePublicApi } from "@/lib/public-api/middleware";
import { prisma } from "@/lib/db";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const resolvedParams = await params;
  const { error } = await authenticatePublicApi(request, "projects:read");
  if (error) return error;

  const project = await prisma.project.findUnique({
    where: { id: resolvedParams.id },
    select: {
      id: true, name: true, description: true, color: true, visibility: true,
      status: true, createdAt: true, updatedAt: true,
      owner: { select: { id: true, displayName: true } },
    },
  });

  if (!project) {
    return NextResponse.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
  }

  return NextResponse.json({ data: project });
}

import { NextResponse } from "next/server";
import { authenticatePublicApi, withPublicApiRateLimit } from "@/lib/public-api/middleware";
import { canReadProject } from "@/lib/rbac";
import { prisma } from "@/lib/db";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const resolvedParams = await params;
  const { userId, rateLimit, error } = await authenticatePublicApi(request, "projects:read");
  if (error) return error;

  if (!(await canReadProject(userId, resolvedParams.id))) {
    return NextResponse.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
  }

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

  return withPublicApiRateLimit(NextResponse.json({ data: project }), rateLimit);
}

import { NextResponse } from "next/server";
import { authenticatePublicApi } from "@/lib/public-api/middleware";
import { canReadProject } from "@/lib/rbac";
import { prisma } from "@/lib/db";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const resolvedParams = await params;
  const { userId, error } = await authenticatePublicApi(request, "projects:read");
  if (error) return error;

  if (!(await canReadProject(userId, resolvedParams.id))) {
    return NextResponse.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
  }

  const fields = await prisma.customField.findMany({
    where: { projectId: resolvedParams.id, archivedAt: null },
    orderBy: { orderIndex: "asc" },
  });

  return NextResponse.json({ data: fields });
}

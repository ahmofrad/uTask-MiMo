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

  const fields = await prisma.customField.findMany({
    where: { projectId: resolvedParams.id, archivedAt: null },
    orderBy: { orderIndex: "asc" },
  });

  return NextResponse.json({ data: fields });
}

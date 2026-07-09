import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { can, canProject } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { getProjectReport } from "@/lib/reports";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }

  const project = await prisma.project.findUnique({ where: { id: params.id } });
  if (!project) {
    return NextResponse.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
  }

  const permitted = await can(session.user.id, "org:reports") ||
    await canProject(session.user.id, "task:create", params.id);
  if (!permitted) {
    return NextResponse.json({ error: { code: "FORBIDDEN" } }, { status: 403 });
  }

  const report = await getProjectReport(params.id);

  return NextResponse.json({ data: report });
}

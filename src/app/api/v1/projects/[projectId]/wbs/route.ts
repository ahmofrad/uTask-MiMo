import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { can, canProject } from "@/lib/rbac";
import { getWbsForProject } from "@/lib/tasks/wbs";

export async function GET(
  _request: Request,
  { params }: { params: { projectId: string } },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }

  const userId = session.user.id;
  const projectId = params.projectId;

  const hasAccess =
    (await can(userId, "task:edit_any")) ||
    (await canProject(userId, "task:edit_any", projectId)) ||
    (await canProject(userId, "task:edit_own", projectId)) ||
    (await canProject(userId, "comment:create", projectId));

  if (!hasAccess) {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "Insufficient permissions" } }, { status: 403 });
  }

  const tree = await getWbsForProject(projectId);
  return NextResponse.json({ data: tree });
}

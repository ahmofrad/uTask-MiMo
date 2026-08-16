import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac/middleware";
import { canProject } from "@/lib/rbac";
import { buildGanttReport } from "@/lib/gantt/report";
import { ganttBatchQuerySchema, validationError } from "@/lib/validation/api";

export async function GET(request: Request) {
  const authResult = await requireAuth(request, { params: {} });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const url = new URL(request.url);
  const parsed = ganttBatchQuerySchema.safeParse({
    projectIds: url.searchParams.get("projectIds") ?? undefined,
    include: url.searchParams.get("include") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(validationError(parsed.error), { status: 400 });
  }

  const withCritical = new Set(
    (parsed.data.include ?? "").split(",").map((value) => value.trim()).filter(Boolean),
  ).has("criticalPath");

  const permissions = await Promise.all(
    parsed.data.projectIds.map(async (projectId) => ({
      projectId,
      permitted:
        (await canProject(userId, "task:edit_any", projectId)) ||
        (await canProject(userId, "task:edit_own", projectId)) ||
        (await canProject(userId, "comment:create", projectId)),
    })),
  );
  if (permissions.some(({ permitted }) => !permitted)) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Insufficient permissions" } },
      { status: 403 },
    );
  }

  const reports = await Promise.all(
    parsed.data.projectIds.map(async (projectId) => {
      const [report, canEdit] = await Promise.all([
        buildGanttReport(projectId, withCritical),
        canProject(userId, "task:edit_any", projectId),
      ]);
      return [projectId, { ...report, canEdit }] as const;
    }),
  );

  return NextResponse.json({ data: Object.fromEntries(reports) });
}

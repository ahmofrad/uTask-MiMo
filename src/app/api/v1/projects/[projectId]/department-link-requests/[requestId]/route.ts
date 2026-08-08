import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac/middleware";
import { logAudit } from "@/lib/audit/log";
import { reviewDepartmentLinkRequest } from "@/lib/projects/department-links";
import {
  projectDepartmentLinkDecisionSchema,
  readJsonBody,
  validationError,
} from "@/lib/validation/api";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ projectId: string; requestId: string }> },
) {
  const resolvedParams = await params;
  const authResult = await requireAuth(request, { params: resolvedParams });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const parsed = projectDepartmentLinkDecisionSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) {
    return NextResponse.json(validationError(parsed.error), { status: 400 });
  }

  const result = await reviewDepartmentLinkRequest(
    resolvedParams.requestId,
    userId,
    parsed.data.decision,
    resolvedParams.projectId,
  );

  if ("kind" in result) {
    if (result.kind === "not_found") {
      return NextResponse.json({ error: { code: "NOT_FOUND", message: "Request not found" } }, { status: 404 });
    }
    if (result.kind === "forbidden") {
      return NextResponse.json({ error: { code: "FORBIDDEN" } }, { status: 403 });
    }
    return NextResponse.json({ error: { code: "CONFLICT", message: "Request is no longer pending" } }, { status: 409 });
  }

  const actionByStatus = {
    approved: "project_department_link_approved",
    rejected: "project_department_link_rejected",
    cancelled: "project_department_link_cancelled",
  } as const;
  const action = actionByStatus[result.status as keyof typeof actionByStatus];
  if (action) {
    await logAudit({
      actorUserId: userId,
      action,
      entityType: "projectDepartmentLinkRequest",
      entityId: result.id,
      after: result as never,
    });
  }

  return NextResponse.json({ data: result });
}

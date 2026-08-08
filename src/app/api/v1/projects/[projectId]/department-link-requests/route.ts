import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac/middleware";
import { canProject, canReadProject } from "@/lib/rbac";
import {
  canApproveDepartmentLinkRequest,
  getDepartmentLinkRequestRecipientIds,
} from "@/lib/departments/requests";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit/log";
import {
  createDepartmentLinkRequest,
} from "@/lib/projects/department-links";
import {
  projectDepartmentLinkRequestSchema,
  readJsonBody,
  validationError,
} from "@/lib/validation/api";
import { notify } from "@/lib/notifications";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const resolvedParams = await params;
  const authResult = await requireAuth(request, { params: resolvedParams });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const requests = await prisma.projectDepartmentLinkRequest.findMany({
    where: { projectId: resolvedParams.projectId },
    include: {
      department: { select: { id: true, name: true } },
      requestedBy: { select: { id: true, displayName: true } },
      reviewedBy: { select: { id: true, displayName: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!(await canReadProject(userId, resolvedParams.projectId))) {
    let canReview = false;
    for (const linkRequest of requests) {
      if (linkRequest.status !== "pending") continue;
      if (await canApproveDepartmentLinkRequest(userId, linkRequest.departmentId, linkRequest.requestedById)) {
        canReview = true;
        break;
      }
    }
    if (!canReview) {
      return NextResponse.json({ error: { code: "FORBIDDEN" } }, { status: 403 });
    }
  }

  return NextResponse.json({ data: requests });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const resolvedParams = await params;
  const authResult = await requireAuth(request, { params: resolvedParams });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  if (!(await canProject(userId, "project:update", resolvedParams.projectId))) {
    return NextResponse.json({ error: { code: "FORBIDDEN" } }, { status: 403 });
  }

  const parsed = projectDepartmentLinkRequestSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) {
    return NextResponse.json(validationError(parsed.error), { status: 400 });
  }

  const result = await createDepartmentLinkRequest({
    projectId: resolvedParams.projectId,
    departmentId: parsed.data.departmentId,
    requestedById: userId,
  });

  if ("kind" in result) {
    if (result.kind === "not_found") {
      return NextResponse.json({ error: { code: "NOT_FOUND", message: "Project or department not found" } }, { status: 404 });
    }
    if (result.kind === "linked") {
      return NextResponse.json({ error: { code: "CONFLICT", message: "The department is already linked to this project" } }, { status: 409 });
    }
    return NextResponse.json({ error: { code: "CONFLICT", message: "A request for this department is already pending" } }, { status: 409 });
  }

  await logAudit({
    actorUserId: userId,
    action: "project_department_link_requested",
    entityType: "projectDepartmentLinkRequest",
    entityId: result.id,
    after: result as never,
  });

  const recipientIds = await getDepartmentLinkRequestRecipientIds(userId, result.departmentId);
  await Promise.all(recipientIds.filter((recipientId) => recipientId !== userId).map((recipientId) => notify({
    userId: recipientId,
    type: "department_link_request",
    payload: {
      projectId: result.projectId,
      departmentId: result.departmentId,
      requestId: result.id,
      projectName: result.project.name,
      departmentName: result.department.name,
    },
  })));

  return NextResponse.json({ data: result }, { status: 201 });
}

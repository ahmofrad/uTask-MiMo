import { NextResponse } from "next/server";
import { requireAuth, requirePermission } from "@/lib/rbac/middleware";
import { logAudit } from "@/lib/audit/log";
import { listDepartments, createDepartment } from "@/lib/departments";
import { departmentCreateSchema, readJsonBody, validationError } from "@/lib/validation/api";

export async function GET(request: Request) {
  const authResult = await requireAuth(request, { params: {} });
  if (authResult instanceof NextResponse) return authResult;

  const guard = requirePermission("org:settings");
  const guardResult = await guard(request, { params: {} });
  if (guardResult) return guardResult;

  const departments = await listDepartments(authResult.organizationId);

  return NextResponse.json({ data: departments });
}

export async function POST(request: Request) {
  const authResult = await requireAuth(request, { params: {} });
  if (authResult instanceof NextResponse) return authResult;
  const { userId, organizationId } = authResult;

  const guard = requirePermission("org:settings");
  const guardResult = await guard(request, { params: {} });
  if (guardResult) return guardResult;

  const parsed = departmentCreateSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) {
    return NextResponse.json(validationError(parsed.error), { status: 400 });
  }
  const { name, parentId, managerUserId } = parsed.data;

  const requestedOrganizationId = request.headers.get("x-organization-id")?.trim();
  const department = await createDepartment({
    ...(requestedOrganizationId ? { organizationId } : {}),
    name,
    ...(parentId !== undefined ? { parentId } : {}),
    ...(managerUserId !== undefined ? { managerUserId } : {}),
  });

  await logAudit({ organizationId, actorUserId: userId, action: "department_created", entityType: "department", entityId: department.id, after: department as never });

  return NextResponse.json({ data: department }, { status: 201 });
}
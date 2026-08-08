import { NextResponse } from "next/server";
import { requireAuth, requirePermission } from "@/lib/rbac/middleware";
import { logAudit } from "@/lib/audit/log";
import { getDepartmentById, updateDepartment, deleteDepartment } from "@/lib/departments";
import { departmentUpdateSchema, readJsonBody, validationError } from "@/lib/validation/api";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const resolvedParams = await params;
  const authResult = await requireAuth(_request, { params: resolvedParams });
  if (authResult instanceof NextResponse) return authResult;

  const guard = requirePermission("org:settings");
  const guardResult = await guard(_request, { params: resolvedParams });
  if (guardResult) return guardResult;

  const department = await getDepartmentById(resolvedParams.id);

  if (!department) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Department not found" } },
      { status: 404 },
    );
  }

  return NextResponse.json({ data: department });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const resolvedParams = await params;
  const authResult = await requireAuth(request, { params: resolvedParams });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const guard = requirePermission("org:settings");
  const guardResult = await guard(request, { params: resolvedParams });
  if (guardResult) return guardResult;

  const parsed = departmentUpdateSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) {
    return NextResponse.json(validationError(parsed.error), { status: 400 });
  }
  const { name, parentId, managerUserId } = parsed.data;

  const before = await getDepartmentById(resolvedParams.id);

  let department;
  try {
    department = await updateDepartment(resolvedParams.id, {
      ...(name !== undefined ? { name } : {}),
      ...(parentId !== undefined ? { parentId } : {}),
      ...(managerUserId !== undefined ? { managerUserId } : {}),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Department manager must be an active LDAP-synchronized member") {
      return NextResponse.json({ error: { code: "INVALID_MANAGER", message: error.message } }, { status: 400 });
    }
    throw error;
  }

  await logAudit({ actorUserId: userId, action: "department_updated", entityType: "department", entityId: resolvedParams.id, before: before as never, after: department as never });

  return NextResponse.json({ data: department });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const resolvedParams = await params;
  const authResult = await requireAuth(_request, { params: resolvedParams });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const guard = requirePermission("org:settings");
  const guardResult = await guard(_request, { params: resolvedParams });
  if (guardResult) return guardResult;

  const before = await getDepartmentById(resolvedParams.id);

  await deleteDepartment(resolvedParams.id);

  await logAudit({ actorUserId: userId, action: "department_deleted", entityType: "department", entityId: resolvedParams.id, before: before as never });

  return NextResponse.json({ data: { success: true } });
}
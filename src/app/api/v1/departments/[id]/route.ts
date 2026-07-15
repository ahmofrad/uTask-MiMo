import { NextResponse } from "next/server";
import { requireAuth, requirePermission } from "@/lib/rbac/middleware";
import { logAudit } from "@/lib/audit/log";
import { getDepartmentById, updateDepartment, deleteDepartment } from "@/lib/departments";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const authResult = await requireAuth(_request, { params });
  if (authResult instanceof NextResponse) return authResult;

  const guard = requirePermission("org:settings");
  const guardResult = await guard(_request, { params });
  if (guardResult) return guardResult;

  const department = await getDepartmentById(params.id);

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
  { params }: { params: { id: string } },
) {
  const authResult = await requireAuth(request, { params });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const guard = requirePermission("org:settings");
  const guardResult = await guard(request, { params });
  if (guardResult) return guardResult;

  const body = await request.json();
  const { name, parentId, managerUserId } = body as Record<string, unknown>;

  const before = await getDepartmentById(params.id);

  const department = await updateDepartment(params.id, {
    ...(name !== undefined ? { name: name as string } : {}),
    ...(parentId !== undefined ? { parentId: parentId as string | null } : {}),
    ...(managerUserId !== undefined ? { managerUserId: managerUserId as string | null } : {}),
  });

  await logAudit({ actorUserId: userId, action: "department_updated", entityType: "department", entityId: params.id, before: before as never, after: department as never });

  return NextResponse.json({ data: department });
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const authResult = await requireAuth(_request, { params });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const guard = requirePermission("org:settings");
  const guardResult = await guard(_request, { params });
  if (guardResult) return guardResult;

  const before = await getDepartmentById(params.id);

  await deleteDepartment(params.id);

  await logAudit({ actorUserId: userId, action: "department_deleted", entityType: "department", entityId: params.id, before: before as never });

  return NextResponse.json({ data: { success: true } });
}
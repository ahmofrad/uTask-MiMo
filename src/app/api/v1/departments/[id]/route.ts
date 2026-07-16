import { NextResponse } from "next/server";
import { requireAuth, requirePermission } from "@/lib/rbac/middleware";
import { logAudit } from "@/lib/audit/log";
import { getDepartmentById, updateDepartment, deleteDepartment } from "@/lib/departments";

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

  const body = await request.json();
  const { name, parentId, managerUserId } = body as Record<string, unknown>;

  const before = await getDepartmentById(resolvedParams.id);

  const department = await updateDepartment(resolvedParams.id, {
    ...(name !== undefined ? { name: name as string } : {}),
    ...(parentId !== undefined ? { parentId: parentId as string | null } : {}),
    ...(managerUserId !== undefined ? { managerUserId: managerUserId as string | null } : {}),
  });

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
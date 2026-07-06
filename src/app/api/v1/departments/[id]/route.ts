import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { can } from "@/lib/rbac";
import { logAudit } from "@/lib/audit/log";
import { getDepartmentById, updateDepartment, deleteDepartment } from "@/lib/departments";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }

  const permitted = await can(session.user.id, "org:settings");
  if (!permitted) {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "Insufficient permissions" } }, { status: 403 });
  }

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
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }

  const permitted = await can(session.user.id, "org:settings");
  if (!permitted) {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "Insufficient permissions" } }, { status: 403 });
  }

  const body = await request.json();
  const { name, parentId, managerUserId } = body as Record<string, unknown>;

  const before = await getDepartmentById(params.id);

  const department = await updateDepartment(params.id, {
    ...(name !== undefined ? { name: name as string } : {}),
    ...(parentId !== undefined ? { parentId: parentId as string | null } : {}),
    ...(managerUserId !== undefined ? { managerUserId: managerUserId as string | null } : {}),
  });

  await logAudit({ actorUserId: session.user.id, action: "department_updated", entityType: "department", entityId: params.id, before: before as never, after: department as never });

  return NextResponse.json({ data: department });
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }

  const permitted = await can(session.user.id, "org:settings");
  if (!permitted) {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "Insufficient permissions" } }, { status: 403 });
  }

  const before = await getDepartmentById(params.id);

  await deleteDepartment(params.id);

  await logAudit({ actorUserId: session.user.id, action: "department_deleted", entityType: "department", entityId: params.id, before: before as never });

  return NextResponse.json({ data: { success: true } });
}

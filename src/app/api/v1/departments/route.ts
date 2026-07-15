import { NextResponse } from "next/server";
import { requireAuth, requirePermission } from "@/lib/rbac/middleware";
import { logAudit } from "@/lib/audit/log";
import { listDepartments, createDepartment } from "@/lib/departments";

export async function GET() {
  const authResult = await requireAuth(new Request("http://localhost"), { params: {} });
  if (authResult instanceof NextResponse) return authResult;

  const guard = requirePermission("org:settings");
  const guardResult = await guard(new Request("http://localhost"), { params: {} });
  if (guardResult) return guardResult;

  const departments = await listDepartments();

  return NextResponse.json({ data: departments });
}

export async function POST(request: Request) {
  const authResult = await requireAuth(request, { params: {} });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const guard = requirePermission("org:settings");
  const guardResult = await guard(request, { params: {} });
  if (guardResult) return guardResult;

  const body = await request.json();
  const { name, parentId, managerUserId } = body as {
    name?: string;
    parentId?: string | null;
    managerUserId?: string | null;
  };

  if (!name) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Name is required" } },
      { status: 400 },
    );
  }

  const department = await createDepartment({
    name,
    ...(parentId !== undefined ? { parentId } : {}),
    ...(managerUserId !== undefined ? { managerUserId } : {}),
  });

  await logAudit({ actorUserId: userId, action: "department_created", entityType: "department", entityId: department.id, after: department as never });

  return NextResponse.json({ data: department }, { status: 201 });
}
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { can } from "@/lib/rbac";
import { logAudit } from "@/lib/audit/log";
import { listDepartments, createDepartment } from "@/lib/departments";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }

  const permitted = await can(session.user.id, "org:settings");
  if (!permitted) {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "Insufficient permissions" } }, { status: 403 });
  }

  const departments = await listDepartments();

  return NextResponse.json({ data: departments });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }

  const permitted = await can(session.user.id, "org:settings");
  if (!permitted) {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "Insufficient permissions" } }, { status: 403 });
  }

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

  await logAudit({ actorUserId: session.user.id, action: "department_created", entityType: "department", entityId: department.id, after: department as never });

  return NextResponse.json({ data: department }, { status: 201 });
}

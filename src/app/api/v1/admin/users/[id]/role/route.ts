import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit/log";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }

  const permitted = await can(session.user.id, "user:manage");
  if (!permitted) {
    return NextResponse.json({ error: { code: "FORBIDDEN" } }, { status: 403 });
  }

  const body = await request.json();
  const { role } = body as { role?: string };

  const validRoles = ["owner", "admin", "manager", "member", "guest"];
  if (!role || !validRoles.includes(role)) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: `role must be one of: ${validRoles.join(", ")}` } },
      { status: 400 },
    );
  }

  // Find current global role
  const currentRole = await prisma.role.findFirst({
    where: { userId: params.id, scopeType: "global" },
  });

  const oldRoleType = currentRole?.type ?? null;

  if (currentRole) {
    // Update existing role
    await prisma.role.update({
      where: { id: currentRole.id },
      data: { type: role as never },
    });
  } else {
    // Create new role
    await prisma.role.create({
      data: {
        userId: params.id,
        type: role as never,
        scopeType: "global",
        scopeId: null,
        grantedBy: session.user.id,
      },
    });
  }

  await logAudit({
    actorUserId: session.user.id,
    action: "updated",
    entityType: "user",
    entityId: params.id,
    before: { role: oldRoleType },
    after: { role },
  });

  return NextResponse.json({ data: { role } });
}

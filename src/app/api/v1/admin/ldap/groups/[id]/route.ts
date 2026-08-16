import { NextResponse } from "next/server";
import { requireAuth, requirePermission } from "@/lib/rbac/middleware";
import { deleteGroup } from "@/lib/groups";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const resolvedParams = await params;
  const authResult = await requireAuth(_request, { params: resolvedParams });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const guard = requirePermission("sso:configure");
  const guardResult = await guard(_request, { params: resolvedParams });
  if (guardResult) return guardResult;

  const result = await deleteGroup(resolvedParams.id, userId);
  if (!result) {
    return NextResponse.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
  }

  return NextResponse.json({ data: { success: true, usersAffected: result.usersAffected } });
}

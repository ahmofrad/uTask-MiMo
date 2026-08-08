import { NextResponse } from "next/server";
import { requireAuth, requirePermission } from "@/lib/rbac/middleware";
import { listDepartmentManagerCandidates } from "@/lib/departments";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const resolvedParams = await params;
  const authResult = await requireAuth(request, { params: resolvedParams });
  if (authResult instanceof NextResponse) return authResult;

  const guard = requirePermission("org:settings");
  const guardResult = await guard(request, { params: resolvedParams });
  if (guardResult) return guardResult;

  const candidates = await listDepartmentManagerCandidates(resolvedParams.id);
  return NextResponse.json({ data: candidates });
}

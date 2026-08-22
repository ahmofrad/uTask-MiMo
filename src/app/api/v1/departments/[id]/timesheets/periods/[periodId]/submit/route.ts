import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac/middleware";
import { handleTransition } from "@/lib/timesheets/transition-handler";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; periodId: string }> },
) {
  const resolvedParams = await params;
  const authResult = await requireAuth(request, { params: resolvedParams });
  if (authResult instanceof NextResponse) return authResult;

  return handleTransition(
    "submit",
    "owner",
    authResult.userId,
    resolvedParams.id,
    resolvedParams.periodId,
  );
}

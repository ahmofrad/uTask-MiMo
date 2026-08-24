import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac/middleware";
import { compareBaselines } from "@/lib/baselines";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const authResult = await requireAuth(_request, { params: { id } });
  if (authResult instanceof NextResponse) return authResult;

  const result = await compareBaselines(id);
  return NextResponse.json({ data: result });
}

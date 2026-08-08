import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac/middleware";
import { search as searchFn } from "@/lib/search";

export async function GET(request: Request) {
  const authResult = await requireAuth(request, { params: {} });
  if (authResult instanceof NextResponse) return authResult;


  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");
  const type = searchParams.get("type") || "all";
  const limit = Math.min(Number(searchParams.get("limit")) || 20, 100);

  if (!q || q.length < 2) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Query must be at least 2 characters" } },
      { status: 400 },
    );
  }

  const results = await searchFn({ userId: authResult.userId, query: q, type: type as "task" | "comment" | "project" | "custom_field" | "all", limit });

  return NextResponse.json({ data: results });
}
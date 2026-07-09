import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { can } from "@/lib/rbac";
import { search } from "@/lib/search";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }

  if (!await can(session.user.id, "task:create")) {
    return NextResponse.json({ error: { code: "FORBIDDEN" } }, { status: 403 });
  }

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

  const results = await search({ query: q, type: type as "task" | "comment" | "project" | "custom_field" | "all", limit });

  return NextResponse.json({ data: results });
}

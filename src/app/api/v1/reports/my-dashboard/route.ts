import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { getMyDashboard } from "@/lib/reports";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }

  const report = await getMyDashboard(session.user.id);

  return NextResponse.json({ data: report });
}

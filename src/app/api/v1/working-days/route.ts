import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac/middleware";
import { getWorkingDayConfig } from "@/lib/date/working-day";

/**
 * Read-only working-day calendar for any authenticated user. Calendar and
 * Gantt views tint holidays and configured non-working days, so the config
 * must be readable by everyone — only the write endpoint under
 * /api/v1/admin/settings/working-days stays admin-only.
 */
export async function GET() {
  const authResult = await requireAuth(new Request("http://localhost"), { params: {} });
  if (authResult instanceof NextResponse) return authResult;

  const config = await getWorkingDayConfig();
  return NextResponse.json({ data: config });
}

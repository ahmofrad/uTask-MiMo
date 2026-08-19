import { NextResponse } from "next/server";
import { requireAuth, requirePermission } from "@/lib/rbac/middleware";
import { setInstanceSetting } from "@/lib/settings/instance";
import { logAudit } from "@/lib/audit/log";
import {
  getWorkingDayConfig,
  workingDayConfigSchema,
  WORKING_DAYS_SETTING_KEY,
} from "@/lib/date/working-day";
import { readJsonBody, validationError } from "@/lib/validation/api";

export async function GET() {
  const authResult = await requireAuth(new Request("http://localhost"), { params: {} });
  if (authResult instanceof NextResponse) return authResult;

  const guard = requirePermission("org:settings");
  const guardResult = await guard(new Request("http://localhost"), { params: {} });
  if (guardResult) return guardResult;

  const config = await getWorkingDayConfig();
  return NextResponse.json({ data: config });
}

export async function PUT(request: Request) {
  const authResult = await requireAuth(request, { params: {} });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const guard = requirePermission("org:settings");
  const guardResult = await guard(request, { params: {} });
  if (guardResult) return guardResult;

  const parsed = workingDayConfigSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) {
    return NextResponse.json(validationError(parsed.error), { status: 400 });
  }

  const before = await getWorkingDayConfig();
  await setInstanceSetting(WORKING_DAYS_SETTING_KEY, parsed.data, userId);

  await logAudit({
    actorUserId: userId,
    action: "settings_updated",
    entityType: "settings",
    entityId: "working-days",
    before: {
      weekendDays: before.weekendDays,
      holidayCount: before.holidays.length,
    },
    after: {
      weekendDays: parsed.data.weekendDays,
      holidayCount: parsed.data.holidays.length,
    },
  });

  return NextResponse.json({ data: parsed.data });
}

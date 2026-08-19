import { NextResponse } from "next/server";
import { requireAuth, requirePermission } from "@/lib/rbac/middleware";
import { getInstanceSetting, setInstanceSetting } from "@/lib/settings/instance";
import { logAudit } from "@/lib/audit/log";
import { readJsonBody, validationError } from "@/lib/validation/api";
import {
  HOLIDAY_EGRESS_SETTING_KEY,
  holidayEgressConfigSchema,
  normalizeHolidayEgress,
} from "@/lib/date/holidays/download";

export async function GET() {
  const authResult = await requireAuth(new Request("http://localhost"), { params: {} });
  if (authResult instanceof NextResponse) return authResult;

  const guard = requirePermission("org:settings");
  const guardResult = await guard(new Request("http://localhost"), { params: {} });
  if (guardResult) return guardResult;

  const stored = await getInstanceSetting(HOLIDAY_EGRESS_SETTING_KEY, undefined);
  return NextResponse.json({ data: normalizeHolidayEgress(stored) });
}

export async function PUT(request: Request) {
  const authResult = await requireAuth(request, { params: {} });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const guard = requirePermission("org:settings");
  const guardResult = await guard(request, { params: {} });
  if (guardResult) return guardResult;

  const parsed = holidayEgressConfigSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) {
    return NextResponse.json(validationError(parsed.error), { status: 400 });
  }

  const before = normalizeHolidayEgress(
    await getInstanceSetting(HOLIDAY_EGRESS_SETTING_KEY, undefined),
  );
  await setInstanceSetting(HOLIDAY_EGRESS_SETTING_KEY, parsed.data, userId);

  await logAudit({
    actorUserId: userId,
    action: "settings_updated",
    entityType: "settings",
    entityId: "holiday-egress",
    before: { enabled: before.enabled, countryCode: before.countryCode },
    after: { enabled: parsed.data.enabled, countryCode: parsed.data.countryCode },
  });

  return NextResponse.json({ data: parsed.data });
}

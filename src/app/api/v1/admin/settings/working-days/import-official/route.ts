import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, requirePermission } from "@/lib/rbac/middleware";
import { readJsonBody, validationError } from "@/lib/validation/api";
import { HOLIDAY_REGIONS, officialHolidaysForRegion, type HolidayRegion } from "@/lib/date/holidays/registry";
import { applyHolidayImport } from "@/lib/date/holidays/import";

const importOfficialSchema = z
  .object({
    region: z.enum(HOLIDAY_REGIONS),
    // Gregorian years to import; defaults to the current year.
    years: z.array(z.number().int().min(2000).max(2200)).max(10).optional(),
  })
  .strict();

export async function POST(request: Request) {
  const authResult = await requireAuth(request, { params: {} });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const guard = requirePermission("org:settings");
  const guardResult = await guard(request, { params: {} });
  if (guardResult) return guardResult;

  const parsed = importOfficialSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) {
    return NextResponse.json(validationError(parsed.error), { status: 400 });
  }

  const region = parsed.data.region as HolidayRegion;
  const years = parsed.data.years ?? [new Date().getFullYear()];
  const incoming = years.flatMap((year) => officialHolidaysForRegion(region, year));

  const result = await applyHolidayImport({
    actorUserId: userId,
    source: "official",
    incoming,
    detail: { region, years },
  });

  return NextResponse.json({ data: { ...result, region, years } });
}

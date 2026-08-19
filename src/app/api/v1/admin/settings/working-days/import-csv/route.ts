import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, requirePermission } from "@/lib/rbac/middleware";
import { readJsonBody, validationError } from "@/lib/validation/api";
import { parseHolidayCsv } from "@/lib/date/holidays/csv";
import { applyHolidayImport } from "@/lib/date/holidays/import";

const importCsvSchema = z
  .object({
    csv: z.string().min(1).max(1_000_000),
  })
  .strict();

export async function POST(request: Request) {
  const authResult = await requireAuth(request, { params: {} });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const guard = requirePermission("org:settings");
  const guardResult = await guard(request, { params: {} });
  if (guardResult) return guardResult;

  const parsed = importCsvSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) {
    return NextResponse.json(validationError(parsed.error), { status: 400 });
  }

  const { holidays, errors } = parseHolidayCsv(parsed.data.csv);
  const result = await applyHolidayImport({
    actorUserId: userId,
    source: "csv",
    incoming: holidays,
    detail: { parseErrors: errors.length },
  });

  return NextResponse.json({ data: { ...result, errors } });
}

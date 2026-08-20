import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, requirePermission } from "@/lib/rbac/middleware";
import { readJsonBody, validationError } from "@/lib/validation/api";
import { getInstanceSetting } from "@/lib/settings/instance";
import {
  apiKeyState,
  downloadPublicHolidays,
  HOLIDAY_EGRESS_SETTING_KEY,
  normalizeHolidayEgress,
} from "@/lib/date/holidays/download";
import { applyHolidayImport } from "@/lib/date/holidays/import";

const downloadSchema = z
  .object({
    year: z.number().int().min(2000).max(2200).optional(),
  })
  .strict();

export async function POST(request: Request) {
  const authResult = await requireAuth(request, { params: {} });
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const guard = requirePermission("org:settings");
  const guardResult = await guard(request, { params: {} });
  if (guardResult) return guardResult;

  const parsed = downloadSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) {
    return NextResponse.json(validationError(parsed.error), { status: 400 });
  }

  const egress = normalizeHolidayEgress(
    await getInstanceSetting(HOLIDAY_EGRESS_SETTING_KEY, undefined),
  );
  if (!egress.enabled) {
    return NextResponse.json(
      {
        error: {
          code: "egress_disabled",
          message: "Holiday downloads are disabled. Enable them in the download section first.",
        },
      },
      { status: 409 },
    );
  }
  if (egress.provider === "calendarific") {
    const keyState = apiKeyState(egress.apiKey);
    if (keyState === "none") {
      return NextResponse.json(
        {
          error: {
            code: "api_key_required",
            message: "A Calendarific API key is required before downloading.",
          },
        },
        { status: 400 },
      );
    }
    if (keyState === "broken") {
      return NextResponse.json(
        {
          error: {
            code: "api_key_undecryptable",
            message:
              "The stored Calendarific API key cannot be decrypted with the current encryption key (it may have changed since the key was saved). Re-enter the key in the download settings.",
          },
        },
        { status: 409 },
      );
    }
  }

  const year = parsed.data.year ?? new Date().getFullYear();
  try {
    const incoming = await downloadPublicHolidays(egress, year);
    const result = await applyHolidayImport({
      actorUserId: userId,
      source: "download",
      incoming,
      detail: { year, provider: egress.provider, countryCode: egress.countryCode },
    });
    return NextResponse.json({ data: { ...result, year, provider: egress.provider, countryCode: egress.countryCode } });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: "download_failed",
          message: error instanceof Error ? error.message : "The holiday download failed",
        },
      },
      { status: 502 },
    );
  }
}

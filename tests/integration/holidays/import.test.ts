import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { getWorkingDayConfig, WORKING_DAYS_SETTING_KEY } from "@/lib/date/working-day";
import { applyHolidayImport } from "@/lib/date/holidays/import";
import { officialHolidaysForRegion } from "@/lib/date/holidays/registry";
import { HOLIDAY_EGRESS_SETTING_KEY } from "@/lib/date/holidays/download";

const hasDb = !!process.env.DATABASE_URL;
const maybe = hasDb ? describe : describe.skip;

let userId = "";
const year = new Date().getFullYear();

maybe("holiday imports", () => {
  beforeAll(async () => {
    const user = await prisma.user.create({
      data: { email: `holidays-${Date.now()}@example.com`, displayName: "Holiday Importer", status: "active" },
    });
    userId = user.id;
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { actorUserId: userId } });
    await prisma.instanceSetting.deleteMany({
      where: { key: { in: [WORKING_DAYS_SETTING_KEY, HOLIDAY_EGRESS_SETTING_KEY] } },
    });
    await prisma.user.deleteMany({ where: { id: userId } });
  });

  it("imports a bundled official set, persists it, and writes an audit entry", async () => {
    const incoming = officialHolidaysForRegion("ir", year);
    const result = await applyHolidayImport({
      actorUserId: userId,
      source: "official",
      incoming,
      detail: { region: "ir", years: [year] },
    });

    expect(result.imported).toBe(incoming.length);
    expect(result.skipped).toBe(0);

    const stored = await getWorkingDayConfig();
    expect(stored.holidays.length).toBe(incoming.length);

    const audit = await prisma.auditLog.findFirst({
      where: { actorUserId: userId, action: "holidays_imported" },
      orderBy: { occurredAt: "desc" },
    });
    expect(audit).not.toBeNull();
    expect((audit?.afterJson as { source?: string } | null)?.source).toBe("official");
  });

  it("skips dates that already exist on a second import", async () => {
    const incoming = officialHolidaysForRegion("us", year);
    await applyHolidayImport({ actorUserId: userId, source: "csv", incoming });
    const before = await getWorkingDayConfig();
    const result = await applyHolidayImport({ actorUserId: userId, source: "csv", incoming });

    expect(result.imported).toBe(0);
    expect(result.skipped).toBe(incoming.length);
    const after = await getWorkingDayConfig();
    expect(after.holidays.length).toBe(before.holidays.length);
  });
});

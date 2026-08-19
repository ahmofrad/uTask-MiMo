import { describe, it, expect, vi, afterEach } from "vitest";
import {
  downloadPublicHolidays,
  holidayEgressConfigSchema,
  normalizeHolidayEgress,
} from "@/lib/date/holidays/download";
import type { HolidayEgressConfig } from "@/lib/date/holidays/download";

const enabled: HolidayEgressConfig = {
  enabled: true,
  baseUrl: "https://date.nager.at",
  countryCode: "US",
};

function stubFetch(response: unknown, ok = true, status = 200) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok,
      status,
      json: async () => response,
    })),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("holiday egress downloader", () => {
  it("rejects disabled configs", async () => {
    await expect(downloadPublicHolidays({ ...enabled, enabled: false }, 2026)).rejects.toThrow(
      "disabled",
    );
  });

  it("rejects non-allowlisted hosts, http URLs, and malformed configs", () => {
    expect(holidayEgressConfigSchema.safeParse({ ...enabled, baseUrl: "https://evil.example" }).success).toBe(false);
    expect(holidayEgressConfigSchema.safeParse({ ...enabled, baseUrl: "http://date.nager.at" }).success).toBe(false);
    expect(holidayEgressConfigSchema.safeParse({ ...enabled, baseUrl: "not a url" }).success).toBe(false);
  });

  it("only accepts countries the provider actually serves (Iran is not one)", () => {
    expect(holidayEgressConfigSchema.safeParse({ ...enabled, countryCode: "IR" }).success).toBe(false);
    expect(holidayEgressConfigSchema.safeParse({ ...enabled, countryCode: "us" }).success).toBe(true);
    expect(holidayEgressConfigSchema.safeParse({ ...enabled, countryCode: "US" }).success).toBe(true);
  });

  it("maps the provider payload to holiday entries", async () => {
    stubFetch([
      { date: "2026-03-20", localName: "عید نوروز", name: "Nowruz", countryCode: "IR" },
      { date: "2026-04-10", localName: "Eid al-Fitr", name: "Eid al-Fitr", countryCode: "IR" },
      { date: "not-a-date", localName: "Broken", name: "Broken", countryCode: "IR" },
    ]);
    const holidays = await downloadPublicHolidays(enabled, 2026);
    expect(holidays).toEqual([
      { date: "2026-03-20", name: "عید نوروز" },
      { date: "2026-04-10", name: "Eid al-Fitr" },
    ]);
  });

  it("falls back to the English name when localName is absent", async () => {
    stubFetch([{ date: "2026-07-04", name: "Independence Day" }]);
    const holidays = await downloadPublicHolidays(enabled, 2026);
    expect(holidays[0]?.name).toBe("Independence Day");
  });

  it("throws on a non-OK provider response", async () => {
    stubFetch({}, false, 500);
    await expect(downloadPublicHolidays(enabled, 2026)).rejects.toThrow("HTTP 500");
  });

  it("treats a 204 (no data for the country/year) as an empty set", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 204,
        json: async () => {
          throw new Error("no body");
        },
      })),
    );
    const holidays = await downloadPublicHolidays(enabled, 2026);
    expect(holidays).toEqual([]);
  });

  it("normalizes invalid stored configs back to the defaults", () => {
    expect(normalizeHolidayEgress({ enabled: true, baseUrl: "https://date.nager.at", countryCode: "IR" })).toEqual({
      enabled: false,
      baseUrl: "https://date.nager.at",
      countryCode: "US",
    });
    expect(normalizeHolidayEgress(undefined)).toEqual({
      enabled: false,
      baseUrl: "https://date.nager.at",
      countryCode: "US",
    });
  });
});

import { describe, it, expect, vi, afterEach } from "vitest";
import {
  API_KEY_MASK,
  decryptApiKey,
  downloadPublicHolidays,
  encryptApiKey,
  holidayEgressConfigSchema,
  normalizeHolidayEgress,
} from "@/lib/date/holidays/download";
import type { HolidayEgressConfig } from "@/lib/date/holidays/download";

process.env.WEBHOOK_SECRET_ENCRYPTION_KEY = "test-only-encryption-key";

const nager: HolidayEgressConfig = {
  enabled: true,
  provider: "nager",
  baseUrl: "https://date.nager.at",
  countryCode: "US",
  apiKey: "",
};

const calendarific: HolidayEgressConfig = {
  enabled: true,
  provider: "calendarific",
  baseUrl: "https://calendarific.com",
  countryCode: "IR",
  apiKey: encryptApiKey("test-key-123"),
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
    await expect(downloadPublicHolidays({ ...nager, enabled: false }, 2026)).rejects.toThrow(
      "disabled",
    );
  });

  it("rejects non-allowlisted hosts, http URLs, and malformed configs", () => {
    expect(holidayEgressConfigSchema.safeParse({ ...nager, baseUrl: "https://evil.example" }).success).toBe(false);
    expect(holidayEgressConfigSchema.safeParse({ ...nager, baseUrl: "http://date.nager.at" }).success).toBe(false);
    expect(holidayEgressConfigSchema.safeParse({ ...nager, baseUrl: "not a url" }).success).toBe(false);
  });

  it("serves Iran only through Calendarific, not Nager", () => {
    expect(holidayEgressConfigSchema.safeParse({ ...nager, countryCode: "IR" }).success).toBe(false);
    expect(holidayEgressConfigSchema.safeParse({ ...calendarific, countryCode: "IR" }).success).toBe(true);
    expect(holidayEgressConfigSchema.safeParse({ ...calendarific, countryCode: "US" }).success).toBe(true);
    // Lowercase codes normalize.
    expect(holidayEgressConfigSchema.safeParse({ ...nager, countryCode: "us" }).success).toBe(true);
  });

  it("maps the Nager payload to holiday entries", async () => {
    stubFetch([
      { date: "2026-03-20", localName: "عید نوروز", name: "Nowruz", countryCode: "IR" },
      { date: "2026-04-10", localName: "Eid al-Fitr", name: "Eid al-Fitr", countryCode: "IR" },
      { date: "not-a-date", localName: "Broken", name: "Broken", countryCode: "IR" },
    ]);
    const holidays = await downloadPublicHolidays(nager, 2026);
    expect(holidays).toEqual([
      { date: "2026-03-20", name: "عید نوروز" },
      { date: "2026-04-10", name: "Eid al-Fitr" },
    ]);
  });

  it("falls back to the English name when localName is absent (Nager)", async () => {
    stubFetch([{ date: "2026-07-04", name: "Independence Day" }]);
    const holidays = await downloadPublicHolidays(nager, 2026);
    expect(holidays[0]?.name).toBe("Independence Day");
  });

  it("throws on a non-OK Nager response", async () => {
    stubFetch({}, false, 500);
    await expect(downloadPublicHolidays(nager, 2026)).rejects.toThrow("HTTP 500");
  });

  it("treats a Nager 204 (no data for the country/year) as an empty set", async () => {
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
    const holidays = await downloadPublicHolidays({ ...nager, countryCode: "GG" }, 2026);
    expect(holidays).toEqual([]);
  });

  it("downloads Iran through Calendarific and maps the payload", async () => {
    stubFetch({
      meta: { code: 200 },
      response: {
        holidays: [
          { name: "Nowruz", date: { iso: "2026-03-20" } },
          { name: "Eid al-Fitr", date: { iso: "2026-04-10" } },
          { name: "Broken", date: { iso: "not-a-date" } },
        ],
      },
    });
    const holidays = await downloadPublicHolidays(calendarific, 2026);
    expect(holidays).toEqual([
      { date: "2026-03-20", name: "Nowruz" },
      { date: "2026-04-10", name: "Eid al-Fitr" },
    ]);
  });

  it("reports an invalid Calendarific API key", async () => {
    stubFetch({ meta: { code: 401, error_type: "auth failed" }, response: [] });
    await expect(downloadPublicHolidays(calendarific, 2026)).rejects.toThrow("invalid Calendarific API key");
  });

  it("requires a Calendarific API key", async () => {
    await expect(
      downloadPublicHolidays({ ...calendarific, apiKey: "" }, 2026),
    ).rejects.toThrow("API key is required");
  });

  it("encrypts API keys at rest and decrypts them for use", () => {
    const encrypted = encryptApiKey("secret-key");
    expect(encrypted).not.toBe("secret-key");
    expect(encrypted).toContain(":");
    expect(decryptApiKey(encrypted)).toBe("secret-key");
    // The mask and empty values pass through unchanged.
    expect(encryptApiKey(API_KEY_MASK)).toBe(API_KEY_MASK);
    expect(encryptApiKey("")).toBe("");
  });

  it("normalizes invalid stored configs back to the defaults", () => {
    expect(
      normalizeHolidayEgress({ enabled: true, baseUrl: "https://date.nager.at", countryCode: "IR" }),
    ).toEqual({
      enabled: false,
      provider: "nager",
      baseUrl: "https://date.nager.at",
      countryCode: "US",
      apiKey: "",
    });
    expect(normalizeHolidayEgress(undefined)).toEqual({
      enabled: false,
      provider: "nager",
      baseUrl: "https://date.nager.at",
      countryCode: "US",
      apiKey: "",
    });
  });
});

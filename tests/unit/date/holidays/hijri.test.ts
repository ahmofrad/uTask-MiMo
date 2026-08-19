import { describe, it, expect } from "vitest";
import { hijriParts, hijriToGregorian } from "@/lib/date/holidays/hijri";

describe("hijri conversion (islamic-umalqura)", () => {
  it("resolves known Gregorian dates to their Hijri equivalents", () => {
    // 1 Shawwal 1445 = Eid al-Fitr 2024
    expect(hijriParts(new Date(Date.UTC(2024, 3, 10)))).toEqual({ hy: 1445, hm: 10, hd: 1 });
    // 10 Dhu al-Hijjah 1445 = Eid al-Adha 2024
    expect(hijriParts(new Date(Date.UTC(2024, 5, 16)))).toEqual({ hy: 1445, hm: 12, hd: 10 });
    // 10 Muharram 1446 = Ashura 2024
    expect(hijriParts(new Date(Date.UTC(2024, 6, 16)))).toEqual({ hy: 1446, hm: 1, hd: 10 });
  });

  it("round-trips Hijri dates to Gregorian (local noon, zone-agnostic)", () => {
    const eidFitr = hijriToGregorian(1445, 10, 1);
    expect(eidFitr.getFullYear()).toBe(2024);
    expect(eidFitr.getMonth()).toBe(3);
    expect(eidFitr.getDate()).toBe(10);

    const ashura = hijriToGregorian(1446, 1, 10);
    expect(ashura.getFullYear()).toBe(2024);
    expect(ashura.getMonth()).toBe(6);
    expect(ashura.getDate()).toBe(16);
  });
});

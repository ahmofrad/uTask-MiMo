/**
 * Hijri (Islamic) calendar helpers for Iranian lunar holidays, using the
 * built-in `Intl` `islamic-umalqura` calendar. No dependencies and fully
 * offline — the conversion is pure arithmetic inside the JS engine.
 *
 * Caveat: the Umm al-Qura calendar is an arithmetic approximation. Iran's
 * officially announced dates occasionally differ by a day (moon-sighting).
 * The imported set is therefore a close-to-official baseline the admin can
 * adjust by hand.
 */

export type HijriDate = { hy: number; hm: number; hd: number };

const formatter = new Intl.DateTimeFormat("en-US-u-ca-islamic-umalqura", {
  year: "numeric",
  month: "numeric",
  day: "numeric",
  timeZone: "UTC",
});

/** The Hijri (Umm al-Qura) year/month/day of a Gregorian instant, in UTC. */
export function hijriParts(date: Date): HijriDate {
  const parts = formatter.formatToParts(date);
  const read = (type: string): number => {
    const part = parts.find((p) => p.type === type);
    return Number(part?.value ?? "1");
  };
  return { hy: read("year"), hm: read("month"), hd: read("day") };
}

/**
 * The Gregorian local-noon instant for a Hijri date, or null when the date
 * does not exist in that year (e.g. 30 Safar in a 29-day Safar). Scans a
 * 730-day window from January of the approximate Hijri year — wide enough to
 * cover the full 354/355-day Hijri year and the late lunar months. Local
 * noon keeps the result on the intended calendar day regardless of the
 * runtime timezone.
 */
export function hijriToGregorian(hy: number, hm: number, hd: number): Date | null {
  // Approximate Gregorian year of the Hijri new year.
  const approxYear = Math.floor(hy * 0.97023 + 621.57);
  const start = Date.UTC(approxYear, 0, 1);
  for (let i = 0; i < 730; i++) {
    const candidate = new Date(start + i * 86_400_000);
    const parts = hijriParts(candidate);
    if (parts.hy === hy && parts.hm === hm && parts.hd === hd) {
      return new Date(
        candidate.getUTCFullYear(),
        candidate.getUTCMonth(),
        candidate.getUTCDate(),
        12,
      );
    }
  }
  return null;
}

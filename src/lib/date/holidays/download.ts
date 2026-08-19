import { z } from "zod";
import type { HolidayEntry } from "@/lib/date/working-day-calendar";

/**
 * Opt-in egress download of official holidays. The default install is
 * air-gapped (no outbound traffic), so this is disabled unless an admin
 * explicitly enables it AND the customer's network allows outbound HTTPS to
 * the provider host.
 *
 * SSRF safety: the provider URL is validated against an allowlist of known
 * public hosts, must be HTTPS, and redirects are rejected — the fetch can
 * never be pointed at internal ranges.
 */

export const HOLIDAY_EGRESS_SETTING_KEY = "holidayEgress";

export const ALLOWED_EGRESS_HOSTS = new Set(["date.nager.at"]);

export type HolidayEgressConfig = {
  enabled: boolean;
  baseUrl: string;
  countryCode: string;
};

export const DEFAULT_HOLIDAY_EGRESS: HolidayEgressConfig = {
  enabled: false,
  baseUrl: "https://date.nager.at",
  countryCode: "IR",
};

export const holidayEgressConfigSchema = z
  .object({
    enabled: z.boolean(),
    baseUrl: z
      .string()
      .url()
      .refine((value) => {
        try {
          const parsed = new URL(value);
          return parsed.protocol === "https:" && ALLOWED_EGRESS_HOSTS.has(parsed.hostname);
        } catch {
          return false;
        }
      }, "The provider URL must be HTTPS and use an allowlisted host"),
    countryCode: z.string().trim().toUpperCase().min(2).max(3),
  })
  .strict();

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

type NagerHoliday = {
  date?: string;
  localName?: string;
  name?: string;
};

/** Fetches official holidays for a year from the configured provider. */
export async function downloadPublicHolidays(
  config: HolidayEgressConfig,
  year: number,
): Promise<HolidayEntry[]> {
  if (!config.enabled) {
    throw new Error("holiday egress is disabled");
  }
  const parsed = holidayEgressConfigSchema.safeParse(config);
  if (!parsed.success) {
    throw new Error("invalid holiday egress configuration");
  }
  const endpoint = `${config.baseUrl.replace(/\/$/, "")}/api/v3/PublicHolidays/${year}/${config.countryCode}`;
  const response = await fetch(endpoint, {
    signal: AbortSignal.timeout(10_000),
    redirect: "error",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`holiday provider returned HTTP ${response.status}`);
  }
  const body = (await response.json()) as NagerHoliday[];
  if (!Array.isArray(body)) {
    throw new Error("holiday provider returned an unexpected payload");
  }
  return body
    .filter((entry) => typeof entry.date === "string" && DATE_PATTERN.test(entry.date))
    .map((entry) => ({
      date: entry.date as string,
      name: (entry.localName || entry.name || "").slice(0, 255),
    }));
}

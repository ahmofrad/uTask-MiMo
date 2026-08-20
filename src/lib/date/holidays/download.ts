import { z } from "zod";
import { decrypt, encrypt } from "@/lib/crypto/encrypt";
import type { HolidayEntry } from "@/lib/date/working-day-calendar";
import {
  countriesForProvider,
  PROVIDER_DEFAULT_BASE_URLS,
  type HolidayProvider,
} from "./countries";

/**
 * Opt-in egress download of official holidays. The default install is
 * air-gapped (no outbound traffic), so this is disabled unless an admin
 * explicitly enables it AND the customer's network allows outbound HTTPS to
 * the provider host.
 *
 * Providers:
 * - `nager` — Nager.Date, keyless, but does NOT serve Iran (204 empty).
 * - `calendarific` — Calendarific, free API key (1,000 req/day), serves
 *   Iran and 230+ countries. The key is encrypted at rest.
 *
 * SSRF safety: the provider URL is validated against an allowlist of known
 * public hosts, must be HTTPS, and redirects are rejected — the fetch can
 * never be pointed at internal ranges.
 */

export const HOLIDAY_EGRESS_SETTING_KEY = "holidayEgress";

export const ALLOWED_EGRESS_HOSTS = new Set(["date.nager.at", "calendarific.com"]);

export const HOLIDAY_PROVIDERS = ["nager", "calendarific"] as const;

export type HolidayEgressConfig = {
  enabled: boolean;
  provider: HolidayProvider;
  baseUrl: string;
  countryCode: string;
  /** Encrypted at rest; the API never returns the plaintext. */
  apiKey: string;
};

// Placeholder the UI submits when the key is left unchanged.
export const API_KEY_MASK = "********";

export const DEFAULT_HOLIDAY_EGRESS: HolidayEgressConfig = {
  enabled: false,
  provider: "nager",
  baseUrl: "https://date.nager.at",
  countryCode: "US",
  apiKey: "",
};

export function isSupportedHolidayCountry(provider: HolidayProvider, countryCode: string): boolean {
  const code = countryCode.trim().toUpperCase();
  return countriesForProvider(provider).some(([candidate]) => candidate === code);
}

export const holidayEgressConfigSchema = z
  .object({
    enabled: z.boolean(),
    provider: z.enum(HOLIDAY_PROVIDERS).default("nager"),
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
    countryCode: z
      .string()
      .trim()
      .toUpperCase()
      .min(2)
      .max(3),
    apiKey: z.string().max(512).default(""),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (!isSupportedHolidayCountry(value.provider, value.countryCode)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["countryCode"],
        message: "This provider does not serve the selected country",
      });
    }
  });

/**
 * Returns the config when valid, otherwise the defaults — so a stale stored
 * value (e.g. a provider-dropped country) never bricks the section.
 */
export function normalizeHolidayEgress(value: unknown): HolidayEgressConfig {
  const parsed = holidayEgressConfigSchema.safeParse(value);
  if (!parsed.success) return DEFAULT_HOLIDAY_EGRESS;
  // The base URL is provider-scoped: a stale or mismatched stored value (e.g.
  // the Nager host left behind after switching to Calendarific) must never
  // survive, or downloads would hit the wrong provider.
  return { ...parsed.data, baseUrl: PROVIDER_DEFAULT_BASE_URLS[parsed.data.provider] };
}

// Secrets are stored as `iv:ciphertext:tag`, the same envelope as webhook
// secrets (see `decryptSecret` in lib/webhook).
export function encryptApiKey(plaintext: string): string {
  if (plaintext === "" || plaintext === API_KEY_MASK) return plaintext;
  const payload = encrypt(plaintext);
  return `${payload.iv}:${payload.ciphertext}:${payload.tag}`;
}

export function decryptApiKey(stored: string): string {
  if (stored === "" || !stored.includes(":")) return stored;
  const [iv, ciphertext, tag] = stored.split(":");
  if (!iv || !ciphertext || !tag) return stored;
  try {
    return decrypt({ iv, ciphertext, tag });
  } catch {
    return "";
  }
}

export type ApiKeyState = "none" | "ok" | "broken";

/**
 * Classifies the stored API key: `none` when unset or masked, `ok` when it
 * decrypts under the current encryption key, `broken` when a stored blob
 * exists but fails to decrypt — e.g. WEBHOOK_SECRET_ENCRYPTION_KEY changed
 * between restarts or deployments. The UI must surface `broken` instead of
 * pretending the key is configured, and the download guard must reject it
 * with a clear reason rather than a misleading "key required" error.
 */
export function apiKeyState(stored: string): ApiKeyState {
  if (stored === "" || stored === API_KEY_MASK) return "none";
  // decryptApiKey returns "" exactly when the stored value fails to decrypt.
  return decryptApiKey(stored) === "" ? "broken" : "ok";
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

type NagerHoliday = {
  date?: string;
  localName?: string;
  name?: string;
};

type CalendarificResponse = {
  meta?: { code?: number };
  response?: { holidays?: Array<{ name?: string; date?: { iso?: string } }> };
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
  return config.provider === "calendarific"
    ? downloadFromCalendarific(parsed.data, year)
    : downloadFromNager(parsed.data, year);
}

async function fetchJson(endpoint: string, baseUrl: string): Promise<Response> {
  const parsed = new URL(endpoint);
  const expectedBase = new URL(baseUrl);
  if (parsed.origin !== expectedBase.origin) {
    throw new Error("holiday provider URL resolved to an unexpected host");
  }
  return fetch(endpoint, {
    signal: AbortSignal.timeout(10_000),
    redirect: "error",
    headers: { Accept: "application/json" },
  });
}

async function downloadFromNager(config: HolidayEgressConfig, year: number): Promise<HolidayEntry[]> {
  const endpoint = `${config.baseUrl.replace(/\/$/, "")}/api/v3/PublicHolidays/${year}/${config.countryCode}`;
  const response = await fetchJson(endpoint, config.baseUrl);
  // 204 means the provider has no data for this country/year — an empty set,
  // not an error.
  if (response.status === 204) {
    return [];
  }
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

async function downloadFromCalendarific(
  config: HolidayEgressConfig,
  year: number,
): Promise<HolidayEntry[]> {
  const key = decryptApiKey(config.apiKey);
  if (!key) {
    throw new Error("a Calendarific API key is required");
  }
  const base = config.baseUrl.replace(/\/$/, "");
  const params = new URLSearchParams({ api_key: key, country: config.countryCode, year: String(year) });
  const response = await fetchJson(`${base}/api/v2/holidays?${params.toString()}`, config.baseUrl);
  if (response.status === 401) {
    throw new Error("invalid Calendarific API key");
  }
  if (!response.ok) {
    throw new Error(`holiday provider returned HTTP ${response.status}`);
  }
  const body = (await response.json()) as CalendarificResponse;
  if (body.meta?.code === 401 || body.meta?.code === 601) {
    throw new Error("invalid Calendarific API key");
  }
  if (body.meta?.code != null && body.meta.code !== 200) {
    throw new Error(`holiday provider returned code ${body.meta.code}`);
  }
  const holidays = body.response?.holidays;
  if (!Array.isArray(holidays)) {
    throw new Error("holiday provider returned an unexpected payload");
  }
  return holidays
    .filter((entry) => typeof entry.date?.iso === "string" && DATE_PATTERN.test(entry.date.iso!))
    .map((entry) => ({
      date: entry.date!.iso!,
      name: (entry.name ?? "").slice(0, 255),
    }));
}

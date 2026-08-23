/**
 * Country snapshots for the holiday egress providers, embedded so the admin
 * dropdown works offline and only offers codes the provider can serve.
 *
 * - Nager (date.nager.at): 204 countries, no Iran.
 * - Calendarific: 230 countries, includes Iran (the reason it exists).
 *
 * Pure data module (no crypto/DB): safe to import from client components.
 */

import { NAGER_COUNTRIES } from "./countries-nager";
import { CALENDARIFIC_COUNTRIES } from "./countries-calendarific";

// Backward-compat aliases
export const SUPPORTED_HOLIDAY_COUNTRIES: ReadonlyArray<readonly [string, string]> = NAGER_COUNTRIES;
export { CALENDARIFIC_COUNTRIES, NAGER_COUNTRIES };

export type HolidayProvider = "nager" | "calendarific";

export function countriesForProvider(provider: HolidayProvider): ReadonlyArray<readonly [string, string]> {
  return provider === "calendarific" ? CALENDARIFIC_COUNTRIES : NAGER_COUNTRIES;
}

/** The allowlisted base URL each provider must use — never stored mixed. */
export const PROVIDER_DEFAULT_BASE_URLS: Record<HolidayProvider, string> = {
  nager: "https://date.nager.at",
  calendarific: "https://calendarific.com",
};
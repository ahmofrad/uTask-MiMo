export const ESTIMATED_HOURS_PER_DAY = 8;

function roundToTwoDecimals(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Converts the API/database hour value into the workday value shown in the UI. */
export function estimatedHoursToDays(value: number | null | undefined): number | null | undefined {
  if (value == null) return value;
  return roundToTwoDecimals(value / ESTIMATED_HOURS_PER_DAY);
}

/** Converts the workday value entered in the UI into the API/database hour value. */
export function estimatedDaysToHours(value: number | null | undefined): number | null | undefined {
  if (value == null) return value;
  return roundToTwoDecimals(value * ESTIMATED_HOURS_PER_DAY);
}

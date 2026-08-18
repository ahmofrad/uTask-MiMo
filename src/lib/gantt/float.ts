/**
 * Compact signed display of a task's schedule float, mirroring the dependency
 * label conventions in `links.ts` ("FS +2d"). Zero means the task sits exactly
 * on the critical path; negative means it is already behind schedule.
 *
 * @example
 *   formatFloatDays(0)     // "0d"
 *   formatFloatDays(2)     // "+2d"
 *   formatFloatDays(-1.5)  // "-1.5d"
 */
export function formatFloatDays(days: number): string {
  const rounded = Math.round(days * 10) / 10;
  if (rounded === 0) return "0d";
  return `${rounded > 0 ? "+" : ""}${rounded}d`;
}

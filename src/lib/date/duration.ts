/** Days + hours between two ISO date strings (0/0 when end <= start). */
export function computeDuration(start: string, end: string): { days: number; hours: number } {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms <= 0) return { days: 0, hours: 0 };
  const totalHours = Math.floor(ms / (1000 * 60 * 60));
  return { days: Math.floor(totalHours / 24), hours: totalHours % 24 };
}

/** Adds a duration to an ISO date string and returns the new ISO string. */
export function addDurationToDate(start: string, days: number, hours: number): string {
  const d = new Date(start);
  d.setDate(d.getDate() + days);
  d.setHours(d.getHours() + hours);
  return d.toISOString();
}
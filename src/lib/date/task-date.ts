const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Converts the calendar picker's date-only value into the ISO datetime shape
 * required by the task API while preserving already-normalized values.
 */
export function normalizeTaskDate(value: string | null | undefined): string | null | undefined {
  if (value == null || !DATE_ONLY_PATTERN.test(value)) return value;
  return `${value}T00:00:00.000Z`;
}

import { addMonths, endOfMonth } from '@/lib/format';

/** A month is written `YYYY-MM`, so string comparison is month comparison and no time zone gets involved. */
export function isMonth(value: string | null): value is string {
  return value !== null && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

/** The month a `YYYY-MM-DD` date is in. */
export function monthOf(date: string): string {
  return date.slice(0, 7);
}

/** The month `by` months before (negative) or after this one. */
export function shiftMonth(month: string, by: number): string {
  return monthOf(addMonths(`${month}-01`, by));
}

/** The first and last day of a month, as `YYYY-MM-DD`. */
export function monthRange(month: string): { from: string; to: string } {
  const first = `${month}-01`;
  return { from: first, to: endOfMonth(first) };
}

const monthName = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });

/** `October 2026`. Built on UTC, so the zone the browser is in cannot move the month. */
export function monthLabel(month: string): string {
  const [year, number] = month.split('-').map(Number);
  return monthName.format(new Date(Date.UTC(year, number - 1, 1)));
}

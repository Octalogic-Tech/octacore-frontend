export function formatCurrency(amount: number): string {
  const whole = Number.isInteger(amount);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

const shortDate = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

/** Formats `YYYY-MM-DD` from the parts, so the day never shifts with the time zone. */
export function formatDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) return iso;
  const [, year, month, day] = match;
  return shortDate.format(new Date(Number(year), Number(month) - 1, Number(day)));
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/** Today as `YYYY-MM-DD` from the local date parts. `toISOString` would give the UTC day, which is the wrong day near midnight. */
export function localToday(now: Date = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

const DATE_PARTS = /^(\d{4})-(\d{2})-(\d{2})$/;

const pad = (value: number) => String(value).padStart(2, '0');

function daysInMonth(year: number, month: number): number {
  // `month` is 1 to 12; day 0 of the next month is the last day of this one.
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** The parts of a real `YYYY-MM-DD` date from the year 1000 on, or null. Never goes through a time zone. */
function dateParts(iso: string): { year: number; month: number; day: number } | null {
  const match = DATE_PARTS.exec(iso);
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (year < 1000 || month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return null;
  return { year, month, day };
}

/**
 * `YYYY-MM-DD` plus whole months, on the date parts. A day past the end of the month it lands in clamps to that
 * month's last day (30 Nov plus 3 months is 28 Feb). Anything that is not a real date gives `''`.
 */
export function addMonths(iso: string, months: number): string {
  const parts = dateParts(iso);
  if (!parts) return '';
  const index = parts.year * 12 + (parts.month - 1) + months;
  const year = Math.floor(index / 12);
  const month = index - year * 12 + 1;
  return `${String(year).padStart(4, '0')}-${pad(month)}-${pad(Math.min(parts.day, daysInMonth(year, month)))}`;
}

/** The last day of the month a `YYYY-MM-DD` date is in. Anything that is not a real date gives `''`. */
export function endOfMonth(iso: string): string {
  const parts = dateParts(iso);
  if (!parts) return '';
  return `${String(parts.year).padStart(4, '0')}-${pad(parts.month)}-${pad(daysInMonth(parts.year, parts.month))}`;
}

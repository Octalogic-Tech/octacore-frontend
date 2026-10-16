import type { ExpenseSummary } from './schema';

export interface StripFigures {
  thisMonth: number;
  lastMonth: number;
  yearToDate: number;
}

const pad = (value: number) => String(value).padStart(2, '0');

/**
 * This month, last month and the year so far, in US cents, from the by-month totals of a summary that runs to today.
 * Months are `YYYY-MM`, so string comparison is month comparison and no time zone gets involved.
 */
export function stripFigures(byMonth: ExpenseSummary['byMonth'], today: string): StripFigures {
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  const thisKey = `${year}-${pad(month)}`;
  const lastKey = month === 1 ? `${year - 1}-12` : `${year}-${pad(month - 1)}`;
  const total = (keep: (key: string) => boolean) =>
    byMonth.filter((row) => keep(row.month)).reduce((sum, row) => sum + row.totalCents, 0);
  return {
    thisMonth: total((key) => key === thisKey),
    lastMonth: total((key) => key === lastKey),
    yearToDate: total((key) => key.startsWith(`${year}-`)),
  };
}

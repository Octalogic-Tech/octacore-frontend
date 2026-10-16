import type { ExpenseQuery } from './api';

export type SourceFilter = 'all' | 'one-time' | 'recurring';

export interface LedgerFilters {
  expenseTypeId: number | null;
  projectId: number | null;
  /** `YYYY-MM-DD`, compared with the charge date. Empty is no bound. */
  from: string;
  to: string;
  source: SourceFilter;
  q: string;
}

/** The current calendar year: the ledger opens on this year's spend, not on all of history. */
export function defaultFilters(today: string): LedgerFilters {
  const year = today.slice(0, 4);
  return { expenseTypeId: null, projectId: null, from: `${year}-01-01`, to: `${year}-12-31`, source: 'all', q: '' };
}

export function isDefaultFilters(filters: LedgerFilters, today: string): boolean {
  const defaults = defaultFilters(today);
  return (Object.keys(defaults) as (keyof LedgerFilters)[]).every((key) => filters[key] === defaults[key]);
}

/** An inverted range matches nothing: no date is both after `from` and before `to`. */
export function isRangeInverted({ from, to }: Pick<LedgerFilters, 'from' | 'to'>): boolean {
  return Boolean(from && to && from > to);
}

/** What the service takes. A blank filter is left out, and a search of only spaces is no search. */
export function toQuery(filters: LedgerFilters): ExpenseQuery {
  const query: ExpenseQuery = {};
  if (filters.expenseTypeId !== null) query.expenseTypeId = filters.expenseTypeId;
  if (filters.projectId !== null) query.projectId = filters.projectId;
  if (filters.from) query.from = filters.from;
  if (filters.to) query.to = filters.to;
  if (filters.source !== 'all') query.recurring = filters.source === 'recurring';
  const q = filters.q.trim();
  if (q) query.q = q;
  return query;
}

/** The summary behind the strip: all spend from the start of last year to today, whatever the ledger's filters. */
export function stripQuery(today: string): ExpenseQuery {
  return { from: `${Number(today.slice(0, 4)) - 1}-01-01`, to: today };
}

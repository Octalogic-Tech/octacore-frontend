import type { ExpenseQuery } from './api';
import { monthRange } from './months';

/** The One-time tab's filters. */
export interface OneTimeFilters {
  expenseTypeId: number | null;
  projectId: number | null;
  personId: number | null;
  /** `YYYY-MM-DD`, compared with the charge date. Empty is no bound. */
  from: string;
  to: string;
  q: string;
}

/** The current calendar year: the tab opens on this year's one-off spend, not on all of history. */
export function defaultOneTimeFilters(today: string): OneTimeFilters {
  const year = today.slice(0, 4);
  return { expenseTypeId: null, projectId: null, personId: null, from: `${year}-01-01`, to: `${year}-12-31`, q: '' };
}

export function isDefaultOneTimeFilters(filters: OneTimeFilters, today: string): boolean {
  const defaults = defaultOneTimeFilters(today);
  return (Object.keys(defaults) as (keyof OneTimeFilters)[]).every((key) => filters[key] === defaults[key]);
}

/** An inverted range matches nothing: no date is both after `from` and before `to`. */
export function isRangeInverted({ from, to }: Pick<OneTimeFilters, 'from' | 'to'>): boolean {
  return Boolean(from && to && from > to);
}

/** What the service takes for the One-time tab: only one-time expenses, a blank filter left out. */
export function toOneTimeQuery(filters: OneTimeFilters): ExpenseQuery {
  const query: ExpenseQuery = { recurring: false };
  if (filters.expenseTypeId !== null) query.expenseTypeId = filters.expenseTypeId;
  if (filters.projectId !== null) query.projectId = filters.projectId;
  if (filters.personId !== null) query.personId = filters.personId;
  if (filters.from) query.from = filters.from;
  if (filters.to) query.to = filters.to;
  const q = filters.q.trim();
  if (q) query.q = q;
  return query;
}

/** The Overview tab's filters: the month is chosen separately. */
export interface OverviewFilters {
  expenseTypeId: number | null;
  projectId: number | null;
  personId: number | null;
}

export const NO_OVERVIEW_FILTERS: OverviewFilters = { expenseTypeId: null, projectId: null, personId: null };

export function hasOverviewFilters(filters: OverviewFilters): boolean {
  return filters.expenseTypeId !== null || filters.projectId !== null || filters.personId !== null;
}

/** The whole month, one-time expenses and generated charges together, narrowed by the filters that are set. */
export function toOverviewQuery(month: string, filters: OverviewFilters): ExpenseQuery {
  const query: ExpenseQuery = monthRange(month);
  if (filters.expenseTypeId !== null) query.expenseTypeId = filters.expenseTypeId;
  if (filters.projectId !== null) query.projectId = filters.projectId;
  if (filters.personId !== null) query.personId = filters.personId;
  return query;
}

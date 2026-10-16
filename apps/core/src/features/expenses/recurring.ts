import type { RecurringRow, RecurringState } from './schema';

const ORDER: Record<RecurringState, number> = { active: 0, paused: 1, cancelled: 2 };
const LATEST = '9999-12-31';

/** Active ones first, then paused, then cancelled; within a state, the soonest next charge, then the name. */
export function sortRecurring(rows: readonly RecurringRow[]): RecurringRow[] {
  return [...rows].sort(
    (a, b) =>
      ORDER[a.state] - ORDER[b.state] ||
      (a.nextChargeDate ?? LATEST).localeCompare(b.nextChargeDate ?? LATEST) ||
      a.name.localeCompare(b.name),
  );
}

/** What the active recurring expenses cost, in US cents per month and per year. Paused and cancelled ones cost nothing. */
export function costTotals(rows: readonly RecurringRow[]): { monthly: number; yearly: number } {
  return rows
    .filter((row) => row.state === 'active')
    .reduce(
      (totals, row) => ({
        monthly: totals.monthly + row.monthlyCostCents,
        yearly: totals.yearly + row.yearlyCostCents,
      }),
      { monthly: 0, yearly: 0 },
    );
}

import type { Bill, BillFilters } from './types';

export const emptyFilters: BillFilters = { from: '', to: '', approval: 'all' };

/** Dates are `YYYY-MM-DD`, so string comparison is date comparison and no time zone gets involved. */
export function filterBills(bills: Bill[], { from, to, approval }: BillFilters): Bill[] {
  return bills.filter((bill) => {
    if (from && bill.billDate < from) return false;
    if (to && bill.billDate > to) return false;
    if (approval === 'approved' && !bill.approved) return false;
    if (approval === 'pending' && bill.approved) return false;
    return true;
  });
}

export function isRangeInverted({ from, to }: Pick<BillFilters, 'from' | 'to'>): boolean {
  return Boolean(from && to && from > to);
}

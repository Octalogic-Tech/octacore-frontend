import { emptyFilters, filterBills, isRangeInverted } from './filters';
import type { Bill } from './types';

const bill = (id: number, billDate: string, approved: boolean): Bill => ({
  id,
  billDate,
  amount: 100,
  billType: 'Regular',
  actualExpense: false,
  billPath: `/path/${id}`,
  uploadedBy: 'Asha',
  submittedBy: 'Asha',
  approved,
  approvedBy: approved ? 'Manager' : '',
});

const bills = [bill(1, '2023-08-08', true), bill(2, '2023-08-09', false), bill(3, '2023-08-10', true)];
const ids = (list: Bill[]) => list.map((item) => item.id);

describe('filterBills', () => {
  it('keeps everything when no filter is set', () => {
    expect(ids(filterBills(bills, emptyFilters))).toEqual([1, 2, 3]);
  });

  it('includes both date bounds', () => {
    expect(ids(filterBills(bills, { ...emptyFilters, from: '2023-08-09', to: '2023-08-10' }))).toEqual([2, 3]);
    expect(ids(filterBills(bills, { ...emptyFilters, from: '2023-08-09', to: '2023-08-09' }))).toEqual([2]);
  });

  it('works with only a from date', () => {
    expect(ids(filterBills(bills, { ...emptyFilters, from: '2023-08-09' }))).toEqual([2, 3]);
  });

  it('works with only a to date', () => {
    expect(ids(filterBills(bills, { ...emptyFilters, to: '2023-08-09' }))).toEqual([1, 2]);
  });

  it('filters by approval', () => {
    expect(ids(filterBills(bills, { ...emptyFilters, approval: 'approved' }))).toEqual([1, 3]);
    expect(ids(filterBills(bills, { ...emptyFilters, approval: 'pending' }))).toEqual([2]);
  });

  it('combines the filters', () => {
    expect(ids(filterBills(bills, { from: '2023-08-09', to: '', approval: 'approved' }))).toEqual([3]);
  });

  it('returns nothing, not everything, for an inverted range', () => {
    expect(filterBills(bills, { ...emptyFilters, from: '2023-08-10', to: '2023-08-08' })).toEqual([]);
  });
});

describe('isRangeInverted', () => {
  it('is true only when from is after to', () => {
    expect(isRangeInverted({ from: '2023-08-10', to: '2023-08-08' })).toBe(true);
    expect(isRangeInverted({ from: '2023-08-08', to: '2023-08-08' })).toBe(false);
    expect(isRangeInverted({ from: '2023-08-08', to: '2023-08-10' })).toBe(false);
  });

  it('is false while either bound is empty', () => {
    expect(isRangeInverted({ from: '', to: '2023-08-08' })).toBe(false);
    expect(isRangeInverted({ from: '2023-08-08', to: '' })).toBe(false);
  });
});

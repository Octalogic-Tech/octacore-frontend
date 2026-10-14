import type { Bill } from '@/features/bills/types';
import type { Project } from '@/features/projects/types';
import { summarize } from './summary';

const project = (id: number, totalValue: number, totalOutstanding: number): Project => ({
  id,
  name: `Project ${id}`,
  description: '',
  client: 'Client A',
  totalValue,
  totalOutstanding,
});

const bill = (id: number, billDate: string, approved: boolean): Bill => ({
  id,
  billDate,
  amount: 10,
  billType: 'Regular',
  actualExpense: false,
  billPath: '',
  uploadedBy: 'Asha',
  submittedBy: 'Asha',
  approved,
  approvedBy: '',
});

describe('summarize', () => {
  it('totals value and outstanding across projects', () => {
    const summary = summarize([project(1, 1000, 200), project(2, 500, 0), project(3, 2500, 900)], []);
    expect(summary.projectCount).toBe(3);
    expect(summary.totalValue).toBe(4000);
    expect(summary.totalOutstanding).toBe(1100);
  });

  it('ranks the five largest outstanding amounts and leaves settled projects out', () => {
    const outstanding = [0, 10, 70, 30, 60, 50, 20];
    const summary = summarize(outstanding.map((amount, index) => project(index + 1, 100, amount)), []);
    expect(summary.topOutstanding.map((item) => item.id)).toEqual([3, 5, 6, 4, 7]);
  });

  it('counts every pending bill but lists only the five newest', () => {
    const pending = Array.from({ length: 7 }, (_, index) => bill(index + 1, `2023-08-0${index + 1}`, false));
    const summary = summarize([], [...pending, bill(8, '2023-09-01', true), bill(9, '2023-09-02', true)]);
    expect(summary.pendingCount).toBe(7);
    expect(summary.pendingBills.map((item) => item.id)).toEqual([7, 6, 5, 4, 3]);
  });

  it('copes with no data at all', () => {
    expect(summarize([], [])).toEqual({
      projectCount: 0,
      totalValue: 0,
      totalOutstanding: 0,
      topOutstanding: [],
      pendingCount: 0,
      pendingBills: [],
    });
  });
});

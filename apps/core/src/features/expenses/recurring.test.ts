import { recurringRows } from '@/test/fixtures/expenses';
import { costTotals, sortRecurring } from './recurring';
import { recurringRowsSchema } from './schema';

const rows = recurringRowsSchema.parse(recurringRows); // active Figma, paused Co-working desk, cancelled Old VPN

describe('sortRecurring', () => {
  it('puts active first, then paused, then cancelled', () => {
    expect(sortRecurring([...rows].reverse()).map((row) => row.name)).toEqual([
      'Figma',
      'Co-working desk',
      'Old VPN',
    ]);
  });

  it('orders one state by the next charge, then by name, and does not change its input', () => {
    const [figma] = rows;
    const sooner = { ...figma, id: 20, name: 'Zoom', nextChargeDate: '2026-10-20' };
    const same = { ...figma, id: 21, name: 'Asana' };
    const input = [figma, sooner, same];

    expect(sortRecurring(input).map((row) => row.name)).toEqual(['Zoom', 'Asana', 'Figma']);
    expect(input.map((row) => row.name)).toEqual(['Figma', 'Zoom', 'Asana']);
  });
});

describe('costTotals', () => {
  it('adds up only the active expenses, per month and per year', () => {
    expect(costTotals(rows)).toEqual({ monthly: 1500, yearly: 18000 });
  });

  it('is zero when nothing is active', () => {
    expect(costTotals(rows.slice(1))).toEqual({ monthly: 0, yearly: 0 });
  });
});

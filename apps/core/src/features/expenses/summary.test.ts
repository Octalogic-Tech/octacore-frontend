import { stripFigures } from './summary';

const byMonth = [
  { month: '2025-12', totalCents: 700 },
  { month: '2026-01', totalCents: 100 },
  { month: '2026-09', totalCents: 10000 },
  { month: '2026-10', totalCents: 1500 },
];

describe('stripFigures', () => {
  it('adds up this month, last month and the year so far', () => {
    expect(stripFigures(byMonth, '2026-10-16')).toEqual({ thisMonth: 1500, lastMonth: 10000, yearToDate: 11600 });
  });

  it('reaches back into the previous year for last month in January, but not for the year so far', () => {
    // The summary behind the strip runs to today, so it holds no month after it: only December and January here.
    expect(stripFigures(byMonth.slice(0, 2), '2026-01-05')).toEqual({ thisMonth: 100, lastMonth: 700, yearToDate: 100 });
  });

  it('is zero with no months', () => {
    expect(stripFigures([], '2026-10-16')).toEqual({ thisMonth: 0, lastMonth: 0, yearToDate: 0 });
  });
});

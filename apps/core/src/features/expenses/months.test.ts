import { isMonth, monthLabel, monthOf, monthRange, shiftMonth } from './months';

describe('isMonth', () => {
  it.each(['2026-10', '2026-01', '2026-12', '2000-06'])('accepts %j', (value) => {
    expect(isMonth(value)).toBe(true);
  });

  it.each([null, '', '2026-13', '2026-00', '2026-1', '2026-10-01', 'abcd-10', ' 2026-10'])('refuses %j', (value) => {
    expect(isMonth(value)).toBe(false);
  });
});

describe('monthOf', () => {
  it('is the month of a date', () => {
    expect(monthOf('2026-10-16')).toBe('2026-10');
  });
});

describe('shiftMonth', () => {
  it.each([
    ['2026-10', 1, '2026-11'],
    ['2026-12', 1, '2027-01'],
    ['2026-01', -1, '2025-12'],
    ['2026-03', -13, '2025-02'],
    ['2026-10', 0, '2026-10'],
  ])('moves %s by %i to %s', (month, by, expected) => {
    expect(shiftMonth(month, by)).toBe(expected);
  });
});

describe('monthRange', () => {
  it.each([
    ['2026-10', '2026-10-01', '2026-10-31'],
    ['2026-02', '2026-02-01', '2026-02-28'],
    ['2028-02', '2028-02-01', '2028-02-29'],
    ['2026-12', '2026-12-01', '2026-12-31'],
    ['2026-04', '2026-04-01', '2026-04-30'],
  ])('is the whole of %s', (month, from, to) => {
    expect(monthRange(month)).toEqual({ from, to });
  });
});

describe('monthLabel', () => {
  it('spells the month and the year out, whatever the time zone', () => {
    expect(monthLabel('2026-10')).toBe('October 2026');
    expect(monthLabel('2026-09')).toBe('September 2026');
    expect(monthLabel('2027-01')).toBe('January 2027');
  });
});

import { addMonths, endOfMonth, formatDate, localToday, pluralize } from './format';

describe('formatDate', () => {
  it('formats an ISO date without shifting the day', () => {
    expect(formatDate('2023-07-25')).toBe('25 Jul 2023');
  });

  it('returns what it cannot read, untouched', () => {
    expect(formatDate('')).toBe('');
    expect(formatDate('nonsense')).toBe('nonsense');
  });
});

describe('pluralize', () => {
  it('counts one, none and many', () => {
    expect(pluralize(1, 'project')).toBe('1 project');
    expect(pluralize(0, 'project')).toBe('0 projects');
    expect(pluralize(3, 'bill')).toBe('3 bills');
    expect(pluralize(2, 'category', 'categories')).toBe('2 categories');
  });
});

describe('localToday', () => {
  it('formats the local date with zero-padded parts', () => {
    expect(localToday(new Date(2026, 0, 5, 9, 30))).toBe('2026-01-05');
    expect(localToday(new Date(2026, 9, 15, 23, 59))).toBe('2026-10-15');
  });

  it('reads the local parts, never the UTC date toISOString would give', () => {
    // 00:30 local on 1 January in a time zone ahead of UTC is still 31 December in UTC.
    const aheadOfUtc = {
      getFullYear: () => 2026,
      getMonth: () => 0,
      getDate: () => 1,
      toISOString: () => '2025-12-31T23:30:00.000Z',
    } as unknown as Date;
    expect(localToday(aheadOfUtc)).toBe('2026-01-01');
  });
});

describe('addMonths', () => {
  it.each([
    ['2026-10-01', 3, '2027-01-01'],
    ['2026-10-15', 0, '2026-10-15'],
    ['2026-12-31', 1, '2027-01-31'],
    ['2026-10-15', 15, '2028-01-15'],
    ['2026-10-15', -3, '2026-07-15'],
    ['2026-01-15', -2, '2025-11-15'],
  ])('moves %s by %i months to %s', (from, months, to) => {
    expect(addMonths(from, months)).toBe(to);
  });

  it.each([
    ['2026-11-30', 3, '2027-02-28'],
    ['2027-11-30', 3, '2028-02-29'],
    ['2026-01-31', 1, '2026-02-28'],
    ['2026-03-31', -1, '2026-02-28'],
    ['2026-01-31', -2, '2025-11-30'],
    ['2028-02-29', 12, '2029-02-28'],
  ])('clamps a day past the end of the month: %s + %i is %s', (from, months, to) => {
    expect(addMonths(from, months)).toBe(to);
  });

  it.each(['', 'abc', '2026-02-30', '2026-13-01', '2026-00-10', '26-10-01', '2026-10-1', '0002-10-01', ' 2026-10-01'])(
    'gives nothing for %j',
    (text) => {
      expect(addMonths(text, 3)).toBe('');
    },
  );
});

describe('endOfMonth', () => {
  it.each([
    ['2026-09-01', '2026-09-30'],
    ['2026-09-30', '2026-09-30'],
    ['2026-02-10', '2026-02-28'],
    ['2028-02-10', '2028-02-29'],
    ['2026-12-05', '2026-12-31'],
    ['2026-01-31', '2026-01-31'],
  ])('ends the month of %s on %s', (from, to) => {
    expect(endOfMonth(from)).toBe(to);
  });

  it.each(['', 'nonsense', '2026-02-30', '2026-13-01', '0002-10-01'])('gives nothing for %j', (text) => {
    expect(endOfMonth(text)).toBe('');
  });
});

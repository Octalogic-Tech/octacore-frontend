import { formatCurrency, formatDate, localToday, pluralize } from './format';

describe('formatCurrency', () => {
  it('drops the cents on whole amounts', () => {
    expect(formatCurrency(5600)).toBe('$5,600');
    expect(formatCurrency(0)).toBe('$0');
  });

  it('keeps two decimals otherwise', () => {
    expect(formatCurrency(12.5)).toBe('$12.50');
  });
});

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

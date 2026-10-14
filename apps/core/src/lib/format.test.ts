import { formatCurrency, formatDate, pluralize, today } from './format';

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

describe('today', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('is the local date as YYYY-MM-DD', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2024, 0, 5, 12));
    expect(today()).toBe('2024-01-05');
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

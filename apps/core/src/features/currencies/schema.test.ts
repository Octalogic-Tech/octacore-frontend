import { currencyFormSchema, rateProblem } from './schema';

const valid = { code: 'EUR', name: 'Euro', symbol: '€', rate: '0.92' };

describe('rateProblem', () => {
  it.each(['88.25', '1', '0.000001', '1000000', ' 88.25 ', '0.92'])('accepts %j', (text) => {
    expect(rateProblem(text)).toBeNull();
  });

  it('asks for a rate when there is none', () => {
    expect(rateProblem('')).toBe('Enter a rate');
  });

  it.each(['1,5', '88.2512345', '-1', '1e3', 'lots', '.5', '8.', '٣'])('explains how to type %j', (text) => {
    expect(rateProblem(text)).toBe('Enter a rate like 88.25, with no commas and at most six decimals');
  });

  it('refuses zero and anything over a million', () => {
    expect(rateProblem('0')).toBe('The rate must be more than zero');
    expect(rateProblem('0.000000')).toBe('The rate must be more than zero');
    expect(rateProblem('1000000.01')).toBe('The rate is too large');
    expect(rateProblem('9999999')).toBe('The rate is too large');
  });
});

describe('the currency form', () => {
  it('accepts a complete form', () => {
    expect(currencyFormSchema.safeParse(valid).success).toBe(true);
  });

  it.each([
    ['code', { code: 'eur' }, 'Three capital letters, like EUR'],
    ['code', { code: 'EU' }, 'Three capital letters, like EUR'],
    ['name', { name: '  ' }, 'Name is required'],
    ['symbol', { symbol: '' }, 'Symbol is required'],
    ['symbol', { symbol: '€€€€€' }, 'Up to four characters'],
    ['rate', { rate: '' }, 'Enter a rate'],
  ])('refuses a bad %s', (field, override, message) => {
    const result = currencyFormSchema.safeParse({ ...valid, ...override });
    expect(result.success).toBe(false);
    const issues = result.success ? [] : result.error.issues;
    expect(issues.find((issue) => issue.path[0] === field)?.message).toBe(message);
  });
});

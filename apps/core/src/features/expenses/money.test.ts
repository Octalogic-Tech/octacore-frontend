import {
  amountProblem,
  convertToCents,
  formatMoney,
  formatRate,
  formatUsd,
  parseAmount,
  toAmountText,
} from './money';

describe('formatUsd', () => {
  it('shows cents as dollars, always with two decimals and grouping', () => {
    expect(formatUsd(150000)).toBe('$1,500.00');
    expect(formatUsd(5)).toBe('$0.05');
    expect(formatUsd(0)).toBe('$0.00');
    expect(formatUsd(10_000_000_000)).toBe('$100,000,000.00');
  });
});

describe('formatMoney', () => {
  it('groups rupees the Indian way', () => {
    expect(formatMoney(12345678, { currencyCode: 'INR', currencySymbol: '₹' })).toBe('₹1,23,456.78');
  });

  it('groups other currencies the US way', () => {
    expect(formatMoney(123456, { currencyCode: 'EUR', currencySymbol: '€' })).toBe('€1,234.56');
  });

  it('falls back to the symbol for a code the browser rejects', () => {
    expect(formatMoney(100, { currencyCode: 'US', currencySymbol: 'u' })).toBe('u1.00');
  });
});

describe('formatRate', () => {
  it('drops trailing zeros and keeps up to six decimals', () => {
    expect(formatRate(1)).toBe('1');
    expect(formatRate(88.25)).toBe('88.25');
    expect(formatRate(0.000001)).toBe('0.000001');
    expect(formatRate(1_000_000)).toBe('1000000');
  });
});

describe('toAmountText', () => {
  it('writes minor units as the text a field holds', () => {
    expect(toAmountText(720)).toBe('7.20');
    expect(toAmountText(5)).toBe('0.05');
    expect(toAmountText(100)).toBe('1.00');
    expect(toAmountText(10_000_000_000)).toBe('100000000.00');
  });
});

describe('amountProblem', () => {
  it.each(['7', '7.2', '7.20', ' 7.20 ', '0.05', '100000000.00'])('accepts %j', (text) => {
    expect(amountProblem(text)).toBeNull();
  });

  it('asks for an amount when there is none', () => {
    expect(amountProblem('')).toBe('Enter an amount');
    expect(amountProblem('   ')).toBe('Enter an amount');
  });

  it.each(['1,000', '7.999', '-5', '+5', '1e3', '.5', '7.', '٣', '$7', '7 20', 'lots', '12345678901'])(
    'explains how to type %j',
    (text) => {
      expect(amountProblem(text)).toBe('Enter an amount like 7.20, with no commas or signs');
    },
  );

  it('refuses zero', () => {
    expect(amountProblem('0')).toBe('The amount must be more than zero');
    expect(amountProblem('0.00')).toBe('The amount must be more than zero');
  });

  it('refuses more than the service takes', () => {
    expect(amountProblem('100000000.01')).toBe('The amount is too large');
  });
});

describe('parseAmount', () => {
  it('turns typed text into minor units without floating point', () => {
    expect(parseAmount('7.20')).toBe(720);
    expect(parseAmount(' 7 ')).toBe(700);
    expect(parseAmount('7.5')).toBe(750);
    expect(parseAmount('0.05')).toBe(5);
    expect(parseAmount('19.99')).toBe(1999);
    expect(parseAmount('100000000.00')).toBe(10_000_000_000);
  });
});

describe('convertToCents', () => {
  // The same rule as the service: round half up, on integers, so the preview matches what is stored.
  it.each([
    [882500, 88.25, 10000],
    [1, 2, 1],
    [3, 2, 2],
    [5, 3, 2],
    [1, 3, 0],
    [1, 88.25, 0],
    [100, 1, 100],
    [10_000_000_000, 0.000001, 10_000_000_000 * 1_000_000],
    [882500, 90, 9806],
  ])('converts %i units at %f per dollar to %i cents', (minor, rate, cents) => {
    expect(convertToCents(minor, rate)).toBe(cents);
  });

  it('gives nothing for a rate that is not positive', () => {
    expect(convertToCents(100, 0)).toBe(0);
  });
});

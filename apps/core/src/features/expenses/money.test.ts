import { formatUsd } from '@/lib/money';
import { convertToCents, formatMoney, formatRate } from './money';

describe('formatMoney', () => {
  it('groups rupees the Indian way', () => {
    expect(formatMoney(12345678, { currencyCode: 'INR', currencySymbol: '₹' })).toBe('₹1,23,456.78');
  });

  it('groups other currencies the US way', () => {
    expect(formatMoney(123456, { currencyCode: 'EUR', currencySymbol: '€' })).toBe('€1,234.56');
  });

  it('always shows two decimals, whatever the browser thinks the currency has: amounts are held in hundredths', () => {
    // Intl gives yen none and dinars three; the service holds every currency in minor units of two decimals.
    expect(formatMoney(150050, { currencyCode: 'JPY', currencySymbol: '¥' })).toBe('¥1,500.50');
    expect(formatMoney(1234, { currencyCode: 'KWD', currencySymbol: 'KD' })).toBe('KWD\u00a012.34');
  });

  it('reads US dollars the way formatUsd does, so an invoice in dollars looks as it always did', () => {
    const usd = { currencyCode: 'USD', currencySymbol: '$' };
    for (const cents of [0, 5, 100, 123456, 3_600_000, 10_000_000_000]) expect(formatMoney(cents, usd)).toBe(formatUsd(cents));
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

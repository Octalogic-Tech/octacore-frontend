import { formatCountryRate, formatTaxRate } from './format';

describe('formatCountryRate', () => {
  it('shows a rate without trailing zeros, and 1 for US dollars', () => {
    expect(formatCountryRate(88.25)).toBe('88.25');
    expect(formatCountryRate(0.920001)).toBe('0.920001');
    expect(formatCountryRate(1)).toBe('1');
  });

  it('shows a dash while the country has no rate', () => {
    expect(formatCountryRate(null)).toBe('—');
  });
});

describe('formatTaxRate', () => {
  it('shows a percentage without trailing zeros', () => {
    expect(formatTaxRate(18)).toBe('18%');
    expect(formatTaxRate(7.5)).toBe('7.5%');
    expect(formatTaxRate(7.25)).toBe('7.25%');
    expect(formatTaxRate(0)).toBe('0%');
  });
});

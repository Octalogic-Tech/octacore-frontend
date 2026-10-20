import { MAX_CENTS, amountProblem, formatInr, formatUsd, parseAmount, toAmountText } from './money';

describe('MAX_CENTS', () => {
  it('is one hundred million dollars', () => {
    expect(MAX_CENTS).toBe(10_000_000_000);
  });
});

describe('formatUsd', () => {
  it('shows cents as dollars, always with two decimals and grouping', () => {
    expect(formatUsd(0)).toBe('$0.00');
    expect(formatUsd(5)).toBe('$0.05');
    expect(formatUsd(123_456)).toBe('$1,234.56');
    expect(formatUsd(150_000)).toBe('$1,500.00');
    expect(formatUsd(4_800_000)).toBe('$48,000.00');
    expect(formatUsd(10_000_000_000)).toBe('$100,000,000.00');
  });
});

describe('formatInr', () => {
  it('shows paise as rupees with Indian grouping, always with two decimals', () => {
    expect(formatInr(12_345_678)).toBe('₹1,23,456.78');
    expect(formatInr(0)).toBe('₹0.00');
    expect(formatInr(5)).toBe('₹0.05');
    expect(formatInr(8_500_000)).toBe('₹85,000.00');
    expect(formatInr(20_000_000)).toBe('₹2,00,000.00');
    expect(formatInr(10_000_000_000)).toBe('₹10,00,00,000.00');
  });
});

describe('toAmountText', () => {
  it('writes cents as the text a field holds', () => {
    expect(toAmountText(15_000)).toBe('150.00');
    expect(toAmountText(560_075)).toBe('5600.75');
    expect(toAmountText(720)).toBe('7.20');
    expect(toAmountText(5)).toBe('0.05');
    expect(toAmountText(100)).toBe('1.00');
    expect(toAmountText(10_000_000_000)).toBe('100000000.00');
  });
});

describe('amountProblem', () => {
  it.each(['7', '7.2', '7.20', ' 7.20 ', '0.05', '100000000', '100000000.00'])('accepts %j', (text) => {
    expect(amountProblem(text)).toBeNull();
  });

  it('asks for an amount when there is none', () => {
    expect(amountProblem('')).toBe('Enter an amount');
    expect(amountProblem('   ')).toBe('Enter an amount');
  });

  it.each([
    '12.505',
    '1,200',
    '$5',
    '-1',
    '.5',
    '5.',
    '1,000',
    '7.999',
    '-5',
    '+5',
    '1e3',
    '٣',
    '7 20',
    'lots',
    '12345678901',
  ])('explains how to type %j', (text) => {
    expect(amountProblem(text)).toBe('Enter an amount like 7.20, with no commas or signs');
  });

  it('refuses zero unless zero is allowed', () => {
    expect(amountProblem('0')).toBe('The amount must be more than zero');
    expect(amountProblem('0.00')).toBe('The amount must be more than zero');
    expect(amountProblem('0', { allowZero: false })).toBe('The amount must be more than zero');
    expect(amountProblem('0', { allowZero: true })).toBeNull();
    expect(amountProblem('0.00', { allowZero: true })).toBeNull();
  });

  it('still refuses what is not an amount when zero is allowed', () => {
    expect(amountProblem('', { allowZero: true })).toBe('Enter an amount');
    expect(amountProblem('-0', { allowZero: true })).toBe('Enter an amount like 7.20, with no commas or signs');
    expect(amountProblem('100000000.01', { allowZero: true })).toBe('The amount is too large');
  });

  it('refuses more than the service takes', () => {
    expect(amountProblem('100000000.01')).toBe('The amount is too large');
  });
});

describe('parseAmount', () => {
  it('turns typed text into cents by its digits', () => {
    expect(parseAmount('12.1')).toBe(1210);
    expect(parseAmount('12.10')).toBe(1210);
    expect(parseAmount('12')).toBe(1200);
    expect(parseAmount('0')).toBe(0);
    expect(parseAmount('0.01')).toBe(1);
    expect(parseAmount('100000000')).toBe(10_000_000_000);
    expect(parseAmount('100000000.00')).toBe(10_000_000_000);
    expect(parseAmount(' 7 ')).toBe(700);
    expect(parseAmount('7.5')).toBe(750);
    expect(parseAmount('19.99')).toBe(1999);
  });

  it('gets the decimals that are wrong in floating point right', () => {
    // 0.07 * 100 is 7.000000000000001, 1.15 * 100 is 114.99999999999999 and 4.35 * 100 is 434.99999999999994.
    expect(parseAmount('0.07')).toBe(7);
    expect(parseAmount('1.15')).toBe(115);
    expect(parseAmount('4.35')).toBe(435);
  });
});

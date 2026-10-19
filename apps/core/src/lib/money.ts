/**
 * Money on the wire is whole US cents. This is the one place that turns cents into text, and typed dollars back into
 * cents, so nothing else in the app does arithmetic on dollars.
 */

/** The most one amount can be, in cents ($100,000,000.00). The service refuses more. */
export const MAX_CENTS = 10_000_000_000;
const AMOUNT_TEXT = /^(\d{1,10})(?:\.(\d{1,2}))?$/;

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

/** US cents as `$1,234.56`: always two decimals, because it is an amount of money and not a count. */
export function formatUsd(cents: number): string {
  return usd.format(cents / 100);
}

/** Cents as the text a field holds: 720 is `7.20`. */
export function toAmountText(cents: number): string {
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`;
}

/**
 * What is wrong with typed amount text, or null. A comma, a sign or a third decimal is told, not dropped. Zero is
 * refused unless `allowZero` says it is a fair amount (a rate or a salary may be nothing).
 */
export function amountProblem(text: string, options: { allowZero?: boolean } = {}): string | null {
  const value = text.trim();
  if (value === '') return 'Enter an amount';
  const match = AMOUNT_TEXT.exec(value);
  if (!match) return 'Enter an amount like 7.20, with no commas or signs';
  const cents = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
  if (cents < 1 && !options.allowZero) return 'The amount must be more than zero';
  if (cents > MAX_CENTS) return 'The amount is too large';
  return null;
}

/** Typed text as cents, on the digits and not on a float. Call it once `amountProblem` has said null. */
export function parseAmount(text: string): number {
  const [whole, fraction = ''] = text.trim().split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}

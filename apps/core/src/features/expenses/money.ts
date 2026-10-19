/**
 * Money on the wire is whole minor units (cents, paise). This is the one place that turns them into text, and text
 * back into them, so nothing else in the app does arithmetic on dollars.
 */

/** The most one amount can be, in minor units. The service refuses more. */
const MAX_MINOR = 10_000_000_000;
const AMOUNT_TEXT = /^(\d{1,10})(?:\.(\d{1,2}))?$/;
const RATE_SCALE = 1_000_000n;

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

/** US cents as `$1,234.56`: always two decimals, because it is an amount of money and not a count. */
export function formatUsd(cents: number): string {
  return usd.format(cents / 100);
}

/** An amount in its own currency with its symbol. Rupees are grouped the Indian way (₹1,23,456.78). */
export function formatMoney(minor: number, currency: { currencyCode: string; currencySymbol: string }): string {
  try {
    return new Intl.NumberFormat(currency.currencyCode === 'INR' ? 'en-IN' : 'en-US', {
      style: 'currency',
      currency: currency.currencyCode,
    }).format(minor / 100);
  } catch {
    // A code the browser does not recognise: the symbol and plain digits.
    return `${currency.currencySymbol}${toAmountText(minor)}`;
  }
}

/** A rate as people write it: no trailing zeros, up to six decimals (`88.25`, `1`). */
export function formatRate(rate: number): string {
  return String(Number(rate.toFixed(6)));
}

/** Minor units as the text a field holds: 720 is `7.20`. */
export function toAmountText(minor: number): string {
  return `${Math.floor(minor / 100)}.${String(minor % 100).padStart(2, '0')}`;
}

/** What is wrong with typed amount text, or null. A comma, a sign or a third decimal is told, not dropped. */
export function amountProblem(text: string): string | null {
  const value = text.trim();
  if (value === '') return 'Enter an amount';
  const match = AMOUNT_TEXT.exec(value);
  if (!match) return 'Enter an amount like 7.20, with no commas or signs';
  const minor = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
  if (minor < 1) return 'The amount must be more than zero';
  if (minor > MAX_MINOR) return 'The amount is too large';
  return null;
}

/** Typed text as minor units, on the digits and not on a float. Call it once `amountProblem` has said null. */
export function parseAmount(text: string): number {
  const [whole, fraction = ''] = text.trim().split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}

/**
 * The US cents a charge of `minor` units converts to at `rate` units per dollar: the service's own rule (round half
 * up), done on integers, so a preview matches the stored figure to the cent.
 */
export function convertToCents(minor: number, rate: number): number {
  const scaled = BigInt(Math.round(rate * 1_000_000));
  if (scaled <= 0n) return 0;
  const numerator = BigInt(minor) * RATE_SCALE;
  return Number((2n * numerator + scaled) / (2n * scaled));
}

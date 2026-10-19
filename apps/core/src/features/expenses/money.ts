/**
 * Amounts in other currencies and the exchange rates between them. They are whole minor units (paise, euro cents),
 * converted to US cents by the service's own rule. Money in US cents is formatted and read in `@/lib/money`.
 */

import { toAmountText } from '@/lib/money';

const RATE_SCALE = 1_000_000n;

/** An amount in its own currency with its symbol. Rupees are grouped the Indian way (₹1,23,456.78). */
export function formatMoney(minor: number, currency: { code: string; symbol: string }): string {
  try {
    return new Intl.NumberFormat(currency.code === 'INR' ? 'en-IN' : 'en-US', {
      style: 'currency',
      currency: currency.code,
    }).format(minor / 100);
  } catch {
    // A code the browser does not recognise: the symbol and plain digits.
    return `${currency.symbol}${toAmountText(minor)}`;
  }
}

/** A rate as people write it: no trailing zeros, up to six decimals (`88.25`, `1`). */
export function formatRate(rate: number): string {
  return String(Number(rate.toFixed(6)));
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

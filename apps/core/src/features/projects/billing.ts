import { PRIMARY_CURRENCY, type Country } from '@/features/countries/schema';
import { formatRate } from '@/features/expenses/money';
import type { BillingSource, BillingTerms } from './schema';

/** A tax rate as people write it: no trailing zeros, no float noise (`18`, `7.25`). */
const formatPercent = (percent: number) => String(Number(percent.toFixed(2)));

/** What a US dollar is worth in the currency, as `₹88.25 per $1`. The rate keeps up to six decimals. */
export function rateText(currency: { currencySymbol: string }, exchangeRate: number): string {
  return `${currency.currencySymbol}${formatRate(exchangeRate)} per $1`;
}

/**
 * The terms an invoice is billed on, in one phrase: `INR · ₹88.25 per $1 · tax 18%`. The rate is left out for US
 * dollars and the tax when there is none. The rate keeps up to six decimals, so a figure can be checked against the
 * dollars the invoice form shows.
 */
export function billingTermsText(terms: BillingTerms): string {
  const parts: string[] = [terms.currencyCode];
  if (terms.currencyCode !== PRIMARY_CURRENCY) {
    parts.push(terms.exchangeRate === null ? 'no exchange rate yet' : rateText(terms, terms.exchangeRate));
  }
  if (terms.taxRate > 0) parts.push(`tax ${formatPercent(terms.taxRate)}%`);
  return parts.join(' · ');
}

/** Only the project's own country can lack a rate, and then no invoice can be created. */
export const NO_RATE_SENTENCE =
  'The billing country has no exchange rate yet, so no invoice can be created. Sync the rates on the Countries page, or choose another country.';

/** Said under the Billing country select while it is None: the client's country decides. */
export const CLIENT_COUNTRY_SENTENCE =
  'With no billing country, new invoices are billed in the client’s country, or in US dollars when it is not active or has no rate.';

/** What a new invoice of a saved project is billed in, from the project's `billing`. */
export function billingSentence(billing: BillingTerms & { source: BillingSource }): string {
  if (billing.exchangeRate === null) return NO_RATE_SENTENCE;
  if (billing.source === 'default') {
    return 'New invoices are billed in US dollars, the default: no billing country is chosen, and the client’s country is not active with a rate.';
  }
  const origin = billing.source === 'client' ? ', from the client’s country' : '';
  return `New invoices are billed in ${billingTermsText(billing)}${origin}.`;
}

/** The same for a country picked in the form and not saved yet: its own terms, as the Countries page holds them. */
export function chosenCountrySentence(country: Country): string {
  if (country.rate === null) return NO_RATE_SENTENCE;
  const terms = { ...country, exchangeRate: country.rate };
  return `Once saved, new invoices are billed in ${billingTermsText(terms)}.`;
}

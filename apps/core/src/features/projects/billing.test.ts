import { countryRows } from '@/test/fixtures/countries';
import { countriesSchema } from '@/features/countries/schema';
import {
  billingSentence,
  billingTermsText,
  chosenCountrySentence,
  CLIENT_COUNTRY_SENTENCE,
  NO_RATE_SENTENCE,
} from './billing';

const countries = countriesSchema.parse(countryRows);
const country = (iso: string) => {
  const found = countries.find((row) => row.iso === iso);
  if (!found) throw new Error(`no fixture country ${iso}`);
  return found;
};

const terms = (over: Partial<Parameters<typeof billingTermsText>[0]> = {}) => ({
  currencyCode: 'INR',
  currencySymbol: '₹',
  exchangeRate: 88.25,
  taxRate: 18,
  ...over,
});

describe('billingTermsText', () => {
  it('names the currency, what a dollar is worth in it, and the tax', () => {
    expect(billingTermsText(terms())).toBe('INR · ₹88.25 per $1 · tax 18%');
    expect(billingTermsText(terms({ currencyCode: 'EUR', currencySymbol: '€', exchangeRate: 0.92, taxRate: 19 }))).toBe(
      'EUR · €0.92 per $1 · tax 19%',
    );
  });

  it('keeps every decimal of the rate, up to six, so the figure can be checked against the dollars shown', () => {
    expect(billingTermsText(terms({ exchangeRate: 94.816387 }))).toBe('INR · ₹94.816387 per $1 · tax 18%');
    expect(billingTermsText(terms({ exchangeRate: 88 }))).toBe('INR · ₹88 per $1 · tax 18%');
  });

  it('leaves out the tax when there is none, and the rate for dollars', () => {
    expect(billingTermsText(terms({ taxRate: 0 }))).toBe('INR · ₹88.25 per $1');
    expect(
      billingTermsText({ currencyCode: 'USD', currencySymbol: '$', exchangeRate: 1, taxRate: 0 }),
    ).toBe('USD');
    expect(
      billingTermsText({ currencyCode: 'USD', currencySymbol: '$', exchangeRate: 1, taxRate: 5 }),
    ).toBe('USD · tax 5%');
  });

  it('shows a tax rate with its decimals and none of the float noise', () => {
    expect(billingTermsText(terms({ taxRate: 7.25 }))).toContain('tax 7.25%');
    expect(billingTermsText(terms({ taxRate: 0.1 + 0.2 }))).toContain('tax 0.3%');
  });

  it('says so when the country has no rate yet', () => {
    expect(billingTermsText(terms({ exchangeRate: null }))).toBe('INR · no exchange rate yet · tax 18%');
  });
});

describe('billingSentence', () => {
  const billing = (over = {}) => ({ ...terms(), source: 'client' as const, ...over });

  it('says what a new invoice is billed in, and that the client’s country decided it', () => {
    expect(billingSentence(billing())).toBe(
      'New invoices are billed in INR · ₹88.25 per $1 · tax 18%, from the client’s country.',
    );
  });

  it('says it for the project’s own country without a source', () => {
    expect(billingSentence(billing({ source: 'project' }))).toBe('New invoices are billed in INR · ₹88.25 per $1 · tax 18%.');
  });

  it('says so when it is the default: dollars, because no country applies', () => {
    expect(
      billingSentence({ currencyCode: 'USD', currencySymbol: '$', exchangeRate: 1, taxRate: 0, source: 'default' }),
    ).toBe(
      'New invoices are billed in US dollars, the default: no billing country is chosen, and the client’s country is not active with a rate.',
    );
  });

  it('warns that nothing can be invoiced while the project’s own country has no rate', () => {
    expect(billingSentence(billing({ source: 'project', exchangeRate: null }))).toBe(NO_RATE_SENTENCE);
  });
});

describe('chosenCountrySentence', () => {
  it('says what a new invoice is billed in once the picked country is saved', () => {
    expect(chosenCountrySentence(country('DE'))).toBe('Once saved, new invoices are billed in EUR · €0.92 per $1 · tax 19%.');
    expect(chosenCountrySentence(country('US'))).toBe('Once saved, new invoices are billed in USD.');
  });

  it('warns about a country with no rate', () => {
    expect(chosenCountrySentence(country('JP'))).toBe(NO_RATE_SENTENCE);
  });
});

describe('the sentence for None', () => {
  it('says the client’s country decides', () => {
    expect(CLIENT_COUNTRY_SENTENCE).toBe(
      'With no billing country, new invoices are billed in the client’s country, or in US dollars when it is not active or has no rate.',
    );
  });
});

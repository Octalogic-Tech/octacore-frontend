import { z } from 'zod';
import { formatRate } from '@/features/expenses/money';

/** The currency every amount is stored in. A country that uses it always has a rate of 1. */
export const PRIMARY_CURRENCY = 'USD';

// The service also sends `name` (the legacy UPPERCASE form), `status` and the created, updated and deleted dates;
// unknown keys are dropped, so they cannot break the page.
//
// Countries seeded before migration 0014 spell "no ISO3 code" as the text NULL (13 of them). The migration turns it
// into an empty string; it is turned into one here too, so the sentinel never reaches the screen or the search.
const noneIfNullText = (code: string) =>
  code.trim().toUpperCase() === 'NULL' ? '' : code;

export const countrySchema = z.object({
  id: z.number().int(),
  iso: z.string(),
  iso3: z.string().transform(noneIfNullText),
  nicename: z.string(),
  numcode: z.number().int(),
  phonecode: z.number().int(),
  currencyCode: z.string(),
  currencyName: z.string(),
  currencySymbol: z.string(),
  // Units of the currency per 1 US dollar. Null until the owner types one or a sync fills it.
  rate: z.number().nullable(),
  // A percentage, 0 to 100.
  taxRate: z.number(),
  // An active country is the one offered wherever a country is picked, and the one a sync updates.
  active: z.boolean(),
});

export const countriesSchema = z.array(countrySchema);

export type Country = z.infer<typeof countrySchema>;

/** What `POST /countries/sync-rates` answers. */
export const syncResultSchema = z.object({
  // The day of the rates, `YYYY-MM-DD`.
  date: z.string(),
  updatedCountries: z.number().int(),
  updatedCurrencies: z.array(z.string()),
  // Currencies of active countries that the feed has no usable rate for.
  missingCurrencies: z.array(z.string()),
});

export type SyncResult = z.infer<typeof syncResultSchema>;

// ---- The country form. Numbers are text until submit, so a comma or a stray letter can be told what is wrong.

const RATE_TEXT = /^(\d{1,7})(?:\.(\d{1,6}))?$/;
const MAX_RATE = 1_000_000;

/** What is wrong with typed rate text, or null. A comma or a seventh decimal is told, not dropped. */
export function rateProblem(text: string): string | null {
  const value = text.trim();
  if (value === '') return 'Enter a rate';
  if (!RATE_TEXT.test(value))
    return 'Enter a rate like 88.25, with no commas and at most six decimals';
  const rate = Number(value);
  if (rate <= 0) return 'The rate must be more than zero';
  if (rate > MAX_RATE) return 'The rate is too large';
  return null;
}

const TAX_RATE_TEXT = /^(\d{1,3})(?:\.(\d{1,2}))?$/;

/** What is wrong with typed tax rate text (a percentage from 0 to 100), or null. */
export function taxRateProblem(text: string): string | null {
  const value = text.trim();
  if (value === '') return 'Enter a tax rate, or 0 for none';
  if (!TAX_RATE_TEXT.test(value))
    return 'Enter a tax rate like 18 or 7.25, with no commas and at most two decimals';
  if (Number(value) > 100) return 'The tax rate cannot be more than 100';
  return null;
}

/** A code typed as digits, where blank means the country has none (the service stores 0). */
function codeProblem(text: string, max: number, label: string): string | null {
  const value = text.trim();
  if (value === '') return null;
  if (!/^\d{1,4}$/.test(value) || Number(value) > max)
    return `${label} must be a whole number from 0 to ${max}`;
  return null;
}

export const countryFormSchema = z
  .object({
    nicename: z.string().trim().min(1, 'Name is required'),
    // The inputs write capitals as they are typed, so a lower-case code only gets here by being pasted.
    iso: z
      .string()
      .trim()
      .regex(/^[A-Z]{2}$/, 'Two capital letters, like IN'),
    iso3: z
      .string()
      .trim()
      .regex(
        /^(?:[A-Z]{3})?$/,
        'Three capital letters, like IND, or leave it empty'
      ),
    numcode: z.string(),
    phonecode: z.string(),
    currencyCode: z
      .string()
      .trim()
      .regex(/^[A-Z]{3}$/, 'Three capital letters, like EUR'),
    currencyName: z.string().trim().min(1, 'Currency name is required'),
    currencySymbol: z
      .string()
      .trim()
      .min(1, 'Symbol is required')
      .max(4, 'Up to four characters'),
    rate: z.string(),
    taxRate: z.string(),
    active: z.boolean(),
  })
  .superRefine((values, context) => {
    const issue = (path: string, message: string | null) => {
      if (message) context.addIssue({ code: 'custom', path: [path], message });
    };
    issue('numcode', codeProblem(values.numcode, 999, 'The numeric code'));
    issue('phonecode', codeProblem(values.phonecode, 9999, 'The calling code'));
    // The rate is optional: a sync can fill it. US dollars are fixed at 1 and never typed.
    if (
      values.currencyCode.trim() !== PRIMARY_CURRENCY &&
      values.rate.trim() !== ''
    ) {
      issue('rate', rateProblem(values.rate));
    }
    issue('taxRate', taxRateProblem(values.taxRate));
  });

export type CountryFormValues = z.infer<typeof countryFormSchema>;

export const emptyCountryForm: CountryFormValues = {
  nicename: '',
  iso: '',
  iso3: '',
  numcode: '',
  phonecode: '',
  currencyCode: '',
  currencyName: '',
  currencySymbol: '',
  rate: '',
  taxRate: '0',
  active: false,
};

/** A code as the field holds it: the service's 0 for "none" is an empty field. */
const codeText = (code: number) => (code > 0 ? String(code) : '');

/** The form for a new country, or for an edit of one. */
export function toCountryFormValues(
  country: Country | undefined
): CountryFormValues {
  if (!country) return emptyCountryForm;
  return {
    nicename: country.nicename,
    iso: country.iso,
    iso3: country.iso3,
    numcode: codeText(country.numcode),
    phonecode: codeText(country.phonecode),
    currencyCode: country.currencyCode,
    currencyName: country.currencyName,
    currencySymbol: country.currencySymbol,
    rate: country.rate === null ? '' : formatRate(country.rate),
    taxRate: String(Number(country.taxRate.toFixed(2))),
    active: country.active,
  };
}

export interface CountryBody {
  iso: string;
  nicename: string;
  iso3: string;
  numcode: number;
  phonecode: number;
  currencyCode: string;
  currencyName: string;
  currencySymbol: string;
  /** Absent on an edit that leaves the rate and the currency alone. */
  rate?: number | null;
  taxRate: number;
  active: boolean;
}

/**
 * The body to send. A new country is sent whole. An edit (`original` is the form as it was filled) is whole too, except
 * that the rate is left out unless the rate field or the currency changed: a sync can set a newer rate than the one the
 * form was filled with, and saving a tax rate must not put the old one back. When it is sent, `rate: null` is how an
 * emptied field clears it, and a US dollar country is sent with rate 1 whatever the field holds.
 */
export function toCountryBody(
  values: CountryFormValues,
  original?: CountryFormValues
): CountryBody {
  const rate = values.rate.trim();
  const currencyCode = values.currencyCode.trim();
  const isDollar = currencyCode === PRIMARY_CURRENCY;
  const body: CountryBody = {
    iso: values.iso.trim(),
    nicename: values.nicename.trim(),
    iso3: values.iso3.trim(),
    numcode: Number(values.numcode.trim() || '0'),
    phonecode: Number(values.phonecode.trim() || '0'),
    currencyCode,
    currencyName: values.currencyName.trim(),
    currencySymbol: values.currencySymbol.trim(),
    taxRate: Number(values.taxRate.trim()),
    active: values.active,
  };
  const untouched =
    original &&
    rate === original.rate.trim() &&
    currencyCode === original.currencyCode.trim();
  if (!untouched) body.rate = isDollar ? 1 : rate === '' ? null : Number(rate);
  return body;
}

import { PRIMARY_CURRENCY, type Country } from './schema';

export interface CountryOption {
  id: number;
  label: string;
}

/** The record's own country, as the service embeds it in a client, an expense or a recurring expense. */
export interface CountryRef {
  id: number;
  name: string;
  currencyCode?: string;
}

interface PickerOptions {
  /** An expense converts at the country's rate, so a country with none cannot be chosen for one. */
  needsRate?: boolean;
  /** Label an option `Germany · EUR` instead of `Germany`. */
  withCurrency?: boolean;
  /** Always offered, even when switched off or not in `countries`, so an edit cannot blank the select. */
  current?: CountryRef;
}

/**
 * What a country picker offers, A to Z: the active countries (with a rate where one is needed) plus the record's own
 * country. Shared by the client form and the expense and recurring expense forms.
 */
export function countryPickerOptions(
  countries: readonly Country[],
  { needsRate = false, withCurrency = false, current }: PickerOptions = {},
): CountryOption[] {
  const label = (name: string, code?: string) => (withCurrency && code ? `${name} · ${code}` : name);
  const options = countries
    .filter((country) => country.id === current?.id || (country.active && (!needsRate || country.rate !== null)))
    .map((country) => ({ id: country.id, label: label(country.nicename, country.currencyCode) }));
  if (current && !options.some((option) => option.id === current.id)) {
    options.push({ id: current.id, label: label(current.name, current.currencyCode) });
  }
  return options.sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * The country a dollar amount is entered under: the United States while it is active, otherwise the first active
 * country that uses US dollars. The service keeps at least one, so this is undefined only while the list loads.
 */
export function dollarCountry(countries: readonly Country[]): Country | undefined {
  const dollars = countries.filter((country) => country.active && country.currencyCode === PRIMARY_CURRENCY);
  return dollars.find((country) => country.iso === 'US') ?? dollars[0];
}

/**
 * India's rate: the rupees to one US dollar that a salary in paise is counted at. The service's own lookup: the
 * lowest-id country whose currency is INR, that is active and has a rate. Null when there is none, and then nothing
 * that needs rupees turned into dollars can be worked out.
 */
export function indiaRate(countries: readonly Country[]): number | null {
  const india = countries
    .filter((country) => country.currencyCode === 'INR' && country.active && country.rate !== null)
    .sort((a, b) => a.id - b.id)[0];
  return india?.rate ?? null;
}

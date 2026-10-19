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

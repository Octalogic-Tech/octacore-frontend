import { useMemo } from 'react';
import type { UseFormRegisterReturn } from 'react-hook-form';
import { Field, fieldA11y } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { countryPickerOptions, type CountryRef } from '@/features/countries/options';
import { PRIMARY_CURRENCY, type Country } from '@/features/countries/schema';
import { amountProblem, formatUsd, parseAmount } from '@/lib/money';
import { convertToCents, formatRate } from './money';

interface AmountFieldProps {
  /** Prefix of the two control ids: `expense` gives `expense-country` and `expense-amount`. */
  idPrefix: string;
  /** Every country; the picker offers the active ones that have a rate. */
  countries: readonly Country[];
  /** The record's own country, kept in the list while the list is loading or no longer offers it. */
  current?: CountryRef;
  countryProps: UseFormRegisterReturn;
  amountProps: UseFormRegisterReturn;
  /** The two values as typed, for the preview in dollars. */
  countryId: string;
  amount: string;
  countryError?: string;
  amountError?: string;
  countriesFailed?: boolean;
}

/** What to tell the person under the amount: how to type it, and for another currency what it comes to in dollars. */
function amountHint(country: Country | undefined, amount: string): string {
  if (!country) return 'Choose a country, then type the amount, like 7.20.';
  const code = country.currencyCode;
  if (code === PRIMARY_CURRENCY) return 'In US dollars, like 7.20.';
  // Only the record's own country can lack a rate: the picker offers no other.
  if (country.rate === null) return `${code} has no exchange rate yet. Sync the rates on the Countries page.`;
  if (amountProblem(amount) !== null) return `In ${code}, like 7.20. It is converted to US dollars when you save.`;
  const cents = convertToCents(parseAmount(amount), country.rate);
  const rate = `${formatRate(country.rate)} ${code} per $1`;
  return cents < 1 ? `Less than one US cent at ${rate}.` : `About ${formatUsd(cents)} at ${rate}.`;
}

/** The country (and so the currency) and the amount of a charge, side by side: one control in two fields. */
export function AmountField({
  idPrefix,
  countries,
  current,
  countryProps,
  amountProps,
  countryId,
  amount,
  countryError,
  amountError,
  countriesFailed,
}: AmountFieldProps) {
  const country = countries.find((row) => String(row.id) === countryId);
  const options = useMemo(
    () => countryPickerOptions(countries, { needsRate: true, withCurrency: true, current }),
    [countries, current],
  );
  return (
    <div className="grid gap-6 sm:grid-cols-[minmax(0,16rem)_minmax(0,1fr)]">
      <Field
        label="Country"
        htmlFor={`${idPrefix}-country`}
        error={countryError}
        hint={countriesFailed ? 'Countries could not be loaded.' : undefined}
      >
        <Select {...fieldA11y(`${idPrefix}-country`, countryError)} {...countryProps}>
          <option value="">Choose…</option>
          {options.map((option) => (
            <option key={option.id} value={String(option.id)}>
              {option.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Amount" htmlFor={`${idPrefix}-amount`} error={amountError} hint={amountHint(country, amount)}>
        <Input {...fieldA11y(`${idPrefix}-amount`, amountError)} {...amountProps} inputMode="decimal" autoComplete="off" />
      </Field>
    </div>
  );
}

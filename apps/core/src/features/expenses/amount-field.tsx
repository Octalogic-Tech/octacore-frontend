import { useMemo } from 'react';
import type { UseFormRegisterReturn } from 'react-hook-form';
import { Field, fieldA11y } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { PRIMARY_CURRENCY, type CurrencyRow } from '@/features/currencies/schema';
import { amountProblem, convertToCents, formatRate, formatUsd, parseAmount } from './money';
import { withCurrent } from './options';

interface AmountFieldProps {
  /** Prefix of the two control ids: `expense` gives `expense-currency` and `expense-amount`. */
  idPrefix: string;
  /** The live currencies. */
  currencies: readonly CurrencyRow[];
  /** The record's own currency, kept in the list while the list is loading or no longer holds it. */
  current?: { id: number; code: string };
  currencyProps: UseFormRegisterReturn;
  amountProps: UseFormRegisterReturn;
  /** The two values as typed, for the preview in dollars. */
  currencyId: string;
  amount: string;
  currencyError?: string;
  amountError?: string;
  currenciesFailed?: boolean;
}

/** What to tell the person under the amount: how to type it, and for another currency what it comes to in dollars. */
function amountHint(currency: CurrencyRow | undefined, amount: string): string {
  if (!currency) return 'Choose a currency, then type the amount, like 7.20.';
  if (currency.code === PRIMARY_CURRENCY) return 'In US dollars, like 7.20.';
  if (amountProblem(amount) !== null) {
    return `In ${currency.code}, like 7.20. It is converted to US dollars when you save.`;
  }
  const cents = convertToCents(parseAmount(amount), currency.rate);
  const rate = `${formatRate(currency.rate)} ${currency.code} per $1`;
  return cents < 1 ? `Less than one US cent at ${rate}.` : `About ${formatUsd(cents)} at ${rate}.`;
}

/** The currency and the amount of a charge, side by side: one control in two fields. */
export function AmountField({
  idPrefix,
  currencies,
  current,
  currencyProps,
  amountProps,
  currencyId,
  amount,
  currencyError,
  amountError,
  currenciesFailed,
}: AmountFieldProps) {
  const currency = currencies.find((row) => String(row.id) === currencyId);
  const options = useMemo(
    () =>
      withCurrent(
        currencies.map((row) => ({ id: row.id, label: `${row.code} · ${row.name}` })),
        current && { id: current.id, label: current.code },
      ),
    [currencies, current],
  );
  return (
    <div className="grid gap-6 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)]">
      <Field
        label="Currency"
        htmlFor={`${idPrefix}-currency`}
        error={currencyError}
        hint={currenciesFailed ? 'Currencies could not be loaded.' : undefined}
      >
        <Select {...fieldA11y(`${idPrefix}-currency`, currencyError)} {...currencyProps}>
          <option value="">Choose…</option>
          {options.map((option) => (
            <option key={option.id} value={String(option.id)}>
              {option.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Amount" htmlFor={`${idPrefix}-amount`} error={amountError} hint={amountHint(currency, amount)}>
        <Input {...fieldA11y(`${idPrefix}-amount`, amountError)} {...amountProps} inputMode="decimal" autoComplete="off" />
      </Field>
    </div>
  );
}

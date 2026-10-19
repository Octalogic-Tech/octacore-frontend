import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState, type ChangeEvent } from 'react';
import {
  Controller,
  useForm,
  type UseFormRegisterReturn,
} from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { ChoiceChip } from '@/components/ui/choice-chip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field, fieldA11y } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Arm } from '@/components/ui/marks';
import { serviceMessage } from '@/lib/core-api';
import { useSaveCountry } from './api';
import {
  PRIMARY_CURRENCY,
  countryFormSchema,
  emptyCountryForm,
  toCountryBody,
  toCountryFormValues,
  type Country,
  type CountryFormValues,
} from './schema';

interface CountryFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present when editing, absent when adding. */
  country?: Country;
}

/** A text input that writes capitals as they are typed, for the ISO and currency codes. */
function capitals(
  field: UseFormRegisterReturn,
  then?: (value: string) => void
) {
  return {
    ...field,
    onChange: (event: ChangeEvent<HTMLInputElement>) => {
      event.target.value = event.target.value.toUpperCase();
      then?.(event.target.value);
      return field.onChange(event);
    },
  };
}

export function CountryFormDialog({
  open,
  onOpenChange,
  country,
}: CountryFormDialogProps) {
  const save = useSaveCountry();
  const [failure, setFailure] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    watch,
    getValues,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<CountryFormValues>({
    resolver: zodResolver(countryFormSchema),
    defaultValues: emptyCountryForm,
  });

  useEffect(() => {
    if (open) {
      reset(toCountryFormValues(country));
      setFailure(null);
    }
  }, [open, country, reset]);

  const isDollar = watch('currencyCode') === PRIMARY_CURRENCY;

  /** US dollars are always 1; leaving them for another currency empties the rate, which belonged to the dollar. */
  function currencyCodeTyped(next: string) {
    const wasDollar = getValues('currencyCode') === PRIMARY_CURRENCY;
    if (next === PRIMARY_CURRENCY) setValue('rate', '1');
    else if (wasDollar) setValue('rate', '');
  }

  const submit = handleSubmit(async (values) => {
    setFailure(null);
    try {
      await save.mutateAsync({
        id: country?.id,
        body: toCountryBody(values, country && toCountryFormValues(country)),
      });
    } catch (error) {
      // A duplicate ISO code and a last-dollar-country refusal are a 409, a rate on a dollar country a 422, each with
      // a message written for people.
      setFailure(serviceMessage(error) ?? 'That did not save. Try again.');
      return;
    }
    onOpenChange(false);
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Not while saving: a failure would land on a closed dialog and be lost.
        if (!isSubmitting) onOpenChange(next);
      }}
    >
      <DialogContent fallbackFocusId="country-search">
        <DialogTitle>{country ? 'Edit country' : 'New country'}</DialogTitle>
        <DialogDescription>
          The rate is how many of the currency make one US dollar. Changing it
          never changes an expense already saved.
        </DialogDescription>
        <form onSubmit={submit} noValidate className="mt-6 grid gap-6">
          <Field
            label="Name"
            htmlFor="country-name"
            error={errors.nicename?.message}
          >
            <Input
              {...fieldA11y('country-name', errors.nicename?.message)}
              {...register('nicename')}
              autoComplete="off"
            />
          </Field>
          <div className="grid gap-6 sm:grid-cols-2">
            <Field
              label="ISO code"
              htmlFor="country-iso"
              error={errors.iso?.message}
              hint="Two capital letters, like IN."
            >
              <Input
                {...fieldA11y('country-iso', errors.iso?.message)}
                {...capitals(register('iso'))}
                autoComplete="off"
              />
            </Field>
            <Field
              label="ISO3 code"
              htmlFor="country-iso3"
              error={errors.iso3?.message}
              hint="Three capital letters, like IND. Leave it empty if there is none."
            >
              <Input
                {...fieldA11y('country-iso3', errors.iso3?.message)}
                {...capitals(register('iso3'))}
                autoComplete="off"
              />
            </Field>
            <Field
              label="Numeric code"
              htmlFor="country-numcode"
              error={errors.numcode?.message}
              hint="Like 356. Leave it empty if there is none."
            >
              <Input
                {...fieldA11y('country-numcode', errors.numcode?.message)}
                {...register('numcode')}
                inputMode="numeric"
                autoComplete="off"
              />
            </Field>
            <Field
              label="Calling code"
              htmlFor="country-phonecode"
              error={errors.phonecode?.message}
              hint="Without the plus, like 91. Leave it empty if there is none."
            >
              <Input
                {...fieldA11y('country-phonecode', errors.phonecode?.message)}
                {...register('phonecode')}
                inputMode="numeric"
                autoComplete="off"
              />
            </Field>
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            <Field
              label="Currency code"
              htmlFor="country-currency-code"
              error={errors.currencyCode?.message}
              hint="Three capital letters, like EUR."
            >
              <Input
                {...fieldA11y(
                  'country-currency-code',
                  errors.currencyCode?.message
                )}
                {...capitals(register('currencyCode'), currencyCodeTyped)}
                autoComplete="off"
              />
            </Field>
            <Field
              label="Currency symbol"
              htmlFor="country-currency-symbol"
              error={errors.currencySymbol?.message}
              hint="Like €. Up to four characters."
            >
              <Input
                {...fieldA11y(
                  'country-currency-symbol',
                  errors.currencySymbol?.message
                )}
                {...register('currencySymbol')}
                autoComplete="off"
              />
            </Field>
          </div>
          <Field
            label="Currency name"
            htmlFor="country-currency-name"
            error={errors.currencyName?.message}
          >
            <Input
              {...fieldA11y(
                'country-currency-name',
                errors.currencyName?.message
              )}
              {...register('currencyName')}
              autoComplete="off"
            />
          </Field>
          <div className="grid gap-6 sm:grid-cols-2">
            <Field
              label="Rate"
              htmlFor="country-rate"
              error={errors.rate?.message}
              hint={
                isDollar
                  ? 'US dollars are always 1.'
                  : 'Units of the currency per 1 US dollar, like 88.25. Leave it empty for Sync rates to fill in.'
              }
            >
              <Input
                {...fieldA11y('country-rate', errors.rate?.message)}
                {...register('rate')}
                readOnly={isDollar}
                inputMode="decimal"
                autoComplete="off"
              />
            </Field>
            <Field
              label="Tax rate (%)"
              htmlFor="country-tax-rate"
              error={errors.taxRate?.message}
              hint="From 0 to 100, like 18 or 7.25."
            >
              <Input
                {...fieldA11y('country-tax-rate', errors.taxRate?.message)}
                {...register('taxRate')}
                inputMode="decimal"
                autoComplete="off"
              />
            </Field>
          </div>
          <Controller
            control={control}
            name="active"
            render={({ field }) => (
              <fieldset className="grid content-start gap-2">
                <legend className="mb-1 flex min-h-6 items-center gap-2 text-small font-semibold text-foreground">
                  <Arm className="w-3 text-rule" />
                  Status
                </legend>
                <div>
                  <ChoiceChip
                    checked={field.value}
                    onChange={(event) => field.onChange(event.target.checked)}
                  >
                    Active
                  </ChoiceChip>
                </div>
                <p className="text-small text-navy-72">
                  An active country is offered when you pick a country, and Sync
                  rates updates its rate.
                </p>
              </fieldset>
            )}
          />
          {failure ? (
            <p
              role="alert"
              className="text-small font-semibold text-foreground"
            >
              {failure}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={isSubmitting}>
              Save
            </Button>
            <Button
              variant="quiet"
              disabled={isSubmitting}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

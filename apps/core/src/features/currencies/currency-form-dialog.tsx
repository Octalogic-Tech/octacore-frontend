import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Field, fieldA11y } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { formatRate } from '@/features/expenses/money';
import { serviceMessage } from '@/lib/core-api';
import { useSaveCurrency } from './api';
import {
  currencyFormSchema,
  emptyCurrencyForm,
  toCurrencyBody,
  type CurrencyFormValues,
  type CurrencyRow,
} from './schema';

interface CurrencyFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present when editing, absent when adding. */
  currency?: CurrencyRow;
}

export function CurrencyFormDialog({ open, onOpenChange, currency }: CurrencyFormDialogProps) {
  const save = useSaveCurrency();
  const [failure, setFailure] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CurrencyFormValues>({ resolver: zodResolver(currencyFormSchema), defaultValues: emptyCurrencyForm });

  useEffect(() => {
    if (open) {
      reset(
        currency
          ? { code: currency.code, name: currency.name, symbol: currency.symbol, rate: formatRate(currency.rate) }
          : emptyCurrencyForm,
      );
      setFailure(null);
    }
  }, [open, currency, reset]);

  const code = register('code');

  const submit = handleSubmit(async (values) => {
    setFailure(null);
    try {
      await save.mutateAsync({ id: currency?.id, body: toCurrencyBody(values) });
    } catch (error) {
      // A duplicate code is a 409 with a message written for people.
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
      <DialogContent fallbackFocusId="currency-search">
        <DialogTitle>{currency ? 'Edit currency' : 'New currency'}</DialogTitle>
        <DialogDescription>
          The rate is how many of this currency make one US dollar. Changing it never changes an expense already saved.
        </DialogDescription>
        <form onSubmit={submit} noValidate className="mt-6 grid gap-6">
          <Field label="Code" htmlFor="currency-code" error={errors.code?.message} hint="Three capital letters, like EUR.">
            <Input
              {...fieldA11y('currency-code', errors.code?.message)}
              {...code}
              onChange={(event) => {
                event.target.value = event.target.value.toUpperCase();
                void code.onChange(event);
              }}
              autoComplete="off"
            />
          </Field>
          <Field label="Name" htmlFor="currency-name" error={errors.name?.message}>
            <Input {...fieldA11y('currency-name', errors.name?.message)} {...register('name')} autoComplete="off" />
          </Field>
          <Field label="Symbol" htmlFor="currency-symbol" error={errors.symbol?.message} hint="Like €. Up to four characters.">
            <Input {...fieldA11y('currency-symbol', errors.symbol?.message)} {...register('symbol')} autoComplete="off" />
          </Field>
          <Field
            label="Rate"
            htmlFor="currency-rate"
            error={errors.rate?.message}
            hint="Units of this currency per 1 US dollar, like 88.25."
          >
            <Input
              {...fieldA11y('currency-rate', errors.rate?.message)}
              {...register('rate')}
              inputMode="decimal"
              autoComplete="off"
            />
          </Field>
          {failure ? (
            <p role="alert" className="text-small font-semibold text-foreground">
              {failure}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={isSubmitting}>
              Save
            </Button>
            <Button variant="quiet" disabled={isSubmitting} onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

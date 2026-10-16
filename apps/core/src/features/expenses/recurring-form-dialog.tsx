import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Field, fieldA11y } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useCurrencies } from '@/features/currencies/api';
import { PRIMARY_CURRENCY } from '@/features/currencies/schema';
import { useExpenseTypes } from '@/features/expense-types/api';
import { useProjects } from '@/features/projects/api';
import { serviceMessage } from '@/lib/core-api';
import { localToday } from '@/lib/format';
import { AmountField } from './amount-field';
import { useSaveRecurring } from './api';
import { withCurrent } from './options';
import {
  FREQUENCY_OPTIONS,
  emptyRecurringForm,
  recurringFormSchema,
  toRecurringBody,
  toRecurringFormValues,
  type RecurringFormValues,
  type RecurringRow,
} from './schema';

interface RecurringFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present when editing, absent when adding. A snapshot taken when the dialog was opened. */
  expense?: RecurringRow;
  /** Called after an add (not an edit) with how many charges the service created at once. */
  onSaved?: (generated: number) => void;
}

export function RecurringFormDialog({ open, onOpenChange, expense, onSaved }: RecurringFormDialogProps) {
  const types = useExpenseTypes();
  const currencies = useCurrencies();
  const projects = useProjects();
  const save = useSaveRecurring();
  const [failure, setFailure] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    watch,
    getValues,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<RecurringFormValues>({ resolver: zodResolver(recurringFormSchema), defaultValues: emptyRecurringForm });

  const usdId = currencies.data?.find((currency) => currency.code === PRIMARY_CURRENCY)?.id;
  // The start date anchors the schedule: the service refuses to move it once a charge exists.
  const startLocked = expense !== undefined && expense.lastChargeDate !== null;

  useEffect(() => {
    if (open) {
      reset(toRecurringFormValues(expense, localToday()));
      setFailure(null);
    }
  }, [open, expense, reset]);

  // US dollars are the starting currency, once the list is here to say which row that is.
  useEffect(() => {
    if (open && usdId !== undefined && getValues('currencyId') === '') setValue('currencyId', String(usdId));
  }, [open, usdId, expense, getValues, setValue]);

  const typeOptions = useMemo(
    () =>
      withCurrent(
        (types.data ?? []).map((type) => ({ id: type.id, label: type.name })),
        expense && { id: expense.expenseTypeId, label: expense.expenseType.name },
      ),
    [types.data, expense],
  );
  const projectOptions = useMemo(
    () =>
      withCurrent(
        (projects.data ?? []).map((project) => ({ id: project.id, label: project.name })),
        expense?.project ? { id: expense.project.id, label: expense.project.name } : undefined,
      ),
    [projects.data, expense],
  );

  const submit = handleSubmit(async (values) => {
    setFailure(null);
    let generated = 0;
    try {
      generated = await save.mutateAsync({ id: expense?.id, body: toRecurringBody(values) });
    } catch (error) {
      // A 422 (an amount under one US cent, an end date before the start) carries a message written for people.
      setFailure(serviceMessage(error) ?? 'That did not save. Try again.');
      return;
    }
    if (!expense) onSaved?.(generated);
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
      <DialogContent fallbackFocusId="recurring-add">
        <DialogTitle>{expense ? 'Edit recurring expense' : 'New recurring expense'}</DialogTitle>
        <DialogDescription>
          A charge is created on every charge date, from the start date on. Changing the amount changes future charges
          only.
        </DialogDescription>
        <form onSubmit={submit} noValidate className="mt-6 grid gap-6">
          <Field label="Name" htmlFor="recurring-name" error={errors.name?.message}>
            <Input {...fieldA11y('recurring-name', errors.name?.message)} {...register('name')} autoComplete="off" />
          </Field>
          <Field
            label="Type"
            htmlFor="recurring-type"
            error={errors.expenseTypeId?.message}
            hint={types.isError ? 'Types could not be loaded.' : undefined}
          >
            <Select {...fieldA11y('recurring-type', errors.expenseTypeId?.message)} {...register('expenseTypeId')}>
              <option value="">Choose…</option>
              {typeOptions.map((option) => (
                <option key={option.id} value={String(option.id)}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Frequency" htmlFor="recurring-frequency" error={errors.frequency?.message}>
            <Select {...fieldA11y('recurring-frequency', errors.frequency?.message)} {...register('frequency')}>
              {FREQUENCY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Start date"
            htmlFor="recurring-start-date"
            error={errors.startDate?.message}
            hint={
              startLocked
                ? 'Fixed once a charge has been created.'
                : 'The first charge date. A date in the past creates its charges now.'
            }
          >
            <Input
              {...fieldA11y('recurring-start-date', errors.startDate?.message)}
              {...register('startDate')}
              type="date"
              readOnly={startLocked}
            />
          </Field>
          <Field
            label="End date"
            htmlFor="recurring-end-date"
            error={errors.endDate?.message}
            hint="Optional. Leave it empty to keep charging until you cancel."
          >
            <Input
              {...fieldA11y('recurring-end-date', errors.endDate?.message)}
              {...register('endDate')}
              type="date"
            />
          </Field>
          <AmountField
            idPrefix="recurring"
            currencies={currencies.data ?? []}
            current={expense?.currency}
            currencyProps={register('currencyId')}
            amountProps={register('amount')}
            currencyId={watch('currencyId')}
            amount={watch('amount')}
            currencyError={errors.currencyId?.message}
            amountError={errors.amount?.message}
            currenciesFailed={currencies.isError}
          />
          <Field
            label="Project"
            htmlFor="recurring-project"
            error={errors.projectId?.message}
            hint={projects.isError ? 'Projects could not be loaded.' : undefined}
          >
            <Select {...fieldA11y('recurring-project', errors.projectId?.message)} {...register('projectId')}>
              <option value="">None</option>
              {projectOptions.map((option) => (
                <option key={option.id} value={String(option.id)}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Notes" htmlFor="recurring-notes" error={errors.notes?.message}>
            <Textarea {...fieldA11y('recurring-notes', errors.notes?.message)} {...register('notes')} rows={3} />
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

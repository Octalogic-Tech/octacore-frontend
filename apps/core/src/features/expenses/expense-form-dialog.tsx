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
import { useSaveExpense } from './api';
import { withCurrent } from './options';
import {
  emptyExpenseForm,
  expenseFormSchema,
  shownAmount,
  toExpenseBody,
  toExpenseFormValues,
  type ExpenseFormValues,
  type ExpenseRow,
} from './schema';

interface ExpenseFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present when editing, absent when adding. A snapshot taken when the dialog was opened. */
  expense?: ExpenseRow;
}

export function ExpenseFormDialog({ open, onOpenChange, expense }: ExpenseFormDialogProps) {
  const types = useExpenseTypes();
  const currencies = useCurrencies();
  const projects = useProjects();
  const save = useSaveExpense();
  const [failure, setFailure] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    watch,
    getValues,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ExpenseFormValues>({ resolver: zodResolver(expenseFormSchema), defaultValues: emptyExpenseForm });

  const usdId = currencies.data?.find((currency) => currency.code === PRIMARY_CURRENCY)?.id;

  useEffect(() => {
    if (open) {
      reset(toExpenseFormValues(expense, localToday()));
      setFailure(null);
    }
  }, [open, expense, reset]);

  // US dollars are the starting currency, once the list is here to say which row that is.
  useEffect(() => {
    if (open && usdId !== undefined && getValues('currencyId') === '') setValue('currencyId', String(usdId));
  }, [open, usdId, expense, getValues, setValue]);

  // The expense's own type and project are always options, so an edit cannot blank a select whose list is loading.
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
    try {
      const shown = expense ? shownAmount(expense, usdId) : undefined;
      await save.mutateAsync({ id: expense?.id, body: toExpenseBody(values, shown) });
    } catch (error) {
      // A 422 (an amount under one US cent, an unknown currency) carries a message written for people.
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
      <DialogContent fallbackFocusId="expense-search">
        <DialogTitle>{expense ? 'Edit expense' : 'New expense'}</DialogTitle>
        <DialogDescription>
          One charge. For something that repeats, add a recurring expense and its charges are created for you.
        </DialogDescription>
        <form onSubmit={submit} noValidate className="mt-6 grid gap-6">
          <Field label="Name" htmlFor="expense-name" error={errors.name?.message}>
            <Input {...fieldA11y('expense-name', errors.name?.message)} {...register('name')} autoComplete="off" />
          </Field>
          <Field
            label="Type"
            htmlFor="expense-type"
            error={errors.expenseTypeId?.message}
            hint={types.isError ? 'Types could not be loaded.' : undefined}
          >
            <Select {...fieldA11y('expense-type', errors.expenseTypeId?.message)} {...register('expenseTypeId')}>
              <option value="">Choose…</option>
              {typeOptions.map((option) => (
                <option key={option.id} value={String(option.id)}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Charge date" htmlFor="expense-date" error={errors.chargeDate?.message}>
            <Input {...fieldA11y('expense-date', errors.chargeDate?.message)} {...register('chargeDate')} type="date" />
          </Field>
          <AmountField
            idPrefix="expense"
            currencies={currencies.data ?? []}
            current={expense?.originalCurrency ?? undefined}
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
            htmlFor="expense-project"
            error={errors.projectId?.message}
            hint={projects.isError ? 'Projects could not be loaded.' : undefined}
          >
            <Select {...fieldA11y('expense-project', errors.projectId?.message)} {...register('projectId')}>
              <option value="">None</option>
              {projectOptions.map((option) => (
                <option key={option.id} value={String(option.id)}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Notes" htmlFor="expense-notes" error={errors.notes?.message}>
            <Textarea {...fieldA11y('expense-notes', errors.notes?.message)} {...register('notes')} rows={3} />
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

import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Field, fieldA11y } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useCountries } from '@/features/countries/api';
import { dollarCountry } from '@/features/countries/options';
import { useExpenseTypes } from '@/features/expense-types/api';
import { usePeople } from '@/features/people/api';
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
  /** Where focus goes on close if the element that opened the dialog is gone (a deleted row). */
  fallbackFocusId?: string;
}

export function ExpenseFormDialog({
  open,
  onOpenChange,
  expense,
  fallbackFocusId = 'expense-search',
}: ExpenseFormDialogProps) {
  const types = useExpenseTypes();
  const countries = useCountries();
  const projects = useProjects();
  const people = usePeople();
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

  const usdId = dollarCountry(countries.data ?? [])?.id;

  useEffect(() => {
    if (open) {
      reset(toExpenseFormValues(expense, localToday()));
      setFailure(null);
    }
  }, [open, expense, reset]);

  // US dollars are the starting currency, once the list is here to say which country that is.
  useEffect(() => {
    if (open && usdId !== undefined && getValues('countryId') === '') setValue('countryId', String(usdId));
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

  const personOptions = useMemo(
    () =>
      withCurrent(
        (people.data ?? []).map((person) => ({ id: person.id, label: person.name })),
        expense?.person ? { id: expense.person.id, label: expense.person.name } : undefined,
      ),
    [people.data, expense],
  );

  const submit = handleSubmit(async (values) => {
    setFailure(null);
    try {
      const shown = expense ? shownAmount(expense, usdId) : undefined;
      await save.mutateAsync({ id: expense?.id, body: toExpenseBody(values, shown) });
    } catch (error) {
      // A 422 (an amount under one US cent, a country with no rate) carries a message written for people.
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
      <DialogContent fallbackFocusId={fallbackFocusId}>
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
            countries={countries.data ?? []}
            current={expense?.originalCountry ?? undefined}
            countryProps={register('countryId')}
            amountProps={register('amount')}
            countryId={watch('countryId')}
            amount={watch('amount')}
            countryError={errors.countryId?.message}
            amountError={errors.amount?.message}
            countriesFailed={countries.isError}
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
          <Field
            label="Person"
            htmlFor="expense-person"
            error={errors.personId?.message}
            hint={people.isError ? 'People could not be loaded.' : undefined}
          >
            <Select {...fieldA11y('expense-person', errors.personId?.message)} {...register('personId')}>
              <option value="">None</option>
              {personOptions.map((option) => (
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

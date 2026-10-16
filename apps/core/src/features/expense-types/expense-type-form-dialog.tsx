import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Field, fieldA11y } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { serviceMessage } from '@/lib/core-api';
import { useSaveExpenseType } from './api';
import {
  emptyExpenseTypeForm,
  expenseTypeFormSchema,
  toExpenseTypeBody,
  type ExpenseTypeFormValues,
  type ExpenseTypeRow,
} from './schema';

interface ExpenseTypeFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present when editing, absent when adding. */
  expenseType?: ExpenseTypeRow;
}

export function ExpenseTypeFormDialog({ open, onOpenChange, expenseType }: ExpenseTypeFormDialogProps) {
  const save = useSaveExpenseType();
  const [failure, setFailure] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ExpenseTypeFormValues>({
    resolver: zodResolver(expenseTypeFormSchema),
    defaultValues: emptyExpenseTypeForm,
  });

  useEffect(() => {
    if (open) {
      reset(expenseType ? { name: expenseType.name, description: expenseType.description } : emptyExpenseTypeForm);
      setFailure(null);
    }
  }, [open, expenseType, reset]);

  const submit = handleSubmit(async (values) => {
    setFailure(null);
    try {
      await save.mutateAsync({ id: expenseType?.id, body: toExpenseTypeBody(values) });
    } catch (error) {
      // A duplicate name is a 409 with a message written for people.
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
      <DialogContent fallbackFocusId="expense-type-search">
        <DialogTitle>{expenseType ? 'Edit expense type' : 'New expense type'}</DialogTitle>
        <DialogDescription>Give the type a name, and say what belongs under it if that helps.</DialogDescription>
        <form onSubmit={submit} noValidate className="mt-6 grid gap-6">
          <Field label="Name" htmlFor="expense-type-name" error={errors.name?.message}>
            <Input {...fieldA11y('expense-type-name', errors.name?.message)} {...register('name')} autoComplete="off" />
          </Field>
          <Field label="Description" htmlFor="expense-type-description" error={errors.description?.message}>
            <Textarea
              {...fieldA11y('expense-type-description', errors.description?.message)}
              {...register('description')}
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

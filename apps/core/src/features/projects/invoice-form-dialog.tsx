import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Field, fieldA11y } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { statusOf } from '@/lib/core-api';
import { useSaveInvoice } from './api';
import {
  emptyInvoiceForm,
  invoiceFormSchema,
  toInvoiceBody,
  toInvoiceFormValues,
  type InvoiceFormValues,
  type InvoiceRow,
} from './schema';

interface InvoiceFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: number;
  /** Present when editing, absent when adding. A snapshot taken when the dialog was opened. */
  invoice?: InvoiceRow;
  /** Where focus goes on close if the element that opened the dialog is gone (the empty state it came from). */
  fallbackFocusId?: string;
}

type Failure = 'failed' | 'changed-elsewhere' | null;

export function InvoiceFormDialog({ open, onOpenChange, projectId, invoice, fallbackFocusId }: InvoiceFormDialogProps) {
  const save = useSaveInvoice(projectId);
  const [failure, setFailure] = useState<Failure>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<InvoiceFormValues>({ resolver: zodResolver(invoiceFormSchema), defaultValues: emptyInvoiceForm });

  useEffect(() => {
    if (open) {
      reset(toInvoiceFormValues(invoice));
      setFailure(null);
    }
  }, [open, invoice, reset]);

  const submit = handleSubmit(async (values) => {
    setFailure(null);
    try {
      await save.mutateAsync({ id: invoice?.id, body: toInvoiceBody(values) });
    } catch (error) {
      // Saving again would repeat a call that cannot succeed: a 409 on add (the project is gone) or a 404 on edit
      // (the invoice is). Anything else may be a passing fault, so it says to try again.
      const status = statusOf(error);
      const gone = invoice === undefined ? status === 409 : status === 404;
      setFailure(gone ? 'changed-elsewhere' : 'failed');
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
        <DialogTitle>{invoice ? 'Edit invoice' : 'New invoice'}</DialogTitle>
        <DialogDescription>An invoice sent to the client. Fill in the paid date once it has been paid.</DialogDescription>
        <form onSubmit={submit} noValidate className="mt-6 grid gap-6">
          <Field label="Number" htmlFor="invoice-number" error={errors.number?.message}>
            <Input
              {...fieldA11y('invoice-number', errors.number?.message)}
              {...register('number')}
              autoComplete="off"
            />
          </Field>
          <Field label="Description" htmlFor="invoice-description" error={errors.description?.message}>
            <Input
              {...fieldA11y('invoice-description', errors.description?.message)}
              {...register('description')}
              autoComplete="off"
            />
          </Field>
          <Field label="Amount" htmlFor="invoice-amount" error={errors.amount?.message}>
            <Input
              {...fieldA11y('invoice-amount', errors.amount?.message)}
              {...register('amount')}
              inputMode="numeric"
              autoComplete="off"
            />
          </Field>
          <Field label="Issue date" htmlFor="invoice-issue-date" error={errors.issueDate?.message}>
            <Input {...fieldA11y('invoice-issue-date', errors.issueDate?.message)} {...register('issueDate')} type="date" />
          </Field>
          <Field label="Due date" htmlFor="invoice-due-date" error={errors.dueDate?.message}>
            <Input {...fieldA11y('invoice-due-date', errors.dueDate?.message)} {...register('dueDate')} type="date" />
          </Field>
          <Field
            label="Paid date"
            htmlFor="invoice-paid-date"
            error={errors.paidDate?.message}
            hint="Leave empty if the client has not paid."
          >
            <Input {...fieldA11y('invoice-paid-date', errors.paidDate?.message)} {...register('paidDate')} type="date" />
          </Field>
          {failure === 'failed' ? (
            <p role="alert" className="text-small font-semibold text-foreground">
              That did not save. Try again.
            </p>
          ) : null}
          {failure === 'changed-elsewhere' ? (
            <p role="alert" className="text-small font-semibold text-foreground">
              This changed elsewhere, so it cannot be saved. Close this dialog and go back to Projects.
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

import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useRef, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Field, fieldA11y } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { statusOf } from '@/lib/core-api';
import { formatCurrency } from '@/lib/format';
import { useInvoiceDraft, useSaveInvoice } from './api';
import {
  blankLine,
  draftToLines,
  invoiceFormSchema,
  lineAmount,
  linesTotal,
  toInvoiceBody,
  toInvoiceFormValues,
  type BillingType,
  type InvoiceFormValues,
  type InvoiceRow,
} from './schema';

interface InvoiceFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: number;
  /** Present when editing, absent when adding. A snapshot taken when the dialog was opened. */
  invoice?: InvoiceRow;
  /** Null on a project from before billing types. Only a retainer says what its lines are. */
  billingType?: BillingType | null;
  /** Where focus goes on close if the element that opened the dialog is gone (the empty state it came from). */
  fallbackFocusId?: string;
}

type Failure = 'failed' | 'changed-elsewhere' | null;

const NONE = '—';

export function InvoiceFormDialog({
  open,
  onOpenChange,
  projectId,
  invoice,
  billingType,
  fallbackFocusId,
}: InvoiceFormDialogProps) {
  const [busy, setBusy] = useState(false);
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Not while saving: a failure would land on a closed dialog and be lost.
        if (!busy) onOpenChange(next);
      }}
    >
      <DialogContent fallbackFocusId={fallbackFocusId} className="max-w-3xl">
        <DialogTitle>{invoice ? 'Edit invoice' : 'New invoice'}</DialogTitle>
        <DialogDescription>
          An invoice sent to the client, made of lines. Fill in the paid date once it has been paid.
        </DialogDescription>
        {/* Mounted only while the dialog is open, so every opening starts from a fresh form and a fresh draft. */}
        <InvoiceEditor
          projectId={projectId}
          invoice={invoice}
          billingType={billingType}
          onBusyChange={setBusy}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

interface InvoiceEditorProps {
  projectId: number;
  invoice?: InvoiceRow;
  billingType?: BillingType | null;
  onBusyChange: (busy: boolean) => void;
  onClose: () => void;
}

function InvoiceEditor({ projectId, invoice, billingType, onBusyChange, onClose }: InvoiceEditorProps) {
  const adding = invoice === undefined;
  const save = useSaveInvoice(projectId);
  const draft = useInvoiceDraft(projectId, adding);
  const [failure, setFailure] = useState<Failure>(null);
  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<InvoiceFormValues>({
    resolver: zodResolver(invoiceFormSchema),
    defaultValues: toInvoiceFormValues(invoice),
  });
  const { fields, append, remove, replace } = useFieldArray({ control, name: 'lines' });
  const lines = watch('lines');
  const seeded = useRef(false);

  useEffect(() => {
    onBusyChange(isSubmitting);
  }, [isSubmitting, onBusyChange]);
  useEffect(() => () => onBusyChange(false), [onBusyChange]);

  // The draft fills the lines once, when it arrives, and nothing else: whatever was typed in the header stays. An
  // empty draft (a fixed cost project, or a retainer with no resources) leaves the one blank line.
  useEffect(() => {
    if (!adding || seeded.current || !draft.data) return;
    seeded.current = true;
    const seed = draftToLines(draft.data);
    if (seed.length > 0) replace(seed);
  }, [adding, draft.data, replace]);

  const submit = handleSubmit(async (values) => {
    setFailure(null);
    try {
      await save.mutateAsync({ id: invoice?.id, body: toInvoiceBody(values) });
    } catch (error) {
      // Saving again would repeat a call that cannot succeed: a 409 on add (the project is gone) or a 404 on edit
      // (the invoice is). Anything else may be a passing fault, so it says to try again.
      const status = statusOf(error);
      const gone = adding ? status === 409 : status === 404;
      setFailure(gone ? 'changed-elsewhere' : 'failed');
      return;
    }
    onClose();
  });

  const building = adding && draft.isLoading;
  const linesMessage = errors.lines?.root?.message ?? errors.lines?.message;

  return (
    <form onSubmit={submit} noValidate className="mt-6 grid gap-6">
      <div className="grid gap-6 sm:grid-cols-2">
        <Field label="Number" htmlFor="invoice-number" error={errors.number?.message}>
          <Input {...fieldA11y('invoice-number', errors.number?.message)} {...register('number')} autoComplete="off" />
        </Field>
        <Field label="Description" htmlFor="invoice-description" error={errors.description?.message}>
          <Input
            {...fieldA11y('invoice-description', errors.description?.message)}
            {...register('description')}
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
      </div>

      <div className="grid gap-3">
        <h3 className="text-small font-semibold text-navy-80">Lines</h3>

        {building ? (
          <p role="status" className="text-body">
            Building lines…
          </p>
        ) : (
          <>
            {adding && draft.isError ? (
              <div role="alert" className="grid justify-items-start gap-1">
                <p className="text-small font-semibold text-foreground">Could not build the lines.</p>
                <Button variant="quiet" onClick={() => void draft.refetch()}>
                  Try again
                </Button>
              </div>
            ) : null}

            {/* Column names for the sighted: a placeholder vanishes once a value is there. The inputs carry
                their own names for assistive technology, and below `sm` each row stacks. */}
            <div
              aria-hidden="true"
              className="hidden gap-2 text-small font-semibold text-navy-80 sm:grid sm:grid-cols-[1fr_6rem_7rem_6rem_5.5rem]"
            >
              <span>Description</span>
              <span>Quantity</span>
              <span>Rate</span>
              <span className="text-right">Amount</span>
              <span />
            </div>

            {fields.map((field, index) => {
              const number = index + 1;
              const rowErrors = errors.lines?.[index];
              const amount = lineAmount(lines?.[index] ?? blankLine);
              return (
                <div key={field.id} role="group" aria-label={`Line ${number}`} className="grid gap-1">
                  <div className="grid items-start gap-2 sm:grid-cols-[1fr_6rem_7rem_6rem_5.5rem]">
                    <Input
                      {...fieldA11y(`line-${number}-description`, rowErrors?.description?.message)}
                      {...register(`lines.${index}.description`)}
                      aria-label={`Line ${number} description`}
                      placeholder="Description"
                      autoComplete="off"
                    />
                    <Input
                      {...fieldA11y(`line-${number}-quantity`, rowErrors?.quantity?.message)}
                      {...register(`lines.${index}.quantity`)}
                      aria-label={`Line ${number} quantity`}
                      placeholder="Quantity"
                      inputMode="numeric"
                      autoComplete="off"
                    />
                    <Input
                      {...fieldA11y(`line-${number}-rate`, rowErrors?.rate?.message)}
                      {...register(`lines.${index}.rate`)}
                      aria-label={`Line ${number} rate`}
                      placeholder="Rate"
                      inputMode="numeric"
                      autoComplete="off"
                    />
                    <p className="tabular py-3 text-right text-small">
                      <span className="sr-only">{`Line ${number} amount `}</span>
                      {amount === null ? NONE : formatCurrency(amount)}
                    </p>
                    <Button
                      variant="quiet"
                      aria-label={`Remove line ${number}`}
                      disabled={fields.length === 1}
                      onClick={() => remove(index)}
                    >
                      Remove
                    </Button>
                  </div>
                  {/* Every message the row has (a blank quantity must not hide a blank rate), each with the id
                      its input's aria-describedby points at. */}
                  {(['description', 'quantity', 'rate'] as const).map((name) => {
                    const message = rowErrors?.[name]?.message;
                    return message ? (
                      <p key={name} id={`line-${number}-${name}-error`} role="alert" className="text-small text-foreground">
                        {message}
                      </p>
                    ) : null;
                  })}
                </div>
              );
            })}

            {linesMessage ? (
              <p role="alert" className="text-small text-foreground">
                {linesMessage}
              </p>
            ) : null}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <Button variant="quiet" onClick={() => append({ ...blankLine })}>
                Add line
              </Button>
              <p className="tabular font-semibold">Total {formatCurrency(linesTotal(lines ?? []))}</p>
            </div>
          </>
        )}

        {billingType === 'retainer' ? (
          <p className="text-small text-navy-72">Retainer lines are 160 hours a month.</p>
        ) : null}
      </div>

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
        <Button variant="quiet" disabled={isSubmitting} onClick={onClose}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

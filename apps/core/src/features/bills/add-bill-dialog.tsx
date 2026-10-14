import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Field, fieldA11y } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Arm } from '@/components/ui/marks';
import { Select } from '@/components/ui/select';
import { useCreateBill } from './api';
import { billFormSchema, toNewBill, type BillFormValues } from './schema';
import { BILL_TYPES } from './types';

const emptyValues = { billDate: '', amount: '', billType: '', reimbursement: 'Yes' as const, addedBy: '' };

export function AddBillDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const create = useCreateBill();
  const [saveFailed, setSaveFailed] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<BillFormValues>({ resolver: zodResolver(billFormSchema), defaultValues: emptyValues });

  useEffect(() => {
    if (open) {
      reset(emptyValues);
      setSaveFailed(false);
    }
  }, [open, reset]);

  const submit = handleSubmit(async (values) => {
    setSaveFailed(false);
    try {
      await create.mutateAsync(toNewBill(values));
      onOpenChange(false);
    } catch {
      setSaveFailed(true);
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>Add bill</DialogTitle>
        <DialogDescription>Record a bill and attach a picture of it. It starts as pending.</DialogDescription>
        <form onSubmit={submit} noValidate className="mt-6 grid gap-6">
          <Field label="Date" htmlFor="bill-date" error={errors.billDate?.message}>
            <Input type="date" {...fieldA11y('bill-date', errors.billDate?.message)} {...register('billDate')} />
          </Field>
          <Field label="Amount" htmlFor="bill-amount" error={errors.amount?.message}>
            <Input
              type="number"
              step="0.01"
              inputMode="decimal"
              {...fieldA11y('bill-amount', errors.amount?.message)}
              {...register('amount')}
            />
          </Field>
          <Field label="Bill type" htmlFor="bill-type" error={errors.billType?.message}>
            <Select {...fieldA11y('bill-type', errors.billType?.message)} {...register('billType')}>
              <option value="">Select a type</option>
              {BILL_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </Select>
          </Field>
          <fieldset className="grid gap-1">
            <legend className="mb-1 flex min-h-6 items-center gap-2 text-small font-semibold text-foreground">
              <Arm className="w-3 text-rule" />
              Reimbursement
            </legend>
            <div className="flex gap-3">
              {['Yes', 'No'].map((choice) => (
                <label
                  key={choice}
                  className="flex min-h-11 cursor-pointer items-center border border-rule px-5 font-semibold has-[:checked]:border-navy has-[:checked]:bg-navy has-[:checked]:text-on-navy has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-navy"
                >
                  <input type="radio" value={choice} className="sr-only" {...register('reimbursement')} />
                  {choice}
                </label>
              ))}
            </div>
          </fieldset>
          <Field label="Added by" htmlFor="bill-added-by" error={errors.addedBy?.message}>
            <Input
              {...fieldA11y('bill-added-by', errors.addedBy?.message)}
              {...register('addedBy')}
              autoComplete="name"
            />
          </Field>
          <Field label="Bill image" htmlFor="bill-attachment" error={errors.attachment?.message}>
            <Input
              type="file"
              accept="image/*"
              className="file:mr-4 file:min-h-11 file:border-0 file:bg-primary file:px-5 file:font-semibold file:text-primary-foreground"
              {...fieldA11y('bill-attachment', errors.attachment?.message)}
              {...register('attachment')}
            />
          </Field>
          {saveFailed ? (
            <p role="alert" className="text-small font-semibold text-foreground">
              That did not save. Try again.
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={isSubmitting}>
              Save
            </Button>
            <Button variant="quiet" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
